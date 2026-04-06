'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function AccessDeniedPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get('from');

    return (
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-5 rounded-2xl border border-red-100 bg-white p-10 text-center shadow-sm">
            <p className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                Access denied
            </p>
            <h1 className="text-2xl font-bold text-slate-800">You do not have permission to access this page.</h1>
            {from && (
                <p className="text-sm text-slate-500">
                    Requested path: {from}
                </p>
            )}
            <button
                onClick={() => router.replace('/dashboard')}
                className="rounded-full bg-[#0d3d5e] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0a2e47]"
            >
                Go to Dashboard
            </button>
        </div>
    );
}
