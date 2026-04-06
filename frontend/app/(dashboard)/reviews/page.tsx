'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { reviewsApi } from '@/lib/api/reviews.api';
import { getAllUsers } from '@/lib/api/admin.api';
import { getMyTeam, getAllMyTeam, TeamMember } from '@/lib/api/users.api';
import { ReviewListItem } from '@/types/review.types';

export default function ReviewsPage() {
    const router = useRouter();
    const { activeRole, user, isInitialized } = useAuthStore();

    const [reviews, setReviews] = useState<ReviewListItem[]>([]);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [userRolesById, setUserRolesById] = useState<Record<number, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isInitialized || !activeRole || !user) return;
        fetchData();
    }, [isInitialized, activeRole, user?.userId]);

    const fetchData = async () => {
        if (!activeRole || !user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const reviewsData = await getMyReviewsWithRetry();
            const allReviews = reviewsData.items;

            // Filter to only reviews matching current role
            const roleMap: Record<string, string> = {
                employee: 'employee',
                manager: 'manager',
                management: 'management',
                admin: 'management',
            };

            const filtered = activeRole
                ? allReviews.filter(
                    (r) =>
                        r.reviewerRole === roleMap[activeRole] &&
                        r.reviewer.id === user.userId &&
                        r.cycle.status === 'active',
                )
                : allReviews;

            setReviews(filtered);

            if (activeRole === 'manager') {
                setTeam(await getMyTeam() ?? []);
                setUserRolesById({});
            } else if (activeRole === 'management') {
                setTeam(await getAllMyTeam() ?? []);

                const users = await getAllUsers();
                const roleMap = users.reduce<Record<number, string[]>>((acc, current) => {
                    acc[current.id] = current.roles;
                    return acc;
                }, {});
                setUserRolesById(roleMap);
            }
        } catch {
            setError('Failed to load reviews.');
        } finally {
            setLoading(false);
        }
    };

    const getMyReviewsWithRetry = async () => {
        try {
            return await reviewsApi.getMyReviews(1, 100);
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return reviewsApi.getMyReviews(1, 100);
        }
    };

    const handleRowClick = (reviewId: number) => {
        router.push(`/reviews/${reviewId}`);
    };

    const getReviewForEmployee = (employeeId: number) =>
        reviews.find((r) => r.employee.id === employeeId);

    const getScoreDisplay = (review: ReviewListItem) => {
        const allResponses = review.sections?.flatMap((s) =>
            s.points?.flatMap((p) => p.responses ?? []) ?? []
        ) ?? [];
        const ratings = allResponses.filter((r) => r.rating != null).map((r) => r.rating!);
        if (!ratings.length) return '—';
        return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
    };

    const statusBadge = (status: string) => {
        const base = 'px-2 py-0.5 rounded-full text-xs font-medium';
        return status === 'submitted'
            ? `${base} bg-green-100 text-green-700`
            : `${base} bg-yellow-100 text-yellow-700`;
    };

    const roleBadge = (role: string) => {
        const base = 'px-2 py-0.5 rounded-full text-xs font-medium';
        const colors: Record<string, string> = {
            self: 'bg-cyan-100 text-cyan-700',
            manager: 'bg-blue-100 text-blue-700',
            management: 'bg-purple-100 text-purple-700',
        };
        return `${base} ${colors[role] ?? 'bg-gray-100 text-gray-600'}`;
    };

    const employeeRoleBadge = (roles: string[]) => {
        const isManager = roles.includes('manager');
        const isManagement = roles.includes('management');

        if (isManagement) {
            return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700">Management</span>;
        }
        if (isManager) {
            return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">Manager</span>;
        }
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-100 text-cyan-700">Employee</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-[#0d3d5e] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500 text-sm">
                {error}
            </div>
        );
    }

    // ── Employee view ──────────────────────────────────────────────
    if (activeRole === 'employee') {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <h1 className="text-xl font-semibold text-[#0d3d5e] mb-6">My Reviews</h1>
                {reviews.length === 0 ? (
                    <EmptyState message="No reviews assigned to you yet." />
                ) : (
                    <ReviewTable
                        rows={reviews.map((r) => ({
                            reviewId: r.reviewId,
                            employeeName: r.employee.name,
                            reviewerName: r.reviewer.name,
                            reviewerRole: r.reviewerRole,
                            score: getScoreDisplay(r),
                            status: r.status,
                        }))}
                        onRowClick={handleRowClick}
                        statusBadge={statusBadge}
                        roleBadge={roleBadge}
                    />
                )}
            </div>
        );
    }

    // ── Manager / Management view ──────────────────────────────────
    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-xl font-semibold text-[#0d3d5e] mb-6">
                {activeRole === 'manager' ? 'My Team Reviews' : 'Company Reviews'}
            </h1>
            {team.length === 0 ? (
                <EmptyState message="No team members found." />
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[#0d3d5e] text-white">
                                <th className="text-left px-4 py-3 font-medium">Employee</th>
                                <th className="text-left px-4 py-3 font-medium">Your Role</th>
                                <th className="text-left px-4 py-3 font-medium">Score</th>
                                <th className="text-left px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.map((member, i) => {
                                const review = getReviewForEmployee(member.id);
                                return (
                                    <tr
                                        key={member.id}
                                        onClick={() => review && handleRowClick(review.reviewId)}
                                        className={[
                                            i % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                                            review
                                                ? 'cursor-pointer hover:bg-cyan-50 transition-colors'
                                                : 'opacity-50 cursor-not-allowed',
                                        ].join(' ')}
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            <div className="flex items-center gap-2">
                                                <span>{member.name}</span>
                                                {activeRole === 'management' && employeeRoleBadge(userRolesById[member.id] ?? [])}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {review ? (
                                                <span className={roleBadge(review.reviewerRole)}>
                                                    {formatLabel(review.reviewerRole)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Not assigned</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {review ? getScoreDisplay(review) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {review ? (
                                                <span className={statusBadge(review.status)}>{formatLabel(review.status)}</span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Shared subcomponents ───────────────────────────────────────

interface ReviewTableRow {
    reviewId: number;
    employeeName: string;
    reviewerName: string;
    reviewerRole: string;
    score: string;
    status: string;
}

function ReviewTable({
    rows,
    onRowClick,
    statusBadge,
    roleBadge,
}: {
    rows: ReviewTableRow[];
    onRowClick: (id: number) => void;
    statusBadge: (s: string) => string;
    roleBadge: (r: string) => string;
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-[#0d3d5e] text-white">
                        <th className="text-left px-4 py-3 font-medium">Employee</th>
                        <th className="text-left px-4 py-3 font-medium">Reviewer</th>
                        <th className="text-left px-4 py-3 font-medium">Role</th>
                        <th className="text-left px-4 py-3 font-medium">Score</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={row.reviewId}
                            onClick={() => onRowClick(row.reviewId)}
                            className={[
                                i % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                                'cursor-pointer hover:bg-cyan-50 transition-colors',
                            ].join(' ')}
                        >
                            <td className="px-4 py-3 font-medium text-gray-800">{row.employeeName}</td>
                            <td className="px-4 py-3 text-gray-600">{row.reviewerName}</td>
                            <td className="px-4 py-3">
                                <span className={roleBadge(row.reviewerRole)}>{formatLabel(row.reviewerRole)}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{row.score}</td>
                            <td className="px-4 py-3">
                                <span className={statusBadge(row.status)}>{formatLabel(row.status)}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-48 bg-white border border-dashed border-gray-300 rounded-xl text-gray-400 text-sm">
            <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {message}
        </div>
    );
}

function formatLabel(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}