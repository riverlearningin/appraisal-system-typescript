import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SectionsService {
    constructor(private prisma: PrismaService) {}

    async getAllSections() {
        const activeCycle = await this.prisma.cycle.findFirst({
            where: { status: 'active' },
            select: { id: true },
        });

        if (!activeCycle) return [];

        return this.prisma.section.findMany({
            where: { cycleId: activeCycle.id },
            orderBy: { id: 'asc' },
            include: {
                points: {
                    where: {
                        employeeId: null,
                    },
                    select: { id: true, title: true, isPredefined: true },
                },
            },
        });
    }

    async createSection(data: { name: string; isDynamic: boolean }) {
        const activeCycle = await this.prisma.cycle.findFirst({
            where: { status: 'active' },
            select: { id: true },
        });

        if (!activeCycle) {
            throw new NotFoundException('No active cycle found');
        }

        return this.prisma.section.create({
            data: {
                cycleId: activeCycle.id,
                name: data.name,
                isDynamic: data.isDynamic,
            },
        });
    }

    async addPoint(sectionId: number, data: { title: string }) {
        const [activeCycle, section] = await Promise.all([
            this.prisma.cycle.findFirst({
                where: { status: 'active' },
                select: { id: true },
            }),
            this.prisma.section.findUnique({ where: { id: sectionId } }),
        ]);

        if (!activeCycle) throw new NotFoundException('No active cycle found');
        if (!section) throw new NotFoundException('Section not found');
        if (section.cycleId !== activeCycle.id) {
            throw new NotFoundException('Section is not in the active cycle');
        }
        if (section.isDynamic) {
            throw new BadRequestException('Points cannot be added to dynamic sections from admin panel');
        }

        return this.prisma.point.create({
            data: {
                sectionId,
                title: data.title,
                isPredefined: true,
            },
        });
    }
}