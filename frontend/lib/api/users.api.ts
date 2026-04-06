import api from './client';
import { ApiResponse } from '@/types/review.types';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
}

export const getMyTeam = async (): Promise<TeamMember[]> => {
    const res = await api.get<ApiResponse<TeamMember[]>>('/users/my-team');
    return res.data.data ?? [];
};

export const getAllMyTeam = async (): Promise<TeamMember[]> => {
    const res = await api.get<ApiResponse<TeamMember[]>>('/users/my-team-all');
    return res.data.data ?? [];
};

export interface UserProfile {
    id: number;
    name: string;
    email: string;
    roles: string[];
    manager: { id: number; name: string } | null;
}

export const getMyProfile = async (): Promise<UserProfile> => {
    const res = await api.get<ApiResponse<UserProfile>>('/users/my-profile');
    return res.data.data;
};