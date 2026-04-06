// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

interface NavItem {
    label: string;
    href: string;
    roles: string[]; // which activeRoles can see this
}

const NAV_ITEMS: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        roles: ['employee', 'manager', 'management', 'admin'],
    },
    {
        label: 'Fill Appraisal',
        href: '/reviews',
        roles: ['employee', 'manager', 'management'],
    },
    {
        label: 'Print Appraisal Report',
        href: '/reports',
        roles: ['management'],
    },
    {
        label: 'Manage Users',
        href: '/admin/users',
        roles: ['admin'],
    },
    {
        label: 'Manage Cycles',
        href: '/admin/cycles',
        roles: ['admin'],
    },
    {
        label: 'Manage Sections',
        href: '/admin/sections',
        roles: ['admin'],
    }
];

interface SidebarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
    const { activeRole } = useAuthStore();
    const pathname = usePathname();

    const visibleItems = NAV_ITEMS.filter(
        (item) => activeRole && item.roles.includes(activeRole)
    );

    return (
        <>
            {/* Overlay */}
            {open && (
                <div
                    className="fixed inset-0 z-30 bg-black/20"
                    onClick={() => onOpenChange(false)}
                />
            )}

            {/* Drawer */}
            <nav className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-40 transform transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="pt-16 px-6">
                    <p className="text-[#0d3d5e] text-xl font-bold mb-8">Menu</p>
                    <div className="flex flex-col gap-1">
                        {visibleItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onOpenChange(false)}
                                className={`px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                                    pathname === item.href
                                        ? 'text-[#0d3d5e] bg-blue-50'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>
        </>
    );
}