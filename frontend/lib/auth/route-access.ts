import { Role } from '@/types/auth.types';

interface RoutePolicy {
    pattern: RegExp;
    allowedRoles: Role[];
}

const ROUTE_POLICIES: RoutePolicy[] = [
    // Access denied page should be reachable for any authenticated role.
    { pattern: /^\/access-denied$/, allowedRoles: ['employee', 'manager', 'management', 'admin'] },

    // Admin-only pages
    { pattern: /^\/admin\/users(?:\/.*)?$/, allowedRoles: ['admin'] },
    { pattern: /^\/admin\/cycles(?:\/.*)?$/, allowedRoles: ['admin'] },
    { pattern: /^\/admin\/sections(?:\/.*)?$/, allowedRoles: ['admin'] },

    // Review fill and review list pages (admin is read-only and should not fill reviews)
    { pattern: /^\/reviews(?:\/\d+)?$/, allowedRoles: ['employee', 'manager', 'management'] },

    // Shared dashboard pages
    { pattern: /^\/dashboard$/, allowedRoles: ['employee', 'manager', 'management', 'admin'] },
    { pattern: /^\/reports$/, allowedRoles: ['management'] },
    { pattern: /^\/profile$/, allowedRoles: ['employee', 'manager', 'management', 'admin'] },
];

export function getAllowedRolesForPath(pathname: string): Role[] | null {
    const match = ROUTE_POLICIES.find((policy) => policy.pattern.test(pathname));
    return match ? match.allowedRoles : null;
}

export function canAccessPath(pathname: string, activeRole: Role | null): boolean {
    const allowedRoles = getAllowedRolesForPath(pathname);
    if (!allowedRoles || !activeRole) return false;
    return allowedRoles.includes(activeRole);
}
