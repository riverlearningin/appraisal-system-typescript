'use client';

import { useAuthStore } from '@/store/auth.store';
import { Role } from '@/types/auth.types';

interface RoleGuardProps {
    allowedRoles: Role[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
    const { user, activeRole, isInitialized } = useAuthStore();

    if (!isInitialized) return null;
    if (!user || !activeRole) return <>{fallback}</>;
    if (!user.roles.includes(activeRole)) return <>{fallback}</>;

    const hasAccess = allowedRoles.includes(activeRole);

    return hasAccess ? <>{children}</> : <>{fallback}</>;
}