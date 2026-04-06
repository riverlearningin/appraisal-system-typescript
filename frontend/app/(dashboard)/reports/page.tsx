'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getReport } from '@/lib/api/reviews.api';
import { isHttpStatus } from '@/lib/api/http-error';
import { getAllUsers } from '@/lib/api/admin.api';
import { getMyTeam, getAllMyTeam, TeamMember } from '@/lib/api/users.api';
import { ReportDetail, ReportSectionDetail, ReportPointDetail } from '@/types/review.types';

export default function ReportsPage() {
    const { activeRole, user, isInitialized } = useAuthStore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const printRef = useRef<HTMLDivElement>(null);

    const [team, setTeam] = useState<TeamMember[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [report, setReport] = useState<ReportDetail | null>(null);
    const [userRolesById, setUserRolesById] = useState<Record<number, string[]>>({});
    const [activeSectionIdx, setActiveSectionIdx] = useState(0);
    const [loading, setLoading] = useState(false);
    const [teamLoading, setTeamLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isManager = activeRole === 'manager' || activeRole === 'management' || activeRole === 'admin';
    const isEmployee = activeRole === 'employee';

    const formatLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

    const getPrimaryRole = (roles: string[]): string => {
        if (roles.includes('admin')) return 'Admin';
        if (roles.includes('management')) return 'Management';
        if (roles.includes('manager')) return 'Manager';
        return 'Employee';
    };

    const resolveSubjectRole = (employeeId: number): string => {
        const knownRoles = userRolesById[employeeId];
        if (knownRoles && knownRoles.length > 0) {
            return getPrimaryRole(knownRoles);
        }

        if (user?.userId === employeeId && user.roles?.length) {
            return getPrimaryRole(user.roles);
        }

        return 'Employee';
    };

    const loadReport = useCallback(async (employeeId: number) => {
        setLoading(true);
        setError(null);
        setReport(null);
        setActiveSectionIdx(0);
        try {
            const data = await getReport(employeeId);
            setReport(data);
        } catch (error) {
            if (isHttpStatus(error, 403)) {
                const params = new URLSearchParams();
                params.set('from', pathname);
                router.replace(`/access-denied?${params.toString()}`);
                return;
            }
            setError('Failed to load report. The employee may not have an active cycle review.');
        } finally {
            setLoading(false);
        }
    }, [pathname, router]);

    // Load team for manager/management
    useEffect(() => {
        if (!isInitialized || !isManager || !user) return;
        setTeamLoading(true);
        const fn = activeRole === 'manager' ? getMyTeam : getAllMyTeam;
        fn()
            .then(setTeam)
            .finally(() => setTeamLoading(false));
    }, [isInitialized, activeRole, isManager, user?.userId]);

    useEffect(() => {
        if (!isInitialized || (activeRole !== 'management' && activeRole !== 'admin')) return;

        getAllUsers()
            .then((users) => {
                const map = users.reduce<Record<number, string[]>>((acc, current) => {
                    acc[current.id] = current.roles;
                    return acc;
                }, {});
                setUserRolesById(map);
            })
            .catch(() => setUserRolesById({}));
    }, [isInitialized, activeRole]);

    // Auto-load own report for employee
    useEffect(() => {
        if (!isInitialized || activeRole !== 'employee' || !user) return;

        const rawEmployeeId = searchParams.get('employeeId');
        if (rawEmployeeId) {
            const requested = Number(rawEmployeeId);
            if (!Number.isFinite(requested) || requested !== user.userId) {
                const params = new URLSearchParams();
                params.set('from', pathname);
                router.replace(`/access-denied?${params.toString()}`);
                return;
            }
        }

        if (isInitialized && activeRole === 'employee' && user) {
            loadReport(user.userId);
        }
    }, [isInitialized, activeRole, user?.userId, searchParams, pathname, router, loadReport]);

    const handleEmployeeSelect = (id: number) => {
        setSelectedEmployeeId(id);

        const params = new URLSearchParams(searchParams.toString());
        params.set('employeeId', String(id));
        router.replace(`${pathname}?${params.toString()}`);

        loadReport(id);
    };

    useEffect(() => {
        if (!isManager || teamLoading || team.length === 0) return;

        const rawEmployeeId = searchParams.get('employeeId');
        if (!rawEmployeeId) return;

        const employeeId = Number(rawEmployeeId);
        if (!Number.isFinite(employeeId) || !team.some((member) => member.id === employeeId)) {
            const params = new URLSearchParams();
            params.set('from', pathname);
            router.replace(`/access-denied?${params.toString()}`);
            return;
        }

        setSelectedEmployeeId(employeeId);
        loadReport(employeeId);
    }, [isManager, teamLoading, team, searchParams, loadReport, pathname, router]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 print:w-full print:items-center print:justify-between print:pl-1">
                    <h1 className="text-2xl font-semibold text-[#0d3d5e] print:text-black">Appraisal Report</h1>
                    <img
                        src="/logo.png"
                        alt="Company Logo"
                        className="hidden h-8 w-8 object-contain print:block"
                    />
                </div>
                {report && (
                    <button
                        onClick={handlePrint}
                        className="px-5 py-2 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors print:hidden"
                    >
                        Save PDF
                    </button>
                )}
            </div>

            {/* Employee picker for manager/management */}
            {isManager && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 print:hidden">
                    <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
                        Select Employee
                    </label>
                    {teamLoading ? (
                        <div className="w-5 h-5 border-2 border-[#0d3d5e] border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <select
                            value={selectedEmployeeId ?? ''}
                            onChange={(e) => handleEmployeeSelect(Number(e.target.value))}
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                        >
                            <option value="" disabled>Choose an employee...</option>
                            {team.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center h-48">
                    <div className="w-6 h-6 border-2 border-[#0d3d5e] border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="flex items-center justify-center h-48 text-red-500 text-sm">
                    {error}
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && !report && (
                <div className="flex items-center justify-center h-48 bg-white border border-dashed border-gray-300 rounded-xl text-gray-400 text-sm">
                    {isManager ? 'Select an employee to view their report.' : 'No report available.'}
                </div>
            )}

            {/* Report */}
            {report && !loading && (
                <div ref={printRef} className="space-y-6">
                    {(() => {
                        const subjectRole = resolveSubjectRole(report.employee.id);
                        const showManagerColumn =
                            subjectRole !== 'Manager' &&
                            subjectRole !== 'Management' &&
                            report.responseVisibility.showManagerResponses;
                        const showManagementColumn = report.responseVisibility.showManagementResponses;

                        return (
                            <>

                    {/* Report header — visible in print */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 print:border-none print:p-0 print:pl-2">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">User</p>
                                <p className="text-xl font-bold text-[#0d3d5e]">{report.employee.name}</p>
                                <p className="text-sm text-gray-500">{report.employee.email}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cycle</p>
                                <p className="text-base font-semibold text-gray-700">{report.cycle.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    report.cycle.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {formatLabel(report.cycle.status)}
                                </span>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Role</p>
                                <span className="inline-flex mt-2 px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700">
                                    {subjectRole}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Section tabs — hidden in print */}
                    <div className="flex gap-2 flex-wrap print:hidden">
                        {report.sections.map((section, idx) => (
                            <button
                                key={section.sectionId}
                                onClick={() => setActiveSectionIdx(idx)}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                                    idx === activeSectionIdx
                                        ? 'bg-cyan-400 text-white'
                                        : 'bg-[#0d3d5e] text-white hover:bg-[#0a2e47]'
                                }`}
                            >
                                {section.sectionName}
                            </button>
                        ))}
                    </div>

                    {/* Screen view — single active section */}
                    <div className="print:hidden">
                        <SectionReport
                            section={report.sections[activeSectionIdx]}
                            showManagerColumn={showManagerColumn}
                            showManagementColumn={showManagementColumn}
                        />
                    </div>

                    {/* Print view — all sections */}
                    <div className="hidden print:block space-y-8">
                        {report.sections.map((section) => (
                            <SectionReport
                                key={section.sectionId}
                                section={section}
                                showManagerColumn={showManagerColumn}
                                showManagementColumn={showManagementColumn}
                            />
                        ))}
                    </div>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

// ── Section report ─────────────────────────────────────────────

function SectionReport({
    section,
    showManagerColumn,
    showManagementColumn,
}: {
    section: ReportSectionDetail;
    showManagerColumn: boolean;
    showManagementColumn: boolean;
}) {
    const isDynamic = section.isDynamic;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

            {/* Section header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-[#0d3d5e] text-base">{section.sectionName}</h2>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {isDynamic ? 'Comments only' : 'Rated'}
                    </span>
                </div>
                {!isDynamic && (
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <AverageChip label="Self" value={section.sectionAverage.employee} />
                        {showManagerColumn && (
                            <AverageChip label="Manager" value={section.sectionAverage.manager} />
                        )}
                        {showManagementColumn && (
                            <AverageChip label="Management" value={section.sectionAverage.management} />
                        )}
                    </div>
                )}
            </div>

            {/* Points table */}
            <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm border-collapse table-auto print:table-fixed">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600">
                            <th className="text-left px-4 py-3 font-medium border border-gray-100 w-1/5">
                                Point
                            </th>
                            {!isDynamic && (
                                <th className="px-4 py-3 font-medium border border-gray-100 text-center">
                                    Self Rating
                                </th>
                            )}
                            <th className="px-4 py-3 font-medium border border-gray-100 text-center">
                                Self Comment
                            </th>
                            {!isDynamic && showManagerColumn && (
                                <th className="px-4 py-3 font-medium border border-gray-100 text-center">
                                    Manager Rating
                                </th>
                            )}
                            {showManagerColumn && (
                                <th className="px-4 py-3 font-medium border border-gray-100 text-center">
                                    Manager Comment
                                </th>
                            )}
                            {!isDynamic && showManagementColumn && (
                                <th className="px-4 py-3 font-medium border border-gray-100 text-center">
                                    Management Rating
                                </th>
                            )}
                            {showManagementColumn && (
                                <th className="px-4 py-3 font-medium border border-gray-100 text-center">
                                    Management Comment
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {section.points.map((point, i) => (
                            <ReportPointRow
                                key={point.pointId}
                                point={point}
                                isDynamic={isDynamic}
                                showManagerColumn={showManagerColumn}
                                showManagementColumn={showManagementColumn}
                                striped={i % 2 !== 0}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Point row ──────────────────────────────────────────────────

function ReportPointRow({
    point,
    isDynamic,
    showManagerColumn,
    showManagementColumn,
    striped,
}: {
    point: ReportPointDetail;
    isDynamic: boolean;
    showManagerColumn: boolean;
    showManagementColumn: boolean;
    striped: boolean;
}) {
    const bg = striped ? 'bg-gray-50' : 'bg-white';
    const { self, manager, management } = point.responses;

    const RatingCell = ({ val }: { val: number | null | undefined }) => (
        <td className={`px-4 py-3 border border-gray-100 text-center align-top print:px-2 print:py-2 ${bg}`}>
            {val != null ? (
                <span className={`font-semibold text-sm ${
                    val >= 8 ? 'text-green-600' :
                    val >= 5 ? 'text-amber-500' :
                    'text-red-500'
                }`}>{val}</span>
            ) : (
                <span className="text-gray-300">—</span>
            )}
        </td>
    );

    const CommentCell = ({ val }: { val: string | null | undefined }) => (
        <td className={`px-4 py-3 border border-gray-100 align-top min-w-40 print:min-w-0 print:px-2 print:py-2 ${bg}`}>
            {val ? (
                <span className="text-gray-700 text-sm wrap-break-word whitespace-pre-wrap">{val}</span>
            ) : (
                <span className="text-gray-300 text-xs">—</span>
            )}
        </td>
    );

    return (
        <tr>
            <td className={`px-4 py-3 border border-gray-100 font-medium text-gray-800 align-top wrap-break-word print:px-2 print:py-2 print:text-xs ${bg}`}>
                {point.title}
            </td>
            {!isDynamic && <RatingCell val={self?.rating} />}
            <CommentCell val={self?.comment} />
            {!isDynamic && showManagerColumn && <RatingCell val={manager?.rating} />}
            {showManagerColumn && <CommentCell val={manager?.comment} />}
            {!isDynamic && showManagementColumn && <RatingCell val={management?.rating} />}
            {showManagementColumn && <CommentCell val={management?.comment} />}
        </tr>
    );
}

// ── Helpers ────────────────────────────────────────────────────

function AverageChip({ label, value }: { label: string; value: number | null }) {
    return (
        <span className="flex items-center gap-1">
            <span className="opacity-60">{label}:</span>
            <span className={`font-semibold ${
                value == null ? 'text-gray-300' :
                value >= 8 ? 'text-green-600' :
                value >= 5 ? 'text-amber-500' :
                'text-red-500'
            }`}>
                {value != null ? value.toFixed(1) : '—'}
            </span>
        </span>
    );
}