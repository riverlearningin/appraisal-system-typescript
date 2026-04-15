'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { reviewsApi } from '@/lib/api/reviews.api';
import { getHttpErrorMessage, isHttpStatus } from '@/lib/api/http-error';
import { getAllUsers } from '@/lib/api/admin.api';
import { ReviewDetail, ReviewSectionDetail, ReviewPointDetail } from '@/types/review.types';

type RoleKey = 'self' | 'manager' | 'management';

// Maps reviewerRole from JWT to the responses key
const roleToKey: Record<string, RoleKey> = {
    employee: 'self',
    manager: 'manager',
    management: 'management',
};

export default function ReviewDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user, activeRole, isInitialized } = useAuthStore();
    const router = useRouter();

    const [review, setReview] = useState<ReviewDetail | null>(null);
    const [activeSectionIdx, setActiveSectionIdx] = useState(0);
    const [drafts, setDrafts] = useState<Record<number, { rating: number | null; comment: string }>>({});
    const [newPointTitle, setNewPointTitle] = useState('');
    const [addingPoint, setAddingPoint] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reviewLoadFailed, setReviewLoadFailed] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [userRolesById, setUserRolesById] = useState<Record<number, string[]>>({});
    const [managerNameByEmployeeId, setManagerNameByEmployeeId] = useState<Record<number, string | null>>({});

    const isSubmitted = review?.status === 'submitted';
    const isReviewer = review?.reviewer.id === user?.userId;
    const canEdit = isReviewer && !isSubmitted;
    const myKey = roleToKey[review?.reviewerRole ?? ''] ?? null;
    const isManagerSelfReview =
        !!review &&
        review.reviewerRole === 'employee' &&
        review.employee.id === review.reviewer.id &&
        (user?.roles.includes('manager') ?? false);
    const isManagementReviewingManager =
        !!review &&
        activeRole === 'management' &&
        ((userRolesById[review.employee.id]?.includes('manager') ?? false) ||
            (userRolesById[review.employee.id]?.includes('management') ?? false));
    const showManagerColumn =
        !(isManagerSelfReview || isManagementReviewingManager) &&
        (review?.responseVisibility.showManagerResponses ?? true);
    const showManagementColumn = review?.responseVisibility.showManagementResponses ?? true;
    const hidePeerRatingsForEmployee = activeRole === 'employee';
    const showManagerRatingColumn = showManagerColumn && !hidePeerRatingsForEmployee;
    const showManagementRatingColumn = showManagementColumn && !hidePeerRatingsForEmployee;

    useEffect(() => {
        if (!isInitialized || activeRole !== 'management') return;

        getAllUsers()
            .then((users) => {
                const map = users.reduce<Record<number, string[]>>((acc, current) => {
                    acc[current.id] = current.roles;
                    return acc;
                }, {});
                const managerMap = users.reduce<Record<number, string | null>>((acc, current) => {
                    acc[current.id] = current.managerName ?? null;
                    return acc;
                }, {});
                setUserRolesById(map);
                setManagerNameByEmployeeId(managerMap);
            })
            .catch(() => {
                setUserRolesById({});
                setManagerNameByEmployeeId({});
            });
    }, [isInitialized, activeRole]);

    useEffect(() => {
        if (!id || !isInitialized || !user) return;

        setReviewLoadFailed(false);
        setError(null);

        reviewsApi
            .getReviewById(Number(id))
            .then((data) => {
                setReview(data);
                const initial: Record<number, { rating: number | null; comment: string }> = {};
                const key = roleToKey[data.reviewerRole];
                for (const section of data.sections) {
                    for (const point of section.points) {
                        const myResponse = point.responses[key];
                        initial[point.pointId] = {
                            rating: myResponse?.rating ?? null,
                            comment: myResponse?.comment ?? '',
                        };
                    }
                }
                setDrafts(initial);
            })
            .catch((err) => {
                if (isHttpStatus(err, 403)) {
                    const params = new URLSearchParams();
                    params.set('from', `/reviews/${id}`);
                    router.replace(`/access-denied?${params.toString()}`);
                    return;
                }

                setReviewLoadFailed(true);
                if (isHttpStatus(err, 404)) {
                    setError('Review not found.');
                } else {
                    setError('Failed to load review. Please try again.');
                }
            });
    }, [id, isInitialized, user?.userId, router]);

    const handleChange = (pointId: number, field: 'rating' | 'comment', value: string | number) => {
        if (!canEdit) return;

        if (field === 'rating') {
            if (value === '') {
                setDrafts((prev) => ({
                    ...prev,
                    [pointId]: { ...prev[pointId], rating: null },
                }));
                return;
            }

            if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
                return;
            }
        }

        setDrafts((prev) => ({
            ...prev,
            [pointId]: { ...prev[pointId], [field]: value },
        }));
    };

    const loadReview = async () => {
        if (!id) return;
        const data = await reviewsApi.getReviewById(Number(id));
        setReview(data);
    };

    const handleAddDynamicPoint = async () => {
        if (!review || !canEdit || review.reviewerRole !== 'employee') return;
        const activeSection = review.sections[activeSectionIdx];
        if (!activeSection?.isDynamic) return;

        const title = newPointTitle.trim();
        if (!title) {
            setError('Point title is required.');
            return;
        }

        setAddingPoint(true);
        setError(null);
        try {
            await reviewsApi.addDynamicPoint({
                reviewId: review.reviewId,
                sectionId: activeSection.sectionId,
                title,
            });
            setNewPointTitle('');
            await loadReview();
        } catch (err) {
            setError(getHttpErrorMessage(err, 'Failed to add dynamic point. Please try again.'));
        } finally {
            setAddingPoint(false);
        }
    };

    const handleSaveDraft = async (): Promise<boolean> => {
        if (!review || !canEdit) return false;
        setSaving(true);
        setError(null);
        const dynamicPointIds = new Set(
            review.sections
                .filter((section) => section.isDynamic)
                .flatMap((section) => section.points.map((point) => point.pointId)),
        );

        try {
            for (const section of review.sections) {
                if (section.isDynamic) continue;

                for (const point of section.points) {
                    const rating = drafts[point.pointId]?.rating;
                    if (rating == null) continue;
                    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
                        setError('Ratings must be whole numbers between 1 and 10.');
                        return false;
                    }
                }
            }

            await Promise.all(
                Object.entries(drafts).map(([pointId, val]) =>
                    reviewsApi.addResponse({
                        reviewId: review.reviewId,
                        pointId: Number(pointId),
                        rating:
                            dynamicPointIds.has(Number(pointId)) && review.reviewerRole !== 'management'
                                ? null
                                : val.rating,
                        comment: val.comment,
                    })
                )
            );
            setDraftSaved(true);
            setTimeout(() => setDraftSaved(false), 2000);
            return true;
        } catch (err) {
            setError(getHttpErrorMessage(err, 'Failed to save draft. Please try again.'));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async () => {
        if (!review || !canEdit) return;

        for (const section of review.sections) {
            for (const point of section.points) {
                const draft = drafts[point.pointId];
                const comment = draft?.comment?.trim() ?? '';
                if (comment.length === 0) {
                    setError('Please complete all accessible comments before submitting.');
                    return;
                }

                if (!section.isDynamic) {
                    const rating = draft?.rating;
                    if (rating == null || Number.isNaN(rating) || rating < 1 || rating > 10) {
                        setError('Please complete all accessible ratings before submitting.');
                        return;
                    }
                }
            }
        }

        const confirmed = window.confirm(
            'No changes can be made after submitting this review. Do you want to continue?',
        );
        if (!confirmed) {
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const saved = await handleSaveDraft();
            if (!saved) {
                return;
            }
            await reviewsApi.submitReview(review.reviewId);
            router.push('/reviews');
        } catch (err) {
            setError(getHttpErrorMessage(err, 'Failed to submit. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (!review && !reviewLoadFailed) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#0d3d5e]" />
            </div>
        );
    }

    if (!review) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-red-500">
                {error ?? 'Unable to load this review.'}
            </div>
        );
    }

    const activeSection: ReviewSectionDetail = review.sections[activeSectionIdx];
    const isDynamic = activeSection.isDynamic;

    return (
        <div className="flex flex-col h-full">

            {(activeRole === 'manager' || activeRole === 'management') && (
                <div className="max-w-sm mb-2 rounded-xl border border-gray-200 bg-slate-100 p-3 text-sm">
                    <div className="grid grid-cols-2 sm:grid-cols-2">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-gray-400">Reviewee Name</p>
                            <p className="font-semibold text-gray-700">{review.employee.name}</p>
                        </div>
                        {(() => {
                            const reviewedRoles = userRolesById[review.employee.id] ?? [];
                            const isReviewedManager = reviewedRoles.includes('manager') || reviewedRoles.includes('management');
                            const reviewedRoleLabel = reviewedRoles.includes('management') ? 'Management' : 'Manager';
                            const managerName =
                                activeRole === 'manager'
                                    ? review.reviewer.name
                                    : (managerNameByEmployeeId[review.employee.id] ?? null);

                            if (isReviewedManager) {
                                return (
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-gray-400">Role</p>
                                        <p className="font-semibold text-gray-700">{reviewedRoleLabel}</p>
                                    </div>
                                );
                            }

                            return (
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-400">Manager Name</p>
                                    <p className="font-semibold text-gray-700">{managerName ?? '—'}</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Section tabs */}
            <div className="flex gap-2 flex-wrap px-1 mb-6">
                {review.sections.map((section, idx) => (
                    <button
                        key={section.sectionId}
                        onClick={() => setActiveSectionIdx(idx)}
                        className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${idx === activeSectionIdx
                                ? 'bg-cyan-400 text-white'
                                : 'bg-[#0d3d5e] text-white hover:bg-[#0a2e47]'
                            }`}
                    >
                        {section.sectionName}
                    </button>
                ))}
            </div>

            {/* Section content card */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">

                {/* Section title + meta */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-[#0d3d5e] text-xl font-semibold">
                            {activeSection.sectionName}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            {isSubmitted && (
                                <span className="text-xs bg-green-100 text-green-700 px-3 py-0.5 rounded-full font-medium">
                                    Submitted
                                </span>
                            )}
                            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-0.5 rounded-full">
                                {isDynamic ? 'Comments only' : 'Rated (lowest to highest: 1–10)'}
                            </span>
                        </div>
                    </div>
                    {activeSection.sectionAverage !== null && (
                        <span className="text-sm text-gray-500">
                            Section avg:{' '}
                            <span className="font-semibold text-[#0d3d5e]">
                                {activeSection.sectionAverage}
                            </span>
                        </span>
                    )}
                </div>

                {isDynamic && canEdit && review.reviewerRole === 'employee' && (
                    <div className="mb-5 border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <p className="text-xs text-gray-500 mb-2">Add point (employee dynamic section)</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                value={newPointTitle}
                                onChange={(e) => setNewPointTitle(e.target.value)}
                                placeholder="e.g. Initiative on ad-hoc work"
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                            />
                            <button
                                onClick={handleAddDynamicPoint}
                                disabled={addingPoint}
                                className="px-4 py-2 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors disabled:opacity-60"
                            >
                                {addingPoint ? 'Adding...' : 'Add Point'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-[#0d3d5e] text-white">
                                <th className="text-left px-4 py-3 font-medium border border-[#0a2e47] w-1/5">
                                    Point
                                </th>
                                {!isDynamic && (
                                    <th className="px-4 py-3 font-medium border border-[#0a2e47] text-center">
                                        Self Rating
                                    </th>
                                )}
                                <th className="px-4 py-3 font-medium border border-[#0a2e47] text-center">
                                    Self Comment
                                </th>
                                {!isDynamic && showManagerRatingColumn && (
                                    <th className="px-4 py-3 font-medium border border-[#0a2e47] text-center">
                                        Manager Rating
                                    </th>
                                )}
                                {showManagerColumn && (
                                    <th className="px-4 py-3 font-medium border border-[#0a2e47] text-center">
                                        Manager Comment
                                    </th>
                                )}
                                {showManagementRatingColumn && (!isDynamic || review.reviewerRole === 'management') && (
                                    <th className="px-4 py-3 font-medium border border-[#0a2e47] text-center">
                                        Management Rating
                                    </th>
                                )}
                                {showManagementColumn && (
                                    <th className="px-4 py-3 font-medium border border-[#0a2e47] text-center">
                                        Management Comment
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {activeSection.points.map((point, i) => (
                                <PointRow
                                    key={point.pointId}
                                    point={point}
                                    isDynamic={isDynamic}
                                    myKey={myKey}
                                    draft={drafts[point.pointId]}
                                    canEdit={canEdit}
                                    striped={i % 2 !== 0}
                                    showManagerColumn={showManagerColumn}
                                    showManagementColumn={showManagementColumn}
                                    showManagerRatingColumn={showManagerRatingColumn}
                                    showManagementRatingColumn={showManagementRatingColumn}
                                    allowDynamicManagementRating={review.reviewerRole === 'management'}
                                    onChange={(field, val) => handleChange(point.pointId, field, val)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

                {canEdit && (
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={handleSaveDraft}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-full bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300 transition-colors disabled:opacity-60"
                        >
                            {saving ? 'Saving...' : draftSaved ? '✓ Draft Saved' : 'Save Draft'}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || saving}
                            className="px-6 py-2.5 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors disabled:opacity-60"
                        >
                            {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── PointRow ──────────────────────────────────────────────────

interface PointRowProps {
    point: ReviewPointDetail;
    isDynamic: boolean;
    myKey: RoleKey | null;
    draft: { rating: number | null; comment: string } | undefined;
    canEdit: boolean;
    striped: boolean;
    showManagerColumn: boolean;
    showManagementColumn: boolean;
    showManagerRatingColumn: boolean;
    showManagementRatingColumn: boolean;
    allowDynamicManagementRating: boolean;
    onChange: (field: 'rating' | 'comment', value: string | number) => void;
}

function PointRow({
    point,
    isDynamic,
    myKey,
    draft,
    canEdit,
    striped,
    showManagerColumn,
    showManagementColumn,
    showManagerRatingColumn,
    showManagementRatingColumn,
    allowDynamicManagementRating,
    onChange,
}: PointRowProps) {
    const bg = striped ? 'bg-gray-50' : 'bg-white';

    const renderCell = (roleKey: RoleKey, field: 'rating' | 'comment') => {
        const isMe = canEdit && myKey === roleKey;
        const savedVal = point.responses[roleKey];

        if (isMe) {
            if (field === 'rating') {
                return (
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="^(10|[1-9])$"
                        maxLength={2}
                        value={draft?.rating || ''}
                        onKeyDown={(e) => {
                            if (['e', 'E', '.', '-', '+', ','].includes(e.key)) {
                                e.preventDefault();
                            }
                        }}
                        onChange={(e) => {
                            const raw = e.target.value.trim();

                            if (raw === '') {
                                onChange('rating', '');
                                return;
                            }

                            if (!/^(10|[1-9])$/.test(raw)) {
                                return;
                            }

                            onChange('rating', Number(raw));
                        }}
                        placeholder="1–10"
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                );
            }
            return (
                <textarea
                    value={draft?.comment || ''}
                    onChange={(e) => onChange('comment', e.target.value)}
                    placeholder="Add comment..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
                />
            );
        }

        // Read-only
        if (field === 'rating') {
            return savedVal?.rating != null
                ? <span className="font-medium text-[#0d3d5e]">{savedVal.rating}</span>
                : <span className="text-gray-300">—</span>;
        }
        return savedVal?.comment
            ? <span className="text-gray-700">{savedVal.comment}</span>
            : <span className="text-gray-300">—</span>;
    };

    return (
        <tr className={bg}>
            <td className="px-4 py-3 font-medium text-gray-800 border border-gray-200 align-top">
                {point.title}
            </td>

            {/* Self */}
            {!isDynamic && (
                <td className="px-3 py-2 border border-gray-200 align-top min-w-25 text-center">
                    {renderCell('self', 'rating')}
                </td>
            )}
            <td className="px-3 py-2 border border-gray-200 align-top min-w-45">
                {renderCell('self', 'comment')}
            </td>

            {/* Manager */}
            {!isDynamic && showManagerRatingColumn && (
                <td className="px-3 py-2 border border-gray-200 align-top min-w-25 text-center">
                    {renderCell('manager', 'rating')}
                </td>
            )}
            {showManagerColumn && (
                <td className="px-3 py-2 border border-gray-200 align-top min-w-45">
                    {renderCell('manager', 'comment')}
                </td>
            )}

            {/* Management */}
            {showManagementRatingColumn && (!isDynamic || allowDynamicManagementRating) && (
                <td className="px-3 py-2 border border-gray-200 align-top min-w-25 text-center">
                    {renderCell('management', 'rating')}
                </td>
            )}
            {showManagementColumn && (
                <td className="px-3 py-2 border border-gray-200 align-top min-w-45">
                    {renderCell('management', 'comment')}
                </td>
            )}
        </tr>
    );
}