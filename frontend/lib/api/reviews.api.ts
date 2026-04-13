// src/lib/api/reviews.api.ts
import apiClient from './client';
import { ApiResponse, PaginatedReviews, ReviewDetail, ManagerReviewItem, ReportDetail } from '@/types/review.types';

export const reviewsApi = {
    // GET /reviews/my?page=1&limit=10
    getMyReviews: async (page = 1, limit = 10): Promise<PaginatedReviews> => {
        const res = await apiClient.get<ApiResponse<PaginatedReviews>>(
            `/reviews/my`,
            { params: { page, limit } }
        );
        return res.data.data;
    },

    // GET /reviews/:id
    getReviewById: async (id: number): Promise<ReviewDetail> => {
        const res = await apiClient.get<ApiResponse<ReviewDetail>>(
            `/reviews/${id}`
        );
        return res.data.data;
    },

    // GET /reviews/manager
    getManagerReviews: async (): Promise<ManagerReviewItem[]> => {
        const res = await apiClient.get<ApiResponse<ManagerReviewItem[]>>(
            `/reviews/manager`
        );
        return res.data.data;
    },

    // POST /reviews/add-response
    addResponse: async (data: {
        reviewId: number;
        pointId: number;
        rating: number | null;
        comment: string;
    }): Promise<void> => {
        await apiClient.post('/reviews/add-response', data);
    },

    // POST /reviews/add-dynamic-point
    addDynamicPoint: async (data: {
        reviewId: number;
        sectionId: number;
        title: string;
    }): Promise<void> => {
        await apiClient.post('/reviews/add-dynamic-point', data);
    },

    // POST /reviews/submit/:id
    submitReview: async (reviewId: number): Promise<void> => {
        await apiClient.post(`/reviews/submit/${reviewId}`);
    },

    // POST /reviews/create
    createReview: async (data: {
        cycleId: number;
        employeeId: number;
    }): Promise<void> => {
        await apiClient.post('/reviews/create', data);
    },
};

export const getReport = async (employeeId: number): Promise<ReportDetail> => {
    const res = await apiClient.get<ApiResponse<ReportDetail>>(`/reviews/report/${employeeId}`);
    return res.data.data;
};

export const getReportSummaries = async (
    employeeIds: number[],
): Promise<Record<number, number | null>> => {
    if (employeeIds.length === 0) return {};

    const res = await apiClient.get<ApiResponse<Record<number, number | null>>>(
        '/reviews/report-summaries',
        {
            params: {
                employeeIds: employeeIds.join(','),
            },
        },
    );

    return res.data.data;
};

export const getReportRoleSummaries = async (
    employeeIds: number[],
): Promise<Record<number, { employee: number | null; manager: number | null; management: number | null }>> => {
    if (employeeIds.length === 0) return {};

    const res = await apiClient.get<
        ApiResponse<Record<number, { employee: number | null; manager: number | null; management: number | null }>>
    >('/reviews/report-role-summaries', {
        params: {
            employeeIds: employeeIds.join(','),
        },
    });

    return res.data.data;
};

