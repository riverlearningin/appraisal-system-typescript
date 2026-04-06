'use client';

import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { usePathname } from 'next/navigation';
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { canAccessPath } from '@/lib/auth/route-access';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, activeRole, isInitialized } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const redirectToAccessDenied = () => {
        const params = new URLSearchParams();
        params.set('from', pathname);
        router.replace(`/access-denied?${params.toString()}`);
    };

    useEffect(() => {
        if (!isInitialized) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        if (!activeRole || !user.roles.includes(activeRole)) {
            redirectToAccessDenied();
            return;
        }

        if (!canAccessPath(pathname, activeRole)) {
            redirectToAccessDenied();
        }
    }, [user, activeRole, pathname, isInitialized, router]);

    // Don't flash the dashboard before auth resolves
    if (!isInitialized) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700" />
            </div>
        );
    }

    if (!user || !activeRole || !user.roles.includes(activeRole)) return null;

    if (!canAccessPath(pathname, activeRole)) return null;

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar open={isSidebarOpen} onOpenChange={setSidebarOpen} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
                />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}