export type ReviewStatus = 'draft' | 'submitted';
export type ReviewerRole = 'employee' | 'manager' | 'management' | 'admin';

export interface PaginatedReviews {
    items: ReviewListItem[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface ReviewListItem {
    reviewId: number;
    status: ReviewStatus;
    reviewerRole: ReviewerRole;
    cycle: { id: number; name: string; status: string; };
    employee: { id: number; name: string; email: string; };
    reviewer: { id: number; name: string; email: string; };
    sections: ReviewSection[];
}

export interface ReviewDetail {
    reviewId: number;
    status: ReviewStatus;
    reviewerRole: ReviewerRole;
    cycle: { id: number; name: string; status: string; };
    employee: { id: number; name: string; email: string; };
    reviewer: { id: number; name: string; email: string; };
    overallScore: number | null;
    responseVisibility: {
        showManagerResponses: boolean;
        showManagementResponses: boolean;
    };
    sections: ReviewSectionDetail[];
}

export interface ReviewSectionDetail {
    sectionId: number;
    sectionName: string;
    isDynamic: boolean;
    sectionAverage: number | null;
    points: ReviewPointDetail[];
}

export interface ReviewPointDetail {
    pointId: number;
    title: string;
    responses: {
        self: ReviewPointResponse | null;
        manager: ReviewPointResponse | null;
        management: ReviewPointResponse | null;
    };
}

export interface ReviewPointResponse {
    responseId: number;
    rating: number | null;
    comment: string;
}

export interface ReviewSection {
    sectionId: number;
    sectionName: string;
    points: ReviewPoint[];
}

export interface ReviewPoint {
    pointId: number;
    title: string;
    responses: { responseId: number; rating: number; comment: string; }[];
}

export interface ManagerReviewItem {
    id: number;
    employeeId: number;
    status: ReviewStatus;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface ReportPointResponse {
    responseId: number;
    rating: number | null;
    comment: string;
}

export interface ReportPointDetail {
    pointId: number;
    title: string;
    responses: {
        self: ReportPointResponse | null;
        manager: ReportPointResponse | null;
        management: ReportPointResponse | null;
    };
}

export interface ReportSectionDetail {
    sectionId: number;
    sectionName: string;
    isDynamic: boolean;
    sectionAverage: {
        employee: number | null;
        manager: number | null;
        management: number | null;
    };
    points: ReportPointDetail[];
}

export interface ReportDetail {
    employee: { id: number; name: string; email: string };
    cycle: { id: number; name: string; status: string };
    overallScore: number | null;
    responseVisibility: {
        showManagerResponses: boolean;
        showManagementResponses: boolean;
    };
    sections: ReportSectionDetail[];
}