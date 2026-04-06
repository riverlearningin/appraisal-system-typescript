'use client';

import { useEffect, useState } from 'react';
import {
    getAllCycles,
    createCycle,
    updateCycleStatus,
    updateCycleResponseVisibility,
    generateReviews,
    AdminCycle,
} from '@/lib/api/admin.api';
import { PageSpinner, AdminCard, FormInput, FormSelect, FormFooter } from '../_components';

const STATUS_OPTIONS = ['inactive', 'active', 'closed'];

export default function AdminCyclesPage() {
    const [cycles, setCycles] = useState<AdminCycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
    const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState<Record<number, string>>({});

    const refresh = async () => {
        const data = await getAllCycles();
        setCycles(data);
    };

    useEffect(() => {
        refresh().finally(() => setLoading(false));
    }, []);

    const handleCreate = async () => {
        if (!form.name || !form.startDate || !form.endDate) {
            setFormMsg({ ok: false, text: 'All fields are required.' });
            return;
        }
        setFormLoading(true);
        setFormMsg(null);
        try {
            await createCycle(form);
            setFormMsg({ ok: true, text: 'Cycle created successfully.' });
            setForm({ name: '', startDate: '', endDate: '' });
            await refresh();
        } catch (e: any) {
            setFormMsg({ ok: false, text: e?.response?.data?.message ?? 'Failed to create cycle.' });
        } finally {
            setFormLoading(false);
        }
    };

    const handleStatusChange = async (id: number, status: string) => {
        try {
            await updateCycleStatus(id, status);
            setActionMsg((p) => ({ ...p, [id]: `Status updated to ${status}` }));
            setTimeout(() => setActionMsg((p) => ({ ...p, [id]: '' })), 2000);
            await refresh();
        } catch (e: any) {
            setActionMsg((p) => ({ ...p, [id]: 'Failed to update status' }));
        }
    };

    const handleGenerate = async (cycleId: number) => {
        try {
            await generateReviews(cycleId);
            setActionMsg((p) => ({ ...p, [cycleId]: 'Reviews generated!' }));
            setTimeout(() => setActionMsg((p) => ({ ...p, [cycleId]: '' })), 2000);
        } catch (e: any) {
            setActionMsg((p) => ({ ...p, [cycleId]: e?.response?.data?.message ?? 'Failed to generate reviews.' }));
        }
    };

    const handleVisibilityChange = async (
        cycle: AdminCycle,
        key: 'showManagerResponses' | 'showManagementResponses',
        checked: boolean,
    ) => {
        try {
            await updateCycleResponseVisibility(cycle.id, {
                showManagerResponses:
                    key === 'showManagerResponses' ? checked : cycle.showManagerResponses,
                showManagementResponses:
                    key === 'showManagementResponses' ? checked : cycle.showManagementResponses,
            });
            setActionMsg((p) => ({ ...p, [cycle.id]: 'Visibility settings updated' }));
            setTimeout(() => setActionMsg((p) => ({ ...p, [cycle.id]: '' })), 2000);
            await refresh();
        } catch {
            setActionMsg((p) => ({ ...p, [cycle.id]: 'Failed to update visibility settings' }));
        }
    };

    if (loading) return <PageSpinner />;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold text-[#0d3d5e]">Manage Cycles</h1>

            {/* Create cycle */}
            <AdminCard title="Create New Cycle">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormInput label="Cycle Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="e.g. Q1 2026" />
                    <FormInput label="Start Date" value={form.startDate} onChange={(v) => setForm((p) => ({ ...p, startDate: v }))} type="date" />
                    <FormInput label="End Date" value={form.endDate} onChange={(v) => setForm((p) => ({ ...p, endDate: v }))} type="date" />
                </div>
                <FormFooter msg={formMsg} loading={formLoading} onSubmit={handleCreate} label="Create Cycle" />
            </AdminCard>

            {/* Cycles table */}
            <AdminCard title="All Cycles">
                {cycles.length === 0 ? (
                    <p className="text-sm text-gray-400">No cycles found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0d3d5e] text-white">
                                    <th className="text-left px-4 py-3 font-medium">Name</th>
                                    <th className="text-left px-4 py-3 font-medium">Start</th>
                                    <th className="text-left px-4 py-3 font-medium">End</th>
                                    <th className="text-left px-4 py-3 font-medium">Status</th>
                                    <th className="text-left px-4 py-3 font-medium">Visibility</th>
                                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cycles.map((cycle, i) => (
                                    <tr key={cycle.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 font-medium text-gray-800">{cycle.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(cycle.startDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(cycle.endDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={cycle.status}
                                                onChange={(e) => handleStatusChange(cycle.id, e.target.value)}
                                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-cyan-400"
                                            >
                                                {STATUS_OPTIONS.map((s) => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-2 text-xs text-gray-700">
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={cycle.showManagerResponses}
                                                        onChange={(e) =>
                                                            handleVisibilityChange(
                                                                cycle,
                                                                'showManagerResponses',
                                                                e.target.checked,
                                                            )
                                                        }
                                                        className="h-4 w-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-400"
                                                    />
                                                    Show manager responses
                                                </label>
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={cycle.showManagementResponses}
                                                        onChange={(e) =>
                                                            handleVisibilityChange(
                                                                cycle,
                                                                'showManagementResponses',
                                                                e.target.checked,
                                                            )
                                                        }
                                                        className="h-4 w-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-400"
                                                    />
                                                    Show management responses
                                                </label>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 space-x-2">
                                            <button
                                                onClick={() => handleGenerate(cycle.id)}
                                                className="px-3 py-1.5 rounded-full bg-[#0d3d5e] text-white text-xs font-semibold hover:bg-[#0a2e47] transition-colors"
                                            >
                                                Generate Reviews
                                            </button>
                                            {actionMsg[cycle.id] && (
                                                <span className="text-xs text-green-600">{actionMsg[cycle.id]}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminCard>
        </div>
    );
}