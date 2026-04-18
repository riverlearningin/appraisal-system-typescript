'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getReportRoleSummaries, reviewsApi } from '@/lib/api/reviews.api';
import { getMyTeam, getAllMyTeam, TeamMember } from '@/lib/api/users.api';
import { ReviewListItem } from '@/types/review.types';

type RoleScoreSummary = {
    employee: number | null;
    manager: number | null;
    management: number | null;
};

export default function DashboardPage() {
    const { activeRole, user, isInitialized } = useAuthStore();
    const router = useRouter();

    const [reviews, setReviews] = useState<ReviewListItem[]>([]);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [scoreByEmployee, setScoreByEmployee] = useState<Record<number, RoleScoreSummary>>({});
    const [loading, setLoading] = useState(true);

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

            let teamMembers: TeamMember[] = [];
            if (activeRole === 'manager') {
                teamMembers = (await getMyTeam()) ?? [];
            } else if (activeRole === 'management' || activeRole === 'admin') {
                teamMembers = (await getAllMyTeam()) ?? [];
            }

            setTeam(teamMembers);

            if (activeRole !== 'employee') {
                try {
                    const summaries = await getReportRoleSummaries(
                        teamMembers.map((member) => member.id),
                    );

                    const normalized = Object.fromEntries(
                        Object.entries(summaries).map(([employeeId, score]) => [
                            Number(employeeId),
                            score,
                        ]),
                    ) as Record<number, RoleScoreSummary>;

                    setScoreByEmployee(normalized);
                } catch {
                    setScoreByEmployee({});
                }
            }
        } catch {
            // silently fail
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-[#0d3d5e] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!activeRole) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-[#0d3d5e] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (activeRole === 'employee') {
        return (
            <EmployeeDashboard
                reviews={reviews}
                userName={user?.name ?? ''}
                router={router}
            />
        );
    }

    return (
        <ManagerDashboard
            reviews={reviews}
            team={team ?? []}
            scoreByEmployee={scoreByEmployee}
            userName={user?.name ?? ''}
            isManagement={activeRole === 'management' || activeRole === 'admin'}
            activeRole={activeRole}
            isAdmin={activeRole === 'admin'}
            canViewReports={activeRole === 'management' || activeRole === 'admin'}
            canPrintScores={activeRole === 'management'}
            router={router}
        />
    );
}

// ── Employee Dashboard ─────────────────────────────────────────

function EmployeeDashboard({
    reviews,
    userName,
    router,
}: {
    reviews: ReviewListItem[];
    userName: string;
    router: ReturnType<typeof useRouter>;
}) {
    const myReview = reviews.find((r) => r.reviewerRole === 'employee');
    const isPending = myReview?.status === 'draft' || !myReview;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Greeting */}
            <div>
                <h1 className="text-2xl font-semibold text-[#0d3d5e]">
                    Welcome, {userName} 👋
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Here's your appraisal overview for the current cycle.
                </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    label="Assigned Reviews"
                    value={reviews.length}
                    sub="in active cycle"
                    color="navy"
                />
                <StatCard
                    label="Review Status"
                    value={myReview ? capitalize(myReview.status) : 'Not Started'}
                    sub={myReview ? `As ${capitalize(myReview.reviewerRole)}` : 'No review assigned'}
                    color={myReview?.status === 'submitted' ? 'green' : 'yellow'}
                />
                <StatCard
                    label="Pending Actions"
                    value={isPending ? '1' : '0'}
                    sub={isPending ? 'Fill your appraisal' : 'All done!'}
                    color={isPending ? 'red' : 'green'}
                />
            </div>

            {/* Pending action banner */}
            {isPending && myReview && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                    <div>
                        <p className="text-sm font-semibold text-amber-800">
                            Your self-appraisal is incomplete
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            Cycle: {myReview.cycle.name}
                        </p>
                    </div>
                    <button
                        onClick={() => router.push(`/reviews/${myReview.reviewId}`)}
                        className="px-4 py-2 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors"
                    >
                        Fill Now
                    </button>
                </div>
            )}

            {!myReview && (
                <div className="flex items-center justify-center h-32 bg-white border border-dashed border-gray-300 rounded-xl text-gray-400 text-sm">
                    No appraisal assigned to you yet.
                </div>
            )}
        </div>
    );
}

// ── Manager / Management Dashboard ────────────────────────────

function ManagerDashboard({
    reviews,
    team,
    scoreByEmployee,
    userName,
    isManagement,
    activeRole,
    isAdmin,
    canViewReports,
    canPrintScores,
    router,
}: {
    reviews: ReviewListItem[];
    team: TeamMember[];
    scoreByEmployee: Record<number, RoleScoreSummary>;
    userName: string;
    isManagement: boolean;
    activeRole: 'manager' | 'management' | 'admin';
    isAdmin: boolean;
    canViewReports: boolean;
    canPrintScores: boolean;
    router: ReturnType<typeof useRouter>;
}) {
    // Map employeeId → review
    const reviewByEmployee = new Map<number, ReviewListItem>();
    for (const r of reviews) {
        reviewByEmployee.set(r.employee.id, r);
    }

    const total = team.length;
    const submitted = team.filter((member) => reviewByEmployee.get(member.id)?.status === 'submitted').length;
    const pending = team.filter((m) => {
        const r = reviewByEmployee.get(m.id);
        return !r || r.status === 'draft';
    });
    const completionPct = total > 0 ? Math.round((submitted / total) * 100) : 0;

    // keep a visible count of draft status among existing review rows
    const pendingCount = pending.length;
    const isManagementDashboard = activeRole === 'management';
    const isAdminDashboard = activeRole === 'admin';

    const handlePrintScores = () => {
        window.print();
    };

    return (
        <div className={`p-6 max-w-5xl mx-auto space-y-6 ${isManagementDashboard ? 'management-print-mode' : ''}`}>
            {/* Greeting */}
            <div className="scores-print-hide">
                <h1 className="text-2xl font-semibold text-[#0d3d5e]">
                    Welcome, {userName} 👋
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {isAdmin
                        ? 'Admin read-only appraisal overview.'
                        : isManagement
                            ? 'Company-wide appraisal overview.'
                            : 'Your team appraisal overview.'}
                </p>
            </div>

            {/* Stat cards */}
            {!isAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 scores-print-hide">
                    <StatCard
                        label="Total Reviews"
                        value={total}
                        sub="assigned to you"
                        color="navy"
                    />
                    <StatCard
                        label="Submitted"
                        value={submitted}
                        sub="completed"
                        color="green"
                    />
                    <StatCard
                        label="Pending"
                        value={pendingCount}
                        sub="still in draft"
                        color="yellow"
                    />
                    <StatCard
                        label="Completion"
                        value={`${completionPct}%`}
                        sub="of reviews done"
                        color="cyan"
                    />
                </div>
            )}

            {/* Progress bar */}
            {!isAdmin && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 scores-print-hide">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Overall Progress</span>
                        <span className="text-gray-500">{submitted} / {total}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                            className="bg-cyan-400 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Pending reviews table */}
            {!isAdmin && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden scores-print-hide">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-[#0d3d5e]">Pending Reviews</h2>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {pending.length} remaining
                        </span>
                    </div>
                    {pending.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                            All reviews submitted 🎉
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600">
                                    <th className="text-left px-5 py-3 font-medium">Employee</th>
                                    <th className="text-left px-5 py-3 font-medium">Cycle</th>
                                    <th className="text-left px-5 py-3 font-medium">Status</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {pending.map((member, i) => {
                                    const r = reviewByEmployee.get(member.id);
                                    return (
                                        <tr
                                            key={member.id}
                                            className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                        >
                                            <td className="px-5 py-3 font-medium text-gray-800">
                                                {member.name}
                                            </td>
                                            <td className="px-5 py-3 text-gray-500">
                                                {r?.cycle.name ?? '—'}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    r?.status === 'draft'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {r?.status ? capitalize(r.status) : 'Not Assigned'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                {r && (
                                                    <button
                                                        onClick={() => router.push(`/reviews/${r.reviewId}`)}
                                                        className="px-3 py-1.5 rounded-full bg-[#0d3d5e] text-white text-xs font-semibold hover:bg-[#0a2e47] transition-colors"
                                                    >
                                                        Fill Review
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Individual scores table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden scores-print-only">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-[#0d3d5e]">Individual Scores</h2>
                    {canPrintScores && (
                        <button
                            onClick={handlePrintScores}
                            className="px-3 py-1.5 rounded-full bg-[#0d3d5e] text-white text-xs font-semibold hover:bg-[#0a2e47] transition-colors print:hidden"
                        >
                            Save PDF
                        </button>
                    )}
                </div>
                {team.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                        No team members found.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600">
                                <th className="text-left px-5 py-3 font-medium">Employee</th>
                                {isManagementDashboard ? (
                                    <th className="text-left px-5 py-3 font-medium">Average Score</th>
                                ) : isAdminDashboard ? (
                                    <>
                                        <th className="text-left px-5 py-3 font-medium">Employee Score</th>
                                        <th className="text-left px-5 py-3 font-medium">Manager Score</th>
                                        <th className="text-left px-5 py-3 font-medium">Management Score</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="text-left px-5 py-3 font-medium">Employee Score</th>
                                        <th className="text-left px-5 py-3 font-medium">Manager Score</th>
                                    </>
                                )}
                                {!isAdmin && <th className="text-left px-5 py-3 font-medium">Status</th>}
                                {canViewReports && <th className="text-left px-5 py-3 font-medium">Action</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {team.map((member, i) => {
                                const r = reviewByEmployee.get(member.id);
                                const score = scoreByEmployee[member.id] ?? {
                                    employee: null,
                                    manager: null,
                                    management: null,
                                };
                                return (
                                    <tr
                                        key={member.id}
                                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                    >
                                        <td className="px-5 py-3 font-medium text-gray-800">
                                            {member.name}
                                        </td>
                                        {isManagementDashboard ? (
                                            <td className="px-5 py-3">
                                                {score.management != null ? (
                                                    <ScorePill score={score.management} />
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                        ) : isAdminDashboard ? (
                                            <>
                                                <td className="px-5 py-3">
                                                    {score.employee != null ? (
                                                        <ScorePill score={score.employee} />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {score.manager != null ? (
                                                        <ScorePill score={score.manager} />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {score.management != null ? (
                                                        <ScorePill score={score.management} />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-5 py-3">
                                                    {score.employee != null ? (
                                                        <ScorePill score={score.employee} />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {score.manager != null ? (
                                                        <ScorePill score={score.manager} />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                        {!isAdmin && (
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    r?.status === 'submitted'
                                                        ? 'bg-green-100 text-green-700'
                                                        : r?.status === 'draft'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {r?.status ? capitalize(r.status) : 'Not Assigned'}
                                                </span>
                                            </td>
                                        )}
                                        {canViewReports && (
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => router.push(`/reports?employeeId=${member.id}`)}
                                                    className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 transition-colors"
                                                >
                                                    View Report
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ── Shared components ──────────────────────────────────────────

const colorMap: Record<string, string> = {
    cyan:   'bg-cyan-50 border-cyan-200 text-cyan-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-amber-50 border-amber-200 text-amber-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    navy:   'bg-[#0d3d5e]/5 border-[#0d3d5e]/20 text-[#0d3d5e]',
};

function StatCard({
    label,
    value,
    sub,
    color,
}: {
    label: string;
    value: string | number;
    sub: string;
    color: string;
}) {
    return (
        <div className={`border rounded-xl p-5 ${colorMap[color] ?? colorMap.navy}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <p className="text-xs mt-1 opacity-60">{sub}</p>
        </div>
    );
}

function ScorePill({ score }: { score: number }) {
    const color =
        score >= 8 ? 'bg-green-100 text-green-700' :
        score >= 5 ? 'bg-amber-100 text-amber-700' :
                     'bg-red-100 text-red-700';
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
            {score.toFixed(1)}
        </span>
    );
}

// ── Helpers ────────────────────────────────────────────────────

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}