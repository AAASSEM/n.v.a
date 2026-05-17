/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '../../components/layout/AppLayout';
import AccessDenied from '../../components/ui/AccessDenied';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { sitesApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useSiteStore } from '../../stores/siteStore';
import type { Site } from '../../types/site';

function isCompanyAdmin(role?: string) {
    return role === 'admin' || role === 'super_user';
}

const EMIRATE_OPTIONS = ['Dubai', 'AbuDhabi', 'Sharjah', 'Ajman', 'UmmAlQuwain', 'RasAlKhaimah', 'Fujairah'];

export default function SiteManagementView() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const setSites = useSiteStore((s) => s.setSites);
    const currentSiteId = useSiteStore((s) => s.currentSiteId);
    const setCurrentSiteId = useSiteStore((s) => s.setCurrentSiteId);

    const [isCreateOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Site | null>(null);
    const [deactivateTarget, setDeactivateTarget] = useState<Site | null>(null);
    const [formName, setFormName] = useState('');
    const [formLocation, setFormLocation] = useState('Dubai');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const role = user?.profile?.role;
    const canManage = isCompanyAdmin(role);

    const sitesQuery = useQuery({
        queryKey: ['sites'],
        queryFn: () => sitesApi.list(),
    });

    const sites = useMemo(() => sitesQuery.data || [], [sitesQuery.data]);

    // Keep the site store in sync with the latest list so the navbar switcher
    // and any cached site metadata update immediately after a mutation.
    useEffect(() => {
        setSites(sites);
    }, [sites, setSites]);

    const createMut = useMutation({
        mutationFn: sitesApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sites'] });
            setCreateOpen(false);
            setFormName('');
            setFormLocation('Dubai');
            setErrorMessage(null);
        },
        onError: (e: any) => setErrorMessage(e?.response?.data?.detail || e?.message || 'Failed to create site'),
    });

    const updateMut = useMutation({
        mutationFn: (vars: { id: number; payload: { name?: string; location?: string | null; is_active?: boolean } }) =>
            sitesApi.update(vars.id, vars.payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sites'] });
            setEditing(null);
            setErrorMessage(null);
        },
        onError: (e: any) => setErrorMessage(e?.response?.data?.detail || e?.message || 'Failed to update site'),
    });

    const deactivateMut = useMutation({
        mutationFn: (id: number) => sitesApi.deactivate(id),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['sites'] });
            if (currentSiteId === id) {
                const next = sites.find((s) => s.is_active && s.id !== id);
                setCurrentSiteId(next ? next.id : null);
            }
            setDeactivateTarget(null);
        },
    });

    const counts = {
        all: sites.length,
        active: sites.filter((s) => s.is_active).length,
        inactive: sites.filter((s) => !s.is_active).length,
    };

    const filteredSites = sites.filter((s) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || s.name.toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q);
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' ? s.is_active : !s.is_active);
        return matchesSearch && matchesStatus;
    });

    if (!canManage) {
        return (
            <AppLayout>
                <AccessDenied
                    showLayout
                    title="Admin access only"
                    message="Only company admins can manage sites. Your site manager can adjust site-level settings via the standard pages."
                />
            </AppLayout>
        );
    }

    const openCreate = () => {
        setFormName('');
        setFormLocation('Dubai');
        setEditing(null);
        setErrorMessage(null);
        setCreateOpen(true);
    };

    const openEdit = (s: Site) => {
        setFormName(s.name);
        setFormLocation(s.location || 'Dubai');
        setEditing(s);
        setErrorMessage(null);
        setCreateOpen(false);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            setErrorMessage('Site name is required');
            return;
        }
        if (editing) {
            updateMut.mutate({
                id: editing.id,
                payload: { name: formName.trim(), location: formLocation.trim() || null },
            });
        } else {
            createMut.mutate({ name: formName.trim(), location: formLocation.trim() || null });
        }
    };

    const modalOpen = isCreateOpen || !!editing;

    const SITE_GRADIENTS = [
        'linear-gradient(135deg, #10b981, #06b6d4)',
        'linear-gradient(135deg, #6366f1, #8b5cf6)',
        'linear-gradient(135deg, #f59e0b, #ef4444)',
        'linear-gradient(135deg, #0ea5e9, #6366f1)',
    ];

    const getSiteInitials = (name: string) =>
        name
            .split(' ')
            .map((w) => w.charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?';

    if (sitesQuery.isLoading) {
        return (
            <AppLayout>
                <div className="loading-screen" style={{ minHeight: 'calc(100vh - 60px)' }}>
                    <div className="spinner" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Site Management</h1>
                        <p className="page-subtitle">
                            Each site is a fully independent environment with its own onboarding, meters, users, and submissions.
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Site
                    </button>
                </div>

                {/* Stat cards */}
                <div className="stat-card-grid stat-card-grid-3" style={{ marginBottom: 24 }}>
                    <div className="stat-card blue">
                        <div className="stat-card-header">
                            <span className="stat-card-label">Total Sites</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{counts.all}</div>
                    </div>
                    <div className="stat-card green">
                        <div className="stat-card-header">
                            <span className="stat-card-label">Active</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{counts.active}</div>
                    </div>
                    <div className="stat-card amber">
                        <div className="stat-card-header">
                            <span className="stat-card-label">Inactive</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{counts.inactive}</div>
                    </div>
                </div>

                {/* Inline error */}
                {errorMessage && !modalOpen && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 14,
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <span>⚠</span> {errorMessage}
                        <button onClick={() => setErrorMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
                    </div>
                )}

                {/* Filter / search bar (same pattern as Users) */}
                <div className="command-bar animate-slide-up">
                    <div className="command-bar-main" style={{ gap: 12 }}>
                        <div className="status-chip-group" style={{ flex: 1 }}>
                            <button
                                className={`status-chip ${statusFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('all')}
                            >
                                All Sites <span className="s-count">{counts.all}</span>
                            </button>
                            <button
                                className={`status-chip green ${statusFilter === 'active' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('active')}
                            >
                                <div className="dot green" /> Active <span className="s-count">{counts.active}</span>
                            </button>
                            <button
                                className={`status-chip gray ${statusFilter === 'inactive' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('inactive')}
                            >
                                <div className="dot red" /> Inactive <span className="s-count">{counts.inactive}</span>
                            </button>
                        </div>

                        <div className="integrated-search" style={{ width: 220, flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Find site..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Table (same dark-table pattern as Users) */}
                <div className="dark-table-wrap">
                    <table className="dark-table">
                        <thead>
                            <tr>
                                <th>Site</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSites.map((s, idx) => {
                                const isCurrent = s.id === currentSiteId;
                                return (
                                    <tr key={s.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div
                                                    className="avatar"
                                                    style={{ background: SITE_GRADIENTS[idx % SITE_GRADIENTS.length], color: 'white' }}
                                                >
                                                    {getSiteInitials(s.name)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {s.name}
                                                        {isCurrent && (
                                                            <span className="badge badge-gray" style={{ fontSize: 10 }}>Current</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                {s.location === 'AbuDhabi' ? 'Abu Dhabi' : 
                                                 s.location === 'UmmAlQuwain' ? 'Umm Al Quwain' : 
                                                 s.location === 'RasAlKhaimah' ? 'Ras Al Khaimah' : (s.location || '—')}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>
                                                {s.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => openEdit(s)}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                    Edit
                                                </button>
                                                {s.is_active ? (
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => setDeactivateTarget(s)}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                        </svg>
                                                        Deactivate
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => updateMut.mutate({ id: s.id, payload: { is_active: true } })}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                        Reactivate
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!filteredSites.length && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                            {sites.length ? 'No sites match your filters.' : 'No sites yet. Click “Add Site” to create your first location.'}
                        </div>
                    )}
                </div>
            </div>

            {/* CREATE / EDIT MODAL */}
            {modalOpen && (
                <div className="modal-backdrop" onClick={() => { setCreateOpen(false); setEditing(null); }}>
                    <div className="modal modal-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{editing ? 'Edit Site' : 'Add Site'}</span>
                            <button className="modal-close" onClick={() => { setCreateOpen(false); setEditing(null); }}>✕</button>
                        </div>
                        <form onSubmit={submit}>
                            <div className="modal-body">
                                {errorMessage && (
                                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 16 }}>
                                        {errorMessage}
                                    </div>
                                )}
                                <div style={{ marginBottom: 16 }}>
                                    <label className="form-label">Site Name</label>
                                    <input
                                        required
                                        autoFocus
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Dubai Marina Resort"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Location / Emirate</label>
                                    <select
                                        className="form-input"
                                        value={formLocation}
                                        onChange={(e) => setFormLocation(e.target.value)}
                                        style={{
                                            background: 'var(--bg-elevated)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            outline: 'none',
                                            padding: '10px 14px',
                                            width: '100%',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {EMIRATE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt} style={{ background: '#1c1e30', color: '#fff' }}>
                                                {opt === 'AbuDhabi' ? 'Abu Dhabi' : 
                                                 opt === 'UmmAlQuwain' ? 'Umm Al Quwain' : 
                                                 opt === 'RasAlKhaimah' ? 'Ras Al Khaimah' : opt}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => { setCreateOpen(false); setEditing(null); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                                    {editing
                                        ? (updateMut.isPending ? 'Saving...' : 'Save Changes')
                                        : (createMut.isPending ? 'Creating...' : 'Create Site')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DEACTIVATE CONFIRM */}
            <ConfirmModal
                isOpen={!!deactivateTarget}
                type="danger"
                title="Deactivate site?"
                message={`"${deactivateTarget?.name}" will be hidden from the site switcher and new data entry will be blocked. Existing data is preserved and the site can be reactivated at any time.`}
                confirmLabel="Deactivate"
                danger
                onCancel={() => setDeactivateTarget(null)}
                onConfirm={() => deactivateTarget && deactivateMut.mutate(deactivateTarget.id)}
            />
        </AppLayout>
    );
}
