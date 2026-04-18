'use client';

import Image from 'next/image';
import Link from 'next/link';

export function PoweredByBadge() {
    return (
            <div className="powered-by-badge fixed bottom-1 left-1 z-40 max-w-43 rounded-2xl border border-slate-400/30 bg-gray-50/50 p-1.5 shadow-[0_6px_20px_rgba(15,23,42,0.10)] backdrop-blur-md print:fixed print:bottom-2 print:left-2 print:z-50 print:bg-white print:shadow-none print:backdrop-blur-none">
                <Link
                    href="https://riverlearning.in"
                    className="grid grid-cols-1 justify-items-center gap-1"
                >
                    <span className="text-center text-[11px] pt-1 tracking-[0.14em] uppercase text-slate-500">
                        Powered by
                    </span>
                    <div className="rounded-md pb-0.5">
                        <Image
                            src="/company-logo.png"
                            alt="Logo"
                            width={96}
                            height={24}
                            className="h-6 w-auto"
                            priority
                        />
                    </div>
                </Link>
            </div>
    );
}
