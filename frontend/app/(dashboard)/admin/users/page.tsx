'use client';

import { useEffect, useState } from 'react';
import {
    getAllUsers,
    getAllRoles,
    createUser,
    assignRole,
    assignManager,
    updateUser,
    setUserDisabled,
    AdminUser, AdminRole,
} from '@/lib/api/admin.api';
import { PageSpinner, AdminCard, FormInput, FormSelect, FormFooter } from '../_components';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'create' | 'assign-role' | 'assign-manager'>('create');

    // Create user form
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });
    const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [createLoading, setCreateLoading] = useState(false);

    // Assign role form
    const [roleForm, setRoleForm] = useState({ userId: '', roleName: '' });
    const [roleMsg, setRoleMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [roleLoading, setRoleLoading] = useState(false);

    // Assign manager form
    const [managerForm, setManagerForm] = useState({ employeeId: '', managerId: '' });
    const [managerMsg, setManagerMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [managerLoading, setManagerLoading] = useState(false);

    // Edit user modal
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', roleNames: [] as string[] });
    const [editMsg, setEditMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    useEffect(() => {
        Promise.all([getAllUsers(), getAllRoles()])
            .then(([u, r]) => { setUsers(u); setRoles(r); })
            .finally(() => setLoading(false));
    }, []);

    const refreshUsers = async () => {
        const u = await getAllUsers();
        setUsers(u);
    };

    const handleCreateUser = async () => {
        if (!newUser.name || !newUser.email || !newUser.password) {
            setCreateMsg({ ok: false, text: 'All fields are required.' });
            return;
        }
        setCreateLoading(true);
        setCreateMsg(null);
        try {
            await createUser(newUser);
            setCreateMsg({ ok: true, text: 'User created successfully.' });
            setNewUser({ name: '', email: '', password: '' });
            await refreshUsers();
        } catch (e: unknown) {
            setCreateMsg({ ok: false, text: getErrorMessage(e, 'Failed to create user.') });
        } finally {
            setCreateLoading(false);
        }
    };

    const handleAssignRole = async () => {
        if (!roleForm.userId || !roleForm.roleName) {
            setRoleMsg({ ok: false, text: 'All fields are required.' });
            return;
        }
        setRoleLoading(true);
        setRoleMsg(null);
        try {
            await assignRole(Number(roleForm.userId), roleForm.roleName);
            setRoleMsg({ ok: true, text: 'Role assigned successfully.' });
            setRoleForm({ userId: '', roleName: '' });
            await refreshUsers();
        } catch (e: unknown) {
            setRoleMsg({ ok: false, text: getErrorMessage(e, 'Failed to assign role.') });
        } finally {
            setRoleLoading(false);
        }
    };

    const handleAssignManager = async () => {
        if (!managerForm.employeeId || !managerForm.managerId) {
            setManagerMsg({ ok: false, text: 'All fields are required.' });
            return;
        }
        setManagerLoading(true);
        setManagerMsg(null);
        try {
            await assignManager(Number(managerForm.employeeId), Number(managerForm.managerId));
            setManagerMsg({ ok: true, text: 'Manager assigned successfully.' });
            setManagerForm({ employeeId: '', managerId: '' });
            await refreshUsers();
        } catch (e: unknown) {
            setManagerMsg({ ok: false, text: getErrorMessage(e, 'Failed to assign manager.') });
        } finally {
            setManagerLoading(false);
        }
    };

    const openEdit = (user: AdminUser) => {
        setEditingUser(user);
        setEditForm({
            name: user.name,
            email: user.email,
            roleNames: [...user.roles],
        });
        setEditMsg(null);
    };

    const toggleEditRole = (roleName: string) => {
        setEditForm((prev) => {
            const exists = prev.roleNames.includes(roleName);
            if (exists) {
                return {
                    ...prev,
                    roleNames: prev.roleNames.filter((role) => role !== roleName),
                };
            }

            return {
                ...prev,
                roleNames: [...prev.roleNames, roleName],
            };
        });
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;

        if (!editForm.name || !editForm.email || editForm.roleNames.length === 0) {
            setEditMsg({ ok: false, text: 'Name, email, and at least one role are required.' });
            return;
        }

        setEditLoading(true);
        setEditMsg(null);
        try {
            await updateUser(editingUser.id, editForm);
            setEditMsg({ ok: true, text: 'User updated successfully.' });
            await refreshUsers();
            setTimeout(() => {
                setEditingUser(null);
                setEditMsg(null);
            }, 600);
        } catch (e: unknown) {
            setEditMsg({ ok: false, text: getErrorMessage(e, 'Failed to update user.') });
        } finally {
            setEditLoading(false);
        }
    };

    const handleToggleUserDisabled = async (user: AdminUser) => {
        if (user.roles.includes('admin')) {
            setCreateMsg({ ok: false, text: 'Admin users cannot be disabled.' });
            return;
        }

        const nextDisabled = !user.disabled;
        const actionText = nextDisabled ? 'disable' : 'enable';
        const confirmed = window.confirm(`Are you sure you want to ${actionText} ${user.name}?`);
        if (!confirmed) return;

        try {
            await setUserDisabled(user.id, nextDisabled);
            await refreshUsers();
        } catch (e: unknown) {
            setCreateMsg({ ok: false, text: getErrorMessage(e, `Failed to ${actionText} user.`) });
        }
    };

    if (loading) return <PageSpinner />;

    const rows = buildHierarchyRows(users);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold text-[#0d3d5e]">Manage Users</h1>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {(['create', 'assign-role', 'assign-manager'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                            activeTab === tab
                                ? 'bg-[#0d3d5e] text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {tab === 'create' ? 'Create User' : tab === 'assign-role' ? 'Assign Role' : 'Assign Manager'}
                    </button>
                ))}
            </div>

            {/* Create User */}
            {activeTab === 'create' && (
                <AdminCard title="Create New User">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormInput label="Full Name" value={newUser.name} onChange={(v) => setNewUser((p) => ({ ...p, name: v }))} placeholder="John Doe" />
                        <FormInput label="Email" value={newUser.email} onChange={(v) => setNewUser((p) => ({ ...p, email: v }))} placeholder="john@example.com" type="email" />
                        <FormInput label="Password" value={newUser.password} onChange={(v) => setNewUser((p) => ({ ...p, password: v }))} placeholder="Min 6 characters" type="password" />
                    </div>
                    <FormFooter msg={createMsg} loading={createLoading} onSubmit={handleCreateUser} label="Create User" />
                </AdminCard>
            )}

            {/* Assign Role */}
            {activeTab === 'assign-role' && (
                <AdminCard title="Assign Role to User">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormSelect
                            label="User"
                            value={roleForm.userId}
                            onChange={(v) => setRoleForm((p) => ({ ...p, userId: v }))}
                            options={users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` }))}
                            placeholder="Select user..."
                        />
                        <FormSelect
                            label="Role"
                            value={roleForm.roleName}
                            onChange={(v) => setRoleForm((p) => ({ ...p, roleName: v }))}
                            options={roles.map((r) => ({ value: r.name, label: r.name }))}
                            placeholder="Select role..."
                        />
                    </div>
                    <FormFooter msg={roleMsg} loading={roleLoading} onSubmit={handleAssignRole} label="Assign Role" />
                </AdminCard>
            )}

            {/* Assign Manager */}
            {activeTab === 'assign-manager' && (
                <AdminCard title="Assign Manager to Employee">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormSelect
                            label="Employee"
                            value={managerForm.employeeId}
                            onChange={(v) => setManagerForm((p) => ({ ...p, employeeId: v }))}
                            options={users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` }))}
                            placeholder="Select employee..."
                        />
                        <FormSelect
                            label="Manager"
                            value={managerForm.managerId}
                            onChange={(v) => setManagerForm((p) => ({ ...p, managerId: v }))}
                            options={users
                                .filter((u) => u.roles.includes('manager') || u.roles.includes('management') || u.roles.includes('admin'))
                                .map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` }))}
                            placeholder="Select manager..."
                        />
                    </div>
                    <FormFooter msg={managerMsg} loading={managerLoading} onSubmit={handleAssignManager} label="Assign Manager" />
                </AdminCard>
            )}

            {/* Users table */}
            <AdminCard title="All Users (Hierarchy)">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[#0d3d5e] text-white">
                                <th className="text-left px-4 py-3 font-medium">Name</th>
                                <th className="text-left px-4 py-3 font-medium">Email</th>
                                <th className="text-left px-4 py-3 font-medium">Reports To</th>
                                <th className="text-left px-4 py-3 font-medium">Roles</th>
                                <th className="text-left px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={row.user.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                        <span style={{ paddingLeft: `${row.level * 20}px` }} className="inline-flex items-center gap-2">
                                            {row.level > 0 ? <span className="text-gray-300">-</span> : null}
                                            {row.user.name}
                                            {row.user.disabled && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                                    Disabled
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{row.user.email}</td>
                                    <td className="px-4 py-3 text-gray-500">{row.user.managerName ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {row.user.roles.map((roleName) => (
                                                <span key={roleName} className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_COLORS[roleName] ?? 'bg-gray-100 text-gray-700'}`}>
                                                    {roleName}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEdit(row.user)}
                                                disabled={row.user.disabled}
                                                className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleToggleUserDisabled(row.user)}
                                                disabled={row.user.roles.includes('admin')}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                                    row.user.roles.includes('admin')
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : row.user.disabled
                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                }`}
                                            >
                                                {row.user.roles.includes('admin')
                                                    ? 'Admin'
                                                    : row.user.disabled
                                                    ? 'Enable'
                                                    : 'Disable'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </AdminCard>

            {editingUser && (
                <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-[#0d3d5e]">Edit User</h2>
                            <button
                                onClick={() => setEditingUser(null)}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Close
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormInput
                                label="Full Name"
                                value={editForm.name}
                                onChange={(v) => setEditForm((p) => ({ ...p, name: v }))}
                                placeholder="John Doe"
                            />
                            <FormInput
                                label="Email"
                                value={editForm.email}
                                onChange={(v) => setEditForm((p) => ({ ...p, email: v }))}
                                placeholder="john@example.com"
                                type="email"
                            />
                        </div>

                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Roles</p>
                            <div className="grid grid-cols-2 gap-2">
                                {roles.map((role) => {
                                    const checked = editForm.roleNames.includes(role.name);
                                    return (
                                        <label
                                            key={role.id}
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${checked ? 'border-cyan-300 bg-cyan-50' : 'border-gray-200'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleEditRole(role.name)}
                                                className="accent-[#0d3d5e]"
                                            />
                                            {role.name}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            {editMsg ? (
                                <p className={`text-sm ${editMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{editMsg.text}</p>
                            ) : <span />}
                            <button
                                onClick={handleSaveEdit}
                                disabled={editLoading}
                                className="px-6 py-2.5 rounded-full bg-[#0d3d5e] text-white text-sm font-semibold hover:bg-[#0a2e47] transition-colors disabled:opacity-60"
                            >
                                {editLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const ROLE_BADGE_COLORS: Record<string, string> = {
    employee: 'bg-emerald-100 text-emerald-700',
    manager: 'bg-blue-100 text-blue-700',
    management: 'bg-amber-100 text-amber-800',
    admin: 'bg-rose-100 text-rose-700',
};

function hasRole(user: AdminUser, role: string) {
    return user.roles.includes(role);
}

function buildHierarchyRows(users: AdminUser[]): { user: AdminUser; level: number }[] {
    const byManager = new Map<number | null, AdminUser[]>();

    for (const user of users) {
        const key = user.managerId ?? null;
        if (!byManager.has(key)) byManager.set(key, []);
        byManager.get(key)!.push(user);
    }

    for (const group of byManager.values()) {
        group.sort((a, b) => a.name.localeCompare(b.name));
    }

    const rows: { user: AdminUser; level: number }[] = [];
    const added = new Set<number>();

    const addUserBranch = (user: AdminUser, level: number) => {
        if (added.has(user.id)) return;
        rows.push({ user, level });
        added.add(user.id);

        const managers = (byManager.get(user.id) ?? []).filter((child) =>
            hasRole(child, 'manager') && !hasRole(child, 'management'),
        );

        for (const manager of managers) {
            addUserBranch(manager, level + 1);
        }

        const employees = (byManager.get(user.id) ?? []).filter((child) =>
            !hasRole(child, 'manager') && !hasRole(child, 'management'),
        );

        for (const employee of employees) {
            if (added.has(employee.id)) continue;
            rows.push({ user: employee, level: level + 1 });
            added.add(employee.id);
        }
    };

    const managementRoots = users
        .filter((user) => hasRole(user, 'management'))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const management of managementRoots) {
        addUserBranch(management, 0);
    }

    const remainingManagers = users
        .filter((user) => !added.has(user.id) && hasRole(user, 'manager'))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const manager of remainingManagers) {
        addUserBranch(manager, 0);
    }

    const leftovers = users
        .filter((user) => !added.has(user.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const user of leftovers) {
        rows.push({ user, level: 0 });
    }

    return rows;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error && 'response' in error) {
        const response = (error as { response?: { data?: { message?: unknown } } }).response;
        const message = response?.data?.message;
        if (typeof message === 'string') return message;
    }
    return fallback;
}