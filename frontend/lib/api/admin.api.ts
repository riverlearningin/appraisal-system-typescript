import api from './client';
import { ApiResponse } from '@/types/review.types';

// ── Types ──────────────────────────────────────────────────────

export interface AdminUser {
    id: number;
    name: string;
    email: string;
    disabled: boolean;
    roles: string[];
    managerId: number | null;
    managerName: string | null;
}

export interface AdminCycle {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    showManagerResponses: boolean;
    showManagementResponses: boolean;
}

export interface AdminSection {
    id: number;
    name: string;
    isDynamic: boolean;
    points: { id: number; title: string; isPredefined: boolean }[];
}

export interface AdminRole {
    id: number;
    name: string;
}

// ── Users ──────────────────────────────────────────────────────

export const getAllUsers = async (): Promise<AdminUser[]> => {
    const res = await api.get<ApiResponse<AdminUser[]>>('/users');
    return res.data.data ?? [];
};

export const getAllRoles = async (): Promise<AdminRole[]> => {
    const res = await api.get<ApiResponse<AdminRole[]>>('/users/roles');
    return res.data.data ?? [];
};

export const createUser = async (data: {
    name: string;
    email: string;
    password: string;
}): Promise<void> => {
    await api.post('/users', data);
};

export const assignRole = async (userId: number, roleName: string): Promise<void> => {
    await api.post('/users/assign-role', { userId, roleName });
};

export const assignManager = async (employeeId: number, managerId: number): Promise<void> => {
    await api.post('/users/assign-manager', { employeeId, managerId });
};

export const updateUser = async (
    id: number,
    data: { name: string; email: string; roleNames: string[] },
): Promise<void> => {
    await api.patch(`/users/${id}`, data);
};

export const setUserDisabled = async (id: number, disabled: boolean): Promise<void> => {
    await api.patch(`/users/${id}/disabled`, { disabled });
};

export const deleteUser = async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
};

// ── Cycles ─────────────────────────────────────────────────────

export const getAllCycles = async (): Promise<AdminCycle[]> => {
    const res = await api.get<ApiResponse<AdminCycle[]>>('/cycles');
    return res.data.data ?? [];
};

export const createCycle = async (data: {
    name: string;
    startDate: string;
    endDate: string;
}): Promise<void> => {
    await api.post('/cycles', data);
};

export const updateCycleStatus = async (id: number, status: string): Promise<void> => {
    await api.patch(`/cycles/${id}/status`, { status });
};

export const updateCycleResponseVisibility = async (
    id: number,
    data: { showManagerResponses: boolean; showManagementResponses: boolean },
): Promise<void> => {
    await api.patch(`/cycles/${id}/response-visibility`, data);
};

export const generateReviews = async (cycleId: number): Promise<void> => {
    await api.post(`/reviews/generate/${cycleId}`, {});
};

// ── Sections ───────────────────────────────────────────────────

export const getAllSections = async (): Promise<AdminSection[]> => {
    const res = await api.get<ApiResponse<AdminSection[]>>('/sections');
    return res.data.data ?? [];
};

export const createSection = async (data: {
    name: string;
    isDynamic: boolean;
}): Promise<void> => {
    await api.post('/sections', data);
};

export const addPoint = async (
    sectionId: number,
    data: { title: string },
): Promise<void> => {
    await api.post(`/sections/${sectionId}/points`, data);
};