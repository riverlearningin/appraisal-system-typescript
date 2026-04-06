'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { getMyProfile, UserProfile } from '@/lib/api/users.api';
import { changePassword } from '@/lib/api/auth.api';

const roleColors: Record<string, string> = {
    employee:   'bg-cyan-100 text-cyan-700',
    manager:    'bg-blue-100 text-blue-700',
    management: 'bg-purple-100 text-purple-700',
    admin:      'bg-red-100 text-red-700',
};

export default function ProfilePage() {
    const { user } = useAuthStore();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Change password state
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwSuccess, setPwSuccess] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => {
        getMyProfile()
            .then(setProfile)
            .catch(() => setError('Failed to load profile.'))
            .finally(() => setLoading(false));
    }, []);

    const handlePasswordChange = async () => {
        setPwError(null);
        setPwSuccess(false);

        if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
            setPwError('All fields are required.');
            return;
        }
        if (pwForm.next !== pwForm.confirm) {
            setPwError('New passwords do not match.');
            return;
        }
        if (pwForm.next.length < 6) {
            setPwError('Password must be at least 6 characters.');
            return;
        }

        setPwLoading(true);
        try {
            await changePassword(pwForm.current, pwForm.next);
            setPwSuccess(true);
            setPwForm({ current: '', next: '', confirm: '' });
        } catch (err: any) {
            const msg = err?.response?.data?.message;
            setPwError(msg ?? 'Failed to change password. Please try again.');
        } finally {
            setPwLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-[#0d3d5e] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500 text-sm">
                {error ?? 'Profile not found.'}
            </div>
        );
    }

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold text-[#0d3d5e]">My Profile</h1>

            {/* Info card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">

                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#0d3d5e] flex items-center justify-center text-white text-xl font-bold select-none">
                        {profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-gray-800">{profile.name}</p>
                        <p className="text-sm text-gray-500">{profile.email}</p>
                    </div>
                </div>

                <hr className="border-gray-100" />

                {/* Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Full Name" value={profile.name} />
                    <Field label="Email" value={profile.email} />
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                            Roles
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {profile.roles.map((role) => (
                                <span
                                    key={role}
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[role] ?? 'bg-gray-100 text-gray-600'}`}
                                >
                                    {capitalize(role)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <Field
                        label="Manager"
                        value={profile.manager?.name ?? 'No manager assigned'}
                    />
                </div>
            </div>

            {/* Change password card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-[#0d3d5e]">Change Password</h2>

                <PasswordInput
                    label="Current Password"
                    value={pwForm.current}
                    onChange={(v) => setPwForm((p) => ({ ...p, current: v }))}
                />
                <PasswordInput
                    label="New Password"
                    value={pwForm.next}
                    onChange={(v) => setPwForm((p) => ({ ...p, next: v }))}
                />
                <PasswordInput
                    label="Confirm New Password"
                    value={pwForm.confirm}
                    onChange={(v) => setPwForm((p) => ({ ...p, confirm: v }))}
                />

                {pwError && (
                    <p className="text-sm text-red-500">{pwError}</p>
                )}
                {pwSuccess && (
                    <p className="text-sm text-green-600">Password changed successfully.</p>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={handlePasswordChange}
                        disabled={pwLoading}
                        className="px-6 py-2.5 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors disabled:opacity-60"
                    >
                        {pwLoading ? 'Saving...' : 'Update Password'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {label}
            </p>
            <p className="text-sm text-gray-800">{value}</p>
        </div>
    );
}

function PasswordInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                {label}
            </label>
            <div className="relative">
                <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400 pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                    {show ? 'Hide' : 'Show'}
                </button>
            </div>
        </div>
    );
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}