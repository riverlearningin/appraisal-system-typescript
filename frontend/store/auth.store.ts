import { authApi } from "@/lib/api/auth.api";
import { AuthUser, Role } from "@/types/auth.types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
    user: AuthUser | null;
    activeRole: Role | null;
    isLoading: boolean;
    isInitialized: boolean; // Has /me been called on app boot?

    setUser: (user: AuthUser | null) => void;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    initialize: () => Promise<void>; // Called once on app boot
    switchRole: (role: Role) => void;
    hasRole: (role: AuthUser['roles'][number]) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            activeRole: null,
            isLoading: false,
            isInitialized: false,

            setUser: (user) => set({ user }),

            login: async (email, password) => {
                set({ isLoading: true });
                try {
                    const { user: loginUser } = await authApi.login({ email, password });

                    // Wait for cookie-backed session to be readable via /me.
                    // This avoids transient post-login states where dashboard APIs can read as unauthenticated.
                    let resolvedUser = loginUser;
                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            resolvedUser = await authApi.me();
                            break;
                        } catch {
                            if (attempt < 2) {
                                await new Promise((resolve) => setTimeout(resolve, 150));
                            }
                        }
                    }

                    const activeRole = resolveDefaultRole(resolvedUser.roles);
                    set({ user: resolvedUser, activeRole, isLoading: false, isInitialized: true });
                } catch (err) {
                    set({ isLoading: false });
                    throw err; // Let the form handle the error message
                }
            },

            logout: async () => {
                await authApi.logout();
                set({ user: null, activeRole: null });
            },

            // Called in root layout - rehydrates user from cookie on refresh
            initialize: async () => {
                try {
                    const user = await authApi.me();
                    const current = get().activeRole;
                    const activeRole = 
                        current && user.roles.includes(current)
                            ? current
                            : resolveDefaultRole(user.roles);
                    set({ user, activeRole, isInitialized: true });
                } catch {
                    set({ user: null, activeRole: null, isInitialized: true });
                }
            },

            switchRole: (role: Role) => {
                const { user } = get();
                if (!user) return;
                if (!user.roles.includes(role)) return;
                set({ activeRole: role });
            },

            hasRole: (role) => {
                return get().user?.roles.includes(role) ?? false;
            },
        }),
        {
            name: 'auth-store',
            partialize: (state) => ({ activeRole: state.activeRole }), // Only persist activeRole - user is rehydrated
        }
    )
);

const ROLE_PRIORITY: Role[] = ['admin', 'management', 'manager', 'employee'];

function resolveDefaultRole(roles: Role[]): Role {
    for (const role of ROLE_PRIORITY) {
        if (roles.includes(role)) return role;
    }
    return 'employee';
}