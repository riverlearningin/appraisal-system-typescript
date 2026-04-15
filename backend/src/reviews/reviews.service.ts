import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReviewResponseDto } from './dto/review-response.dto';

@Injectable()
export class ReviewsService {
    constructor(private prisma: PrismaService) { }

    async createReview(data: {
        cycleId: number;
        employeeId: number;
        reviewerId: number;
        reviewerRole: string;
    }) {
        const cycle = await this.prisma.cycle.findUnique({
            where: { id: data.cycleId },
        });
        if (!cycle) throw new NotFoundException('Cycle not found');

        const employee = await this.prisma.user.findUnique({
            where: { id: data.employeeId },
        });
        if (!employee) throw new NotFoundException('Employee not found');

        const hierarchy = await this.prisma.userHierarchy.findUnique({
            where: { employeeId: data.employeeId },
        });

        if (!hierarchy && data.reviewerId !== data.employeeId) {
            throw new ForbiddenException('Employee has no manager assigned');
        }

        if (data.reviewerId === data.employeeId) {
            if (data.reviewerRole !== 'employee') {
                throw new ForbiddenException('Invalid self review role');
            }
        } else {
            const isManager = await this.isManagerOfEmployee(
                data.reviewerId,
                data.employeeId,
            );

            if (!isManager) throw new ForbiddenException('Not in your hierarchy');

            if (!['manager', 'management'].includes(data.reviewerRole)) {
                throw new ForbiddenException('Invalid reviewer role');
            }
        }

        if (cycle.status !== 'active') {
            throw new BadRequestException('Cycle is not active');
        }

        return this.prisma.review.create({
            data: {
                cycleId: data.cycleId,
                employeeId: data.employeeId,
                reviewerId: data.reviewerId,
                reviewerRole: data.reviewerRole,
                status: 'draft',
            },
        });
    }

    async addResponse(data: {
        reviewId: number;
        pointId: number;
        comment: string;
        rating: number | null;
        userId: number;
    }) {
        const review = await this.prisma.review.findUnique({
            where: { id: data.reviewId },
            select: {
                id: true,
                employeeId: true,
                cycleId: true,
                reviewerId: true,
                reviewerRole: true,
                status: true,
            },
        });

        if (!review) throw new NotFoundException('Review not found');

        if (review.reviewerId !== data.userId) {
            throw new ForbiddenException('Only reviewer can modify responses');
        }

        if (review.status === 'submitted') {
            throw new BadRequestException('Cannot edit submitted review');
        }

        await this.ensureNotLockedByManagementSubmission(
            review.id,
            review.cycleId,
            review.employeeId,
        );

        const point = await this.prisma.point.findUnique({
            where: { id: data.pointId },
            select: {
                id: true,
                employeeId: true,
                section: { select: { cycleId: true, isDynamic: true } },
            },
        });

        if (!point) throw new NotFoundException('Point not found');
        if (point.section.cycleId !== review.cycleId) {
            throw new BadRequestException('Point does not belong to this review cycle');
        }
        if (point.employeeId != null && point.employeeId !== review.employeeId) {
            throw new ForbiddenException('This point is not available for this employee review');
        }

        const comment = data.comment?.trim() ?? '';

        const { userId, ...responseData } = data;

        return this.prisma.reviewResponses.upsert({
            where: {
                reviewId_pointId: {
                    reviewId: responseData.reviewId,
                    pointId: responseData.pointId,
                },
            },
            create: {
                ...responseData,
                comment,
            },
            update: {
                rating: responseData.rating,
                comment,
            },
        });
    }

    async addDynamicPoint(data: {
        reviewId: number;
        sectionId: number;
        title: string;
        userId: number;
    }) {
        const review = await this.prisma.review.findUnique({
            where: { id: data.reviewId },
            select: {
                id: true,
                employeeId: true,
                reviewerId: true,
                reviewerRole: true,
                status: true,
                cycleId: true,
            },
        });

        if (!review) throw new NotFoundException('Review not found');

        if (review.reviewerId !== data.userId) {
            throw new ForbiddenException('Only reviewer can add dynamic points');
        }

        if (review.reviewerRole !== 'employee') {
            throw new ForbiddenException('Only employee self-review can add dynamic points');
        }

        if (review.status === 'submitted') {
            throw new BadRequestException('Cannot add points to submitted review');
        }

        await this.ensureNotLockedByManagementSubmission(
            review.id,
            review.cycleId,
            review.employeeId,
        );

        const section = await this.prisma.section.findUnique({
            where: { id: data.sectionId },
            select: {
                id: true,
                cycleId: true,
                isDynamic: true,
            },
        });

        if (!section) throw new NotFoundException('Section not found');
        if (section.cycleId !== review.cycleId) {
            throw new ForbiddenException('Section is not in this review cycle');
        }
        if (!section.isDynamic) {
            throw new BadRequestException('Points can be added only to dynamic sections');
        }

        return this.prisma.point.create({
            data: {
                sectionId: section.id,
                employeeId: review.employeeId,
                title: data.title,
                isPredefined: false,
            },
            select: {
                id: true,
                title: true,
            },
        });
    }

    async submitReview(reviewId: number, userId: number) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
            select: {
                id: true,
                employeeId: true,
                cycleId: true,
                reviewerId: true,
                reviewerRole: true,
                status: true,
            },
        });

        if (!review) throw new NotFoundException('Review not found');

        if (review.status === 'submitted') {
            throw new ForbiddenException('Review already submitted');
        }

        if (review.reviewerId !== userId) {
            throw new ForbiddenException('Only reviewer can submit');
        }

        await this.ensureNotLockedByManagementSubmission(
            review.id,
            review.cycleId,
            review.employeeId,
        );

        const cyclePoints = await this.prisma.point.findMany({
            where: {
                OR: [{ employeeId: null }, { employeeId: review.employeeId }],
                section: {
                    cycleId: review.cycleId,
                },
            },
            select: {
                id: true,
                section: {
                    select: {
                        isDynamic: true,
                    },
                },
            },
        });

        if (cyclePoints.length === 0) {
            throw new BadRequestException('No appraisal points configured for this cycle');
        }

        const responses = await this.prisma.reviewResponses.findMany({
            where: { reviewId: review.id },
            select: { pointId: true, rating: true, comment: true },
        });

        const responseByPoint = new Map<number, { rating: number | null; comment: string }>();
        for (const response of responses) {
            responseByPoint.set(response.pointId, {
                rating: response.rating,
                comment: response.comment,
            });
        }

        for (const point of cyclePoints) {
            const response = responseByPoint.get(point.id);
            const comment = response?.comment?.trim() ?? '';

            if (!response || comment.length === 0) {
                throw new BadRequestException('Please complete all accessible comments before submitting');
            }

            if (!point.section.isDynamic && response.rating == null) {
                throw new BadRequestException('Please complete all accessible ratings before submitting');
            }
        }

        return this.prisma.review.update({
            where: { id: reviewId },
            data: { status: 'submitted' },
        });
    }

    async getReviewsForManager(managerId: number) {
        const [requester, hierarchy, reviews] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: managerId },
                select: {
                    roles: {
                        select: {
                            role: {
                                select: { name: true },
                            },
                        },
                    },
                },
            }),
            this.prisma.userHierarchy.findMany(),
            this.prisma.review.findMany({
                select: {
                    id: true,
                    employeeId: true,
                    status: true,
                },
            }),
        ]);

        if (!requester) throw new NotFoundException('User not found');

        const roles = requester.roles.map((r) => r.role.name);
        if (roles.includes('admin')) {
            return reviews;
        }

        const parentMap = new Map<number, number>();
        for (const rel of hierarchy) {
            parentMap.set(rel.employeeId, rel.managerId);
        }

        return reviews.filter((review) =>
            this.isManagerOfEmployeeFromMap(
                managerId,
                review.employeeId,
                parentMap,
            ),
        );
    }

    async generateReviews(cycleId: number) {
        const cycle = await this.prisma.cycle.findUnique({
            where: { id: cycleId },
        });

        if (!cycle) throw new NotFoundException('Cycle not found');
        if (cycle.status !== 'active') {
            throw new ForbiddenException('Cycle is not active');
        }

        const [users, hierarchy] = await Promise.all([
            this.prisma.user.findMany({ 
                select: { 
                    id: true,
                    roles: { select: { role: { select: { name: true } } } },
                },
            }),
            this.prisma.userHierarchy.findMany(),
        ]);

        const userRoleMap = new Map<number, string[]>();
        for (const user of users) {
            userRoleMap.set(user.id, user.roles.map(r => r.role.name));
        }

        const managerMap = new Map<number, number>();
        for (const rel of hierarchy) {
            managerMap.set(rel.employeeId, rel.managerId);
        }

        const getReviewerRole = (reviewerId: number): 'management' | 'manager' | 'employee' | null => {
            const roles = userRoleMap.get(reviewerId) ?? [];
            if (roles.includes('management')) return 'management';
            if (roles.includes('manager')) return 'manager';
            if (roles.includes('admin')) return null;
            return 'employee';
        }

        const reviewsToCreate: any[] = [];

        for (const user of users) {
            const userRoles = userRoleMap.get(user.id) ?? [];
            const skipSelfReview = userRoles.includes('management') || userRoles.includes('admin');

            if (!skipSelfReview) {
                reviewsToCreate.push({
                    cycleId,
                    employeeId: user.id,
                    reviewerId: user.id,
                    reviewerRole: 'employee',
                    status: 'draft',
                });
            }

            const managerId = managerMap.get(user.id);
            if (managerId) {
                const managerReviewerRole = getReviewerRole(managerId);
                if (managerReviewerRole) {
                reviewsToCreate.push({
                    cycleId,
                    employeeId: user.id,
                    reviewerId: managerId,
                    reviewerRole: managerReviewerRole,
                    status: 'draft',
                });
                }
            }

            const managementId = managerId ? managerMap.get(managerId) : undefined;
            if (managementId) {
                const managementReviewerRole = getReviewerRole(managementId);
                if (managementReviewerRole) {
                reviewsToCreate.push({
                    cycleId,
                    employeeId: user.id,
                    reviewerId: managementId,
                    reviewerRole: managementReviewerRole,
                    status: 'draft',
                });
                }
            }
        }

        await this.prisma.review.createMany({
            data: reviewsToCreate,
            skipDuplicates: true,
        });

        return { message: 'Reviews generated successfully' };
    }

    async getMyReviews(
        userId: number,
        page = 1,
        limit = 10,
    ): Promise<{
        items: ReviewResponseDto[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }> {
        const where = {
            OR: [{ reviewerId: userId }, { employeeId: userId }],
        };

        const [reviews, total] = await Promise.all([
            this.prisma.review.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    reviewerRole: true,
                    createdAt: true,
                    cycle: {
                        select: { id: true, name: true, status: true },
                    },
                    employee: {
                        select: { id: true, name: true, email: true },
                    },
                    reviewer: {
                        select: { id: true, name: true, email: true },
                    },
                    responses: {
                        select: {
                            id: true,
                            rating: true,
                            comment: true,
                            point: {
                                select: {
                                    id: true,
                                    title: true,
                                    section: {
                                        select: { id: true, name: true },
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.review.count({ where }),
        ]);

        return {
            items: this.transformReviews(reviews),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    private transformReviews(reviews: any[]): ReviewResponseDto[] {
        return reviews.map((review) => {
            const sectionMap = new Map<number, any>();

            for (const response of review.responses) {
                const section = response.point.section;
                const point = response.point;

                if (!sectionMap.has(section.id)) {
                    sectionMap.set(section.id, {
                        sectionId: section.id,
                        sectionName: section.name,
                        points: new Map<number, any>(),
                    });
                }

                const sectionEntry = sectionMap.get(section.id);

                if (!sectionEntry.points.has(point.id)) {
                    sectionEntry.points.set(point.id, {
                        pointId: point.id,
                        title: point.title,
                        responses: [],
                    });
                }

                sectionEntry.points.get(point.id).responses.push({
                    responseId: response.id,
                    rating: response.rating,
                    comment: response.comment,
                });
            }

            return {
                reviewId: review.id,
                status: review.status,
                reviewerRole: review.reviewerRole,
                cycle: review.cycle,
                employee: review.employee,
                reviewer: review.reviewer,
                sections: Array.from(sectionMap.values()).map((section) => ({
                    sectionId: section.sectionId,
                    sectionName: section.sectionName,
                    points: Array.from(section.points.values()),
                })),
            };
        });
    }

    async getReviewById(id: number, userId: number) {
        const [review, user] = await Promise.all([
            this.prisma.review.findUnique({
                where: { id },
                select: {
                    id: true,
                    status: true,
                    reviewerRole: true,
                    cycleId: true,
                    employeeId: true,
                    reviewerId: true,
                    cycle: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            showManagerResponses: true,
                            showManagementResponses: true,
                        },
                    },
                    employee: {
                        select: { id: true, name: true, email: true },
                    },
                    reviewer: {
                        select: { id: true, name: true, email: true },
                    },
                    responses: {
                        select: {
                            id: true,
                            rating: true,
                            comment: true,
                            pointId: true,
                        },
                    },
                },
            }),
            this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    roles: {
                        select: {
                            role: {
                                select: { name: true },
                            },
                        },
                    },
                },
            }),
        ]);

        if (!review) throw new NotFoundException('Review not found');
        if (!user) throw new NotFoundException('User not found');

        const roles = user.roles.map((r) => r.role.name);

        const isPrivileged =
            roles.includes('admin') || roles.includes('management');

        if (
            !isPrivileged &&
            review.employeeId !== userId &&
            review.reviewerId !== userId
        ) {
            throw new ForbiddenException('You do not have access to this review');
        }

        // Fetch all sibling reviews for same cycle + employee
        const siblingReviews = await this.prisma.review.findMany({
            where: { cycleId: review.cycleId, employeeId: review.employeeId },
            select: {
                reviewerRole: true,
                responses: {
                    select: { id: true, rating: true, comment: true, pointId: true },
                },
            },
        });

        const sections = await this.prisma.section.findMany({
            where: { cycleId: review.cycleId },
            orderBy: { id: 'asc' },
            select: {
                id: true,
                name: true,
                isDynamic: true,
                points: {
                    where: {
                        OR: [{ employeeId: null }, { employeeId: review.employeeId }],
                    },
                    select: { id: true, title: true },
                },
            },
        });

        return this.buildReviewStructure(review, sections, siblingReviews, {
            requesterId: userId,
        });
    }

    private buildReviewStructure(
        review: any,
        sections: any[],
        siblingReviews: any[],
        viewer: { requesterId: number },
    ) {
        const round = (num: number) => Math.round(num * 100) / 100;
        const responseVisibility = this.resolveResponseVisibility(
            review.employeeId,
            viewer.requesterId,
            review.cycle?.showManagerResponses ?? true,
            review.cycle?.showManagementResponses ?? true,
        );
        const canViewRole = (role: 'employee' | 'manager' | 'management') => {
            if (role === 'employee') return true;
            if (role === 'manager') return responseVisibility.showManagerResponses;
            return responseVisibility.showManagementResponses;
        };

        // Build response maps per reviewer role
        const responsesByRole: Record<string, Map<number, any>> = {
            employee: new Map(),
            manager: new Map(),
            management: new Map(),
        };

        for (const sibling of siblingReviews) {
            const role = sibling.reviewerRole as string;
            if (!responsesByRole[role]) responsesByRole[role] = new Map();
            for (const res of sibling.responses) {
                responsesByRole[role].set(res.pointId, res);
            }
        }

        const ratedSectionAverages: number[] = [];

        const transformedSections = sections.map((section) => {
            const isRatedSection = !section.isDynamic;
            const hierarchyRoles = ['employee', 'manager', 'management'];
            let sectionTotal = 0;
            let sectionRatedCount = 0;

            const points = section.points.map((point) => {
                const getResponse = (role: string) => {
                    if (!canViewRole(role as 'employee' | 'manager' | 'management')) {
                        return null;
                    }

                    const res = responsesByRole[role].get(point.id);
                    if (!res) return null;
                    return {
                        responseId: res.id,
                        rating: res.rating,
                        comment: res.comment,
                    };
                };

                if (isRatedSection) {
                    for (const role of hierarchyRoles) {
                        const roleRes = responsesByRole[role]?.get(point.id);
                        if (roleRes && roleRes.rating !== null) {
                            sectionTotal += roleRes.rating;
                            sectionRatedCount++;
                        }
                    }
                }

                return {
                    pointId: point.id,
                    title: point.title,
                    responses: {
                        self: getResponse('employee'),
                        manager: getResponse('manager'),
                        management: getResponse('management'),
                    },
                };
            });

            const sectionAverage = isRatedSection && sectionRatedCount > 0
                ? round(sectionTotal / sectionRatedCount)
                : null;

            if (sectionAverage !== null) {
                ratedSectionAverages.push(sectionAverage);
            }

            return {
                sectionId: section.id,
                sectionName: section.name,
                isDynamic: section.isDynamic,
                sectionAverage,
                points,
            };
        });

        const overallScore = ratedSectionAverages.length > 0
            ? round(ratedSectionAverages.reduce((sum, value) => sum + value, 0) / ratedSectionAverages.length)
            : null;

        return {
            reviewId: review.id,
            status: review.status,
            reviewerRole: review.reviewerRole,
            cycle: review.cycle,
            employee: review.employee,
            reviewer: review.reviewer,
            overallScore,
            responseVisibility,
            sections: transformedSections,
        };
    }

    private async isManagerOfEmployee(managerId: number, employeeId: number) {
        const hierarchy = await this.prisma.userHierarchy.findMany();

        const parentMap = new Map<number, number>();
        for (const rel of hierarchy) {
            parentMap.set(rel.employeeId, rel.managerId);
        }

        return this.isManagerOfEmployeeFromMap(
            managerId,
            employeeId,
            parentMap,
        );
    }

    private isManagerOfEmployeeFromMap(
        managerId: number,
        employeeId: number,
        parentMap: Map<number, number>,
    ) {
        let current = employeeId;

        while (parentMap.has(current)) {
            const manager = parentMap.get(current);
            if (!manager) break;

            if (manager === managerId) return true;
            current = manager;
        }

        return false;
    }

    private async ensureNotLockedByManagementSubmission(
        reviewId: number,
        cycleId: number,
        employeeId: number,
    ) {
        const submittedManagementReview = await this.prisma.review.findFirst({
            where: {
                cycleId,
                employeeId,
                reviewerRole: 'management',
                status: 'submitted',
                id: { not: reviewId },
            },
            select: { id: true },
        });

        if (submittedManagementReview) {
            throw new ForbiddenException(
                'This review is locked because management has already submitted the final review.',
            );
        }
    }

    async getReport(employeeId: number, requesterId: number) {
        // Access check
        const requester = await this.prisma.user.findUnique({
            where: { id: requesterId },
            select: {
                roles: { select: { role: { select: { name: true } } } },
            },
        });

        if (!requester) throw new NotFoundException('User not found');

        const roles = requester.roles.map((r) => r.role.name);
        if (!roles.includes('management') && !roles.includes('admin')) {
            throw new ForbiddenException('Only management and admin can access reports');
        }

        // Find active cycle
        const activeCycle = await this.prisma.cycle.findFirst({
            where: { status: 'active' },
            select: {
                id: true,
                name: true,
                status: true,
                showManagerResponses: true,
                showManagementResponses: true,
            },
        });

        if (!activeCycle) throw new NotFoundException('No active cycle found');

        // Fetch all reviews for this employee in active cycle
        const reviews = await this.prisma.review.findMany({
            where: { employeeId, cycleId: activeCycle.id },
            select: {
                reviewerRole: true,
                responses: {
                    select: { id: true, rating: true, comment: true, pointId: true },
                },
            },
        });

        const employee = await this.prisma.user.findUnique({
            where: { id: employeeId },
            select: { id: true, name: true, email: true },
        });

        if (!employee) throw new NotFoundException('Employee not found');

        const sections = await this.prisma.section.findMany({
            where: { cycleId: activeCycle.id },
            orderBy: { id: 'asc' },
            select: {
                id: true,
                name: true,
                isDynamic: true,
                points: {
                    where: {
                        OR: [{ employeeId: null }, { employeeId }],
                    },
                    select: { id: true, title: true },
                },
            },
        });

        return this.buildReportStructure(employee, activeCycle, sections, reviews, {
            requesterId,
        });
    }

    async getReportSummaries(employeeIds: number[], requesterId: number) {
        const uniqueIds = Array.from(
            new Set(employeeIds.filter((value) => Number.isInteger(value) && value > 0)),
        );

        if (uniqueIds.length === 0) {
            return {} as Record<number, number | null>;
        }

        const requester = await this.prisma.user.findUnique({
            where: { id: requesterId },
            select: {
                roles: { select: { role: { select: { name: true } } } },
            },
        });

        if (!requester) throw new NotFoundException('User not found');

        const roles = requester.roles.map((r) => r.role.name);
        const isPrivileged = roles.includes('admin') || roles.includes('management');
        const isManager = roles.includes('manager');

        let allowedIds = uniqueIds;

        if (!isPrivileged) {
            if (isManager) {
                const relations = await this.prisma.userHierarchy.findMany({
                    where: {
                        managerId: requesterId,
                        employeeId: { in: uniqueIds },
                    },
                    select: { employeeId: true },
                });

                const directReports = new Set(relations.map((rel) => rel.employeeId));
                allowedIds = uniqueIds.filter(
                    (employeeId) => employeeId === requesterId || directReports.has(employeeId),
                );
            } else {
                allowedIds = uniqueIds.filter((employeeId) => employeeId === requesterId);
            }
        }

        if (allowedIds.length === 0) {
            throw new ForbiddenException('You do not have access to these reports');
        }

        const activeCycle = await this.prisma.cycle.findFirst({
            where: { status: 'active' },
            select: { id: true },
        });

        const result: Record<number, number | null> = {};
        for (const employeeId of allowedIds) {
            result[employeeId] = null;
        }

        if (!activeCycle) {
            return result;
        }

        const ratedSections = await this.prisma.section.findMany({
            where: {
                cycleId: activeCycle.id,
                isDynamic: false,
            },
            select: { id: true },
        });

        const allSections = await this.prisma.section.findMany({
            where: {
                cycleId: activeCycle.id,
            },
            select: { id: true },
        });

        const ratedSectionIds = new Set(ratedSections.map((section) => section.id));
        const allSectionIds = new Set(allSections.map((section) => section.id));

        if (ratedSectionIds.size === 0 && allSectionIds.size === 0) {
            return result;
        }

        const reviews = await this.prisma.review.findMany({
            where: {
                cycleId: activeCycle.id,
                employeeId: { in: allowedIds },
            },
            select: {
                employeeId: true,
                responses: {
                    where: { rating: { not: null } },
                    select: {
                        rating: true,
                        point: {
                            select: {
                                sectionId: true,
                            },
                        },
                    },
                },
            },
        });

        const sectionScoresByEmployee = new Map<number, Map<number, { sum: number; count: number }>>();

        for (const review of reviews) {
            if (!sectionScoresByEmployee.has(review.employeeId)) {
                sectionScoresByEmployee.set(review.employeeId, new Map());
            }

            const sectionScores = sectionScoresByEmployee.get(review.employeeId)!;

            for (const response of review.responses) {
                const sectionId = response.point.sectionId;
                if (!ratedSectionIds.has(sectionId) || response.rating == null) {
                    continue;
                }

                const current = sectionScores.get(sectionId) ?? { sum: 0, count: 0 };
                current.sum += response.rating;
                current.count += 1;
                sectionScores.set(sectionId, current);
            }
        }

        const round = (num: number) => Math.round(num * 100) / 100;

        for (const employeeId of allowedIds) {
            const sectionScores = sectionScoresByEmployee.get(employeeId);
            if (!sectionScores || sectionScores.size === 0) {
                continue;
            }

            const sectionAverages = Array.from(sectionScores.values())
                .filter((section) => section.count > 0)
                .map((section) => round(section.sum / section.count));

            if (sectionAverages.length > 0) {
                const overall = sectionAverages.reduce((sum, value) => sum + value, 0) / sectionAverages.length;
                result[employeeId] = round(overall);
            }
        }

        return result;
    }

    async getReportRoleSummaries(employeeIds: number[], requesterId: number) {
        const uniqueIds = Array.from(
            new Set(employeeIds.filter((value) => Number.isInteger(value) && value > 0)),
        );

        if (uniqueIds.length === 0) {
            return {} as Record<number, { employee: number | null; manager: number | null; management: number | null }>;
        }

        const requester = await this.prisma.user.findUnique({
            where: { id: requesterId },
            select: {
                roles: { select: { role: { select: { name: true } } } },
            },
        });

        if (!requester) throw new NotFoundException('User not found');

        const roles = requester.roles.map((r) => r.role.name);
        const isPrivileged = roles.includes('admin') || roles.includes('management');
        const isManager = roles.includes('manager');

        let allowedIds = uniqueIds;

        if (!isPrivileged) {
            if (isManager) {
                const relations = await this.prisma.userHierarchy.findMany({
                    where: {
                        managerId: requesterId,
                        employeeId: { in: uniqueIds },
                    },
                    select: { employeeId: true },
                });

                const directReports = new Set(relations.map((rel) => rel.employeeId));
                allowedIds = uniqueIds.filter(
                    (employeeId) => employeeId === requesterId || directReports.has(employeeId),
                );
            } else {
                allowedIds = uniqueIds.filter((employeeId) => employeeId === requesterId);
            }
        }

        if (allowedIds.length === 0) {
            throw new ForbiddenException('You do not have access to these reports');
        }

        const result: Record<number, { employee: number | null; manager: number | null; management: number | null }> = {};
        for (const employeeId of allowedIds) {
            result[employeeId] = {
                employee: null,
                manager: null,
                management: null,
            };
        }

        const activeCycle = await this.prisma.cycle.findFirst({
            where: { status: 'active' },
            select: { id: true },
        });

        if (!activeCycle) {
            return result;
        }

        const ratedSections = await this.prisma.section.findMany({
            where: {
                cycleId: activeCycle.id,
                isDynamic: false,
            },
            select: { id: true },
        });

        const allSections = await this.prisma.section.findMany({
            where: {
                cycleId: activeCycle.id,
            },
            select: { id: true },
        });

        const ratedSectionIds = new Set(ratedSections.map((section) => section.id));
        const allSectionIds = new Set(allSections.map((section) => section.id));

        if (ratedSectionIds.size === 0 && allSectionIds.size === 0) {
            return result;
        }

        const reviews = await this.prisma.review.findMany({
            where: {
                cycleId: activeCycle.id,
                employeeId: { in: allowedIds },
                reviewerRole: { in: ['employee', 'manager', 'management'] },
            },
            select: {
                employeeId: true,
                reviewerRole: true,
                responses: {
                    where: { rating: { not: null } },
                    select: {
                        rating: true,
                        point: {
                            select: {
                                sectionId: true,
                            },
                        },
                    },
                },
            },
        });

        type SectionScoreMap = Map<number, { sum: number; count: number }>;
        const scoreMap = new Map<number, { employee: SectionScoreMap; manager: SectionScoreMap; management: SectionScoreMap }>();
        const managementPointTotals = new Map<number, { sum: number; count: number }>();

        for (const review of reviews) {
            if (!scoreMap.has(review.employeeId)) {
                scoreMap.set(review.employeeId, {
                    employee: new Map(),
                    manager: new Map(),
                    management: new Map(),
                });
            }

            const roleKey = review.reviewerRole as 'employee' | 'manager' | 'management';
            const employeeScores = scoreMap.get(review.employeeId)!;
            const sectionScores = employeeScores[roleKey];

            for (const response of review.responses) {
                const sectionId = response.point.sectionId;
                const canCountForRole =
                    roleKey === 'management'
                        ? allSectionIds.has(sectionId)
                        : ratedSectionIds.has(sectionId);

                if (!canCountForRole || response.rating == null) {
                    continue;
                }

                const current = sectionScores.get(sectionId) ?? { sum: 0, count: 0 };
                current.sum += response.rating;
                current.count += 1;
                sectionScores.set(sectionId, current);

                if (roleKey === 'management') {
                    const totals = managementPointTotals.get(review.employeeId) ?? { sum: 0, count: 0 };
                    totals.sum += response.rating;
                    totals.count += 1;
                    managementPointTotals.set(review.employeeId, totals);
                }
            }
        }

        const round = (num: number) => Math.round(num * 100) / 100;

        const computeOverall = (sectionScores: SectionScoreMap): number | null => {
            const sectionAverages = Array.from(sectionScores.values())
                .filter((section) => section.count > 0)
                .map((section) => round(section.sum / section.count));

            if (sectionAverages.length === 0) {
                return null;
            }

            return round(
                sectionAverages.reduce((sum, value) => sum + value, 0) / sectionAverages.length,
            );
        };

        for (const employeeId of allowedIds) {
            const employeeScores = scoreMap.get(employeeId);
            if (!employeeScores) continue;

            const managementTotals = managementPointTotals.get(employeeId);
            const managementOverall =
                managementTotals && managementTotals.count > 0
                    ? round(managementTotals.sum / managementTotals.count)
                    : null;

            result[employeeId] = {
                employee: computeOverall(employeeScores.employee),
                manager: computeOverall(employeeScores.manager),
                management: managementOverall,
            };
        }

        return result;
    }

    private buildReportStructure(
        employee: any,
        cycle: any,
        sections: any[],
        reviews: any[],
        viewer: { requesterId: number },
    ) {
        const round = (num: number) => Math.round(num * 100) / 100;
        const responseVisibility = this.resolveResponseVisibility(
            employee.id,
            viewer.requesterId,
            cycle?.showManagerResponses ?? true,
            cycle?.showManagementResponses ?? true,
        );
        const canViewRole = (role: 'employee' | 'manager' | 'management') => {
            if (role === 'employee') return true;
            if (role === 'manager') return responseVisibility.showManagerResponses;
            return responseVisibility.showManagementResponses;
        };

        // Build response maps per reviewerRole
        const responsesByRole: Record<string, Map<number, any>> = {
            employee: new Map(),
            manager: new Map(),
            management: new Map(),
        };

        for (const review of reviews) {
            const role = review.reviewerRole as string;
            if (!responsesByRole[role]) responsesByRole[role] = new Map();
            for (const res of review.responses) {
                responsesByRole[role].set(res.pointId, res);
            }
        }

        const ratedSectionAverages: number[] = [];

        const transformedSections = sections.map((section) => {
            const roleTotals: Record<string, number> = { employee: 0, manager: 0, management: 0 };
            const roleCounts: Record<string, number> = { employee: 0, manager: 0, management: 0 };
            const isRatedSection = !section.isDynamic;
            let sectionTotal = 0;
            let sectionCount = 0;

            const points = section.points.map((point) => {
                const getResponse = (role: string) => {
                    if (!canViewRole(role as 'employee' | 'manager' | 'management')) {
                        return null;
                    }

                    const res = responsesByRole[role]?.get(point.id);
                    if (!res) return null;
                    return {
                        responseId: res.id,
                        rating: res.rating ?? null,
                        comment: res.comment ?? '',
                    };
                };

                // Accumulate per-role section scores
                for (const role of ['employee', 'manager', 'management']) {
                    const res = responsesByRole[role]?.get(point.id);
                    if (res && res.rating !== null) {
                        roleTotals[role] += res.rating;
                        roleCounts[role]++;

                        if (isRatedSection) {
                            sectionTotal += res.rating;
                            sectionCount++;
                        }
                    }
                }

                return {
                    pointId: point.id,
                    title: point.title,
                    responses: {
                        self: getResponse('employee'),
                        manager: getResponse('manager'),
                        management: getResponse('management'),
                    },
                };
            });

            // Per-role section averages
            const sectionAverage: Record<string, number | null> = {};
            for (const role of ['employee', 'manager', 'management']) {
                if (!canViewRole(role as 'employee' | 'manager' | 'management')) {
                    sectionAverage[role] = null;
                    continue;
                }

                sectionAverage[role] =
                    roleCounts[role] > 0 ? round(roleTotals[role] / roleCounts[role]) : null;
            }

            if (isRatedSection && sectionCount > 0) {
                ratedSectionAverages.push(round(sectionTotal / sectionCount));
            }

            return {
                sectionId: section.id,
                sectionName: section.name,
                isDynamic: section.isDynamic,
                sectionAverage,
                points,
            };
        });

        const overallScore = ratedSectionAverages.length > 0
            ? round(ratedSectionAverages.reduce((sum, value) => sum + value, 0) / ratedSectionAverages.length)
            : null;

        return {
            employee,
            cycle,
            overallScore,
            responseVisibility,
            sections: transformedSections,
        };
    }

    private resolveResponseVisibility(
        employeeId: number,
        requesterId: number,
        showManagerResponses: boolean,
        showManagementResponses: boolean,
    ) {
        const isSelfView = employeeId === requesterId;

        return {
            showManagerResponses: !isSelfView || showManagerResponses,
            showManagementResponses: !isSelfView || showManagementResponses,
        };
    }
}