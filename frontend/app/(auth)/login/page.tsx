'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import Image from 'next/image';

const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { login, user, isLoading } = useAuthStore();
    const router = useRouter();

    const { register, handleSubmit, setError, formState: { errors } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    useEffect(() => {
        if (user) router.replace('/dashboard');
    }, [user, router]);

    const onSubmit = async (data: LoginForm) => {
        try {
            await login(data.email, data.password);
            router.replace('/dashboard');
        } catch {
            setError('root', { message: 'Invalid email or password' });
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
            <div className="w-full max-w-5xl flex items-center justify-between gap-16">

                {/* Left — Branding */}
                <div className="flex-1 flex flex-col gap-6">
                    {/* Logo placeholder */}
                    <div className="w-20 h-20 rounded-xl flex items-center justify-center">
                        <Image
                            src="/logo.png"
                            alt="Company Logo"
                            width={200}
                            height={100}
                        />
                    </div>
                    <h1 className="text-6xl font-light leading-tight text-gray-900">
                        Appraisal<br />
                        System
                    </h1>
                </div>

                {/* Right — Login card */}
                <div className="w-full max-w-sm bg-[#0d3d5e] rounded-3xl px-10 py-12 flex flex-col gap-6">
                    <h2 className="text-white text-2xl font-semibold text-center">Login</h2>

                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-white text-sm font-medium">Username</label>
                            <input
                                type="email"
                                {...register('email')}
                                className="rounded-full bg-white px-5 py-3 text-gray-900 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                                placeholder="you@company.com"
                            />
                            {errors.email && (
                                <p className="text-cyan-300 text-xs pl-2">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-white text-sm font-medium">Password</label>
                            <input
                                type="password"
                                {...register('password')}
                                className="rounded-full bg-white px-5 py-3 text-gray-900 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
                            />
                            {errors.password && (
                                <p className="text-cyan-300 text-xs pl-2">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Error banner */}
                        {errors.root && (
                            <p className="text-cyan-300 text-sm text-center">{errors.root.message}</p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-2 rounded-full bg-white text-[#0d3d5e] font-semibold py-3 text-sm hover:bg-cyan-50 transition-colors disabled:opacity-60"
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}