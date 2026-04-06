import { AuthUser, LoginRequest } from "@/types/auth.types";
import apiClient from "./client";

interface AuthMeResponse {
    userId: number;
    email: string;
    roles: string[];
}

interface MyProfileResponse {
    success: boolean;
    data: {
        id: number;
        name: string;
        email: string;
        roles: string[];
    };
}

function nameFromEmail(email: string): string {
    const localPart = email.split('@')[0] ?? 'User';
    if (!localPart) return 'User';
    return localPart
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

async function getDisplayNameFallback(email: string): Promise<string> {
    try {
        const profileRes = await apiClient.get<MyProfileResponse>('/users/my-profile');
        const profileName = profileRes.data?.data?.name?.trim();
        return profileName || nameFromEmail(email);
    } catch {
        return nameFromEmail(email);
    }
}

export const authApi = {
    login: async (data: LoginRequest): Promise<{ user: AuthUser }> => {
        const res = await apiClient.post<{ user: { id: number; email: string; roles: string[] } }>('/auth/login', data);
        const rawUser = res.data.user;
        const name = await getDisplayNameFallback(rawUser.email);

        return {
            user: {
                userId: rawUser.id,
                email: rawUser.email,
                roles: rawUser.roles as AuthUser['roles'],
                name,
            },
        };
    },

    me: async (): Promise<AuthUser> => {
        const res = await apiClient.get<AuthMeResponse>('/auth/me');
        const rawUser = res.data;
        const name = await getDisplayNameFallback(rawUser.email);

        return {
            userId: rawUser.userId,
            email: rawUser.email,
            roles: rawUser.roles as AuthUser['roles'],
            name,
        };
    },

    logout: async (): Promise<void> => {
        await apiClient.post('/auth/logout');
    },
};

export const changePassword = async (
    currentPassword: string,
    newPassword: string,
): Promise<void> => {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
};