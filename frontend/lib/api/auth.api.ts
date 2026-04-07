import { AuthUser, LoginRequest } from "@/types/auth.types";
import apiClient from "./client";
import { clearAccessToken, setAccessToken } from "@/lib/auth/token";

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

function normalizeRoles(roles: string[]): AuthUser['roles'] {
    const allowed = new Set(['employee', 'manager', 'management', 'admin']);

    const normalized = roles
        .map((role) => role.trim().toLowerCase())
        .filter((role): role is AuthUser['roles'][number] => allowed.has(role));

    // Keep client routing usable even if backend role formatting is unexpected.
    return normalized.length > 0 ? normalized : ['employee'];
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
    const fallbackName = nameFromEmail(email);

    try {
        const profileResPromise = apiClient.get<MyProfileResponse>('/users/my-profile');
        const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 2500);
        });

        const profileRes = await Promise.race([profileResPromise, timeoutPromise]);
        if (!profileRes) return fallbackName;

        const profileName = profileRes.data?.data?.name?.trim();
        return profileName || fallbackName;
    } catch {
        return fallbackName;
    }
}

export const authApi = {
    login: async (data: LoginRequest): Promise<{ user: AuthUser }> => {
        const res = await apiClient.post<{ user: { id: number; email: string; roles: string[] }; access_token?: string }>('/auth/login', data);
        const rawUser = res.data.user;
        if (res.data.access_token) {
            setAccessToken(res.data.access_token);
        }
        const name = await getDisplayNameFallback(rawUser.email);

        return {
            user: {
                userId: rawUser.id,
                email: rawUser.email,
                roles: normalizeRoles(rawUser.roles),
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
            roles: normalizeRoles(rawUser.roles),
            name,
        };
    },

    logout: async (): Promise<void> => {
        await apiClient.post('/auth/logout');
        clearAccessToken();
    },
};

export const changePassword = async (
    currentPassword: string,
    newPassword: string,
): Promise<void> => {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
};