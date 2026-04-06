import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { PoweredByBadge } from '@/components/layout/PoweredByBadge';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Appraisal System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className={inter.className}>
            <AuthInitializer />
            {children}
            <PoweredByBadge />
        </body>
        </html>
    )
}