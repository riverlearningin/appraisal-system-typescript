'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Role } from '@/types/auth.types';
import Link from 'next/link';
import Image from 'next/image';

const ROLE_LABELS: Record<Role, string> = {
    employee: 'Employee',
    manager: 'Manager',
    management: 'Management',
    admin: 'Admin',
};

interface HeaderProps {
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
}

export function Header({ isSidebarOpen, onToggleSidebar }: HeaderProps) {
    const { user, activeRole, switchRole, logout } = useAuthStore();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    return (
        <header className="relative z-60 flex items-center justify-between px-6 py-2 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2">
                <button
                    onClick={onToggleSidebar}
                    className="z-60 flex flex-col gap-1.5 p-2"
                    aria-label="Toggle sidebar"
                >
                    <span className={`block h-0.5 w-5 bg-[#0d3d5e] transition-all ${isSidebarOpen ? 'translate-y-2 rotate-45' : ''}`} />
                    <span className={`block h-0.5 w-5 bg-[#0d3d5e] transition-all ${isSidebarOpen ? 'opacity-0' : ''}`} />
                    <span className={`block h-0.5 w-5 bg-[#0d3d5e] transition-all ${isSidebarOpen ? '-translate-y-2 -rotate-45' : ''}`} />
                </button>

                <Link href="/dashboard" className="flex items-center gap-2">
                    <h1 className="text-[#0d3d5e] text-xl font-semibold tracking-tight">
                        Appraisal System
                    </h1>
                </Link>
            </div>

            {/* Avatar + dropdown */}
            <div className="relative flex items-center gap-5" ref={ref}>
                <Image
                    src="/logo.png"
                    alt="Company Logo"
                    width={36}
                    height={36}
                    className="h-11 w-11 object-contain"
                    priority
                />
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="w-10 h-10 rounded-full bg-[#0d3d5e] flex items-center justify-center hover:bg-[#0a2e47] transition-colors"
                >
                    {/* Person icon */}
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                </button>

                {open && (
                    <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 z-50">
                        {/* Profile label */}
                        <div className="px-4 pb-2 border-b border-gray-100">
                            <p className="font-semibold text-gray-900 text-sm">
                                {user?.name || 'User'}
                            </p>
                        </div>

                        <div className="py-2">
                            <button
                                onClick={() => { router.push('/profile'); setOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                View Profile
                            </button>

                            {/* Switch Role — only if user has multiple roles */}
                            {user && user.roles.length > 1 && (
                                <div className="px-4 py-2">
                                    <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                                        Switch Role
                                    </p>
                                    <div className="flex flex-col gap-1">
                                        {user.roles.map((role) => (
                                            <button
                                                key={role}
                                                onClick={() => {
                                                    switchRole(role);
                                                    setOpen(false);
                                                    router.replace('/dashboard');
                                                }}
                                                className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                                                    activeRole === role
                                                        ? 'bg-[#0d3d5e] text-white'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                {ROLE_LABELS[role]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100 pt-2">
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 font-medium"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}