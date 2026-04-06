'use client';

import { useEffect, useState } from 'react';
import {
    getAllSections, createSection, addPoint, AdminSection,
} from '@/lib/api/admin.api';
import { PageSpinner, AdminCard, FormInput, FormFooter } from '../_components';

export default function AdminSectionsPage() {
    const [sections, setSections] = useState<AdminSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [sectionForm, setSectionForm] = useState({ name: '', isDynamic: false });
    const [sectionMsg, setSectionMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [sectionLoading, setSectionLoading] = useState(false);
    const [pointForms, setPointForms] = useState<Record<number, { title: string }>>({});
    const [pointMsgs, setPointMsgs] = useState<Record<number, { ok: boolean; text: string }>>({});
    const [pointLoadings, setPointLoadings] = useState<Record<number, boolean>>({});
    const [expandedSection, setExpandedSection] = useState<number | null>(null);

    const refresh = async () => {
        const data = await getAllSections();
        setSections(data);
    };

    useEffect(() => {
        refresh().finally(() => setLoading(false));
    }, []);

    const handleCreateSection = async () => {
        if (!sectionForm.name) {
            setSectionMsg({ ok: false, text: 'Section name is required.' });
            return;
        }
        setSectionLoading(true);
        setSectionMsg(null);
        try {
            await createSection(sectionForm);
            setSectionMsg({ ok: true, text: 'Section created successfully.' });
            setSectionForm({ name: '', isDynamic: false });
            await refresh();
        } catch (e: any) {
            setSectionMsg({ ok: false, text: e?.response?.data?.message ?? 'Failed to create section.' });
        } finally {
            setSectionLoading(false);
        }
    };

    const handleAddPoint = async (section: AdminSection) => {
        if (section.isDynamic) {
            setPointMsgs((p) => ({
                ...p,
                [section.id]: { ok: false, text: 'Dynamic sections do not allow admin-created points.' },
            }));
            return;
        }

        const sectionId = section.id;
        const form = pointForms[sectionId];
        if (!form?.title) {
            setPointMsgs((p) => ({ ...p, [sectionId]: { ok: false, text: 'Point title is required.' } }));
            return;
        }
        setPointLoadings((p) => ({ ...p, [sectionId]: true }));
        setPointMsgs((p) => ({ ...p, [sectionId]: { ok: false, text: '' } }));
        try {
            await addPoint(sectionId, { title: form.title });
            setPointMsgs((p) => ({ ...p, [sectionId]: { ok: true, text: 'Point added.' } }));
            setPointForms((p) => ({ ...p, [sectionId]: { title: '' } }));
            await refresh();
        } catch (e: any) {
            setPointMsgs((p) => ({ ...p, [sectionId]: { ok: false, text: 'Failed to add point.' } }));
        } finally {
            setPointLoadings((p) => ({ ...p, [sectionId]: false }));
        }
    };

    if (loading) return <PageSpinner />;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold text-[#0d3d5e]">Manage Sections & Points</h1>
            <p className="text-sm text-gray-500">Only sections and points for the active cycle are shown here.</p>

            {/* Create section */}
            <AdminCard title="Create New Section">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <FormInput
                            label="Section Name"
                            value={sectionForm.name}
                            onChange={(v) => setSectionForm((p) => ({ ...p, name: v }))}
                            placeholder="e.g. Teamwork"
                        />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                        <input
                            type="checkbox"
                            id="isDynamic"
                            checked={sectionForm.isDynamic}
                            onChange={(e) => setSectionForm((p) => ({ ...p, isDynamic: e.target.checked }))}
                            className="w-4 h-4 accent-[#0d3d5e]"
                        />
                        <label htmlFor="isDynamic" className="text-sm text-gray-600">Dynamic (comment only)</label>
                    </div>
                </div>
                <FormFooter msg={sectionMsg} loading={sectionLoading} onSubmit={handleCreateSection} label="Create Section" />
            </AdminCard>

            {/* Sections list */}
            <AdminCard title="All Sections">
                {sections.length === 0 ? (
                    <p className="text-sm text-gray-400">No sections found for the active cycle.</p>
                ) : (
                    <div className="space-y-3">
                        {sections.map((section) => (
                            <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                {/* Section header */}
                                <button
                                    onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                                    className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-[#0d3d5e] text-sm">{section.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${section.isDynamic ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                            {section.isDynamic ? 'Dynamic' : 'Rated'}
                                        </span>
                                        <span className="text-xs text-gray-400">{section.points.length} points</span>
                                    </div>
                                    <span className="text-gray-400 text-xs">{expandedSection === section.id ? '▲' : '▼'}</span>
                                </button>

                                {/* Expanded content */}
                                {expandedSection === section.id && (
                                    <div className="px-5 py-4 space-y-4">
                                        {/* Points list */}
                                        {section.points.length === 0 ? (
                                            <p className="text-xs text-gray-400">No points yet.</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {section.points.map((point) => (
                                                    <li key={point.id} className="flex items-center gap-2 text-sm text-gray-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                                                        {point.title}
                                                        <span className="text-xs text-gray-400">(predefined)</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {/* Add point form */}
                                        {!section.isDynamic ? (
                                            <div className="flex flex-col sm:flex-row gap-3 items-end border-t border-gray-100 pt-4">
                                                <div className="flex-1">
                                                    <FormInput
                                                        label="New Point Title"
                                                        value={pointForms[section.id]?.title ?? ''}
                                                        onChange={(v) => setPointForms((p) => ({ ...p, [section.id]: { title: v } }))}
                                                        placeholder="e.g. Punctuality"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleAddPoint(section)}
                                                    disabled={pointLoadings[section.id]}
                                                    className="px-4 py-2 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors disabled:opacity-60"
                                                >
                                                    {pointLoadings[section.id] ? 'Adding...' : 'Add Point'}
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 border-t border-gray-100 pt-4">
                                                Dynamic section: points are added by employees during appraisal, not from admin panel.
                                            </p>
                                        )}
                                        {pointMsgs[section.id]?.text && (
                                            <p className={`text-xs ${pointMsgs[section.id].ok ? 'text-green-600' : 'text-red-500'}`}>
                                                {pointMsgs[section.id].text}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </AdminCard>
        </div>
    );
}