'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export default function Home() {
    const router = useRouter();
    const { user, isInitialized } = useAuthStore();

    useEffect(() => {
        if (!isInitialized) return;
        router.replace(user ? '/dashboard' : '/login');
    }, [isInitialized, user, router]);

    return (
        <div className="flex h-screen items-center justify-center bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700" />
        </div>
    );
}
