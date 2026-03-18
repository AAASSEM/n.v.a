/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import AccessDenied from '../../components/ui/AccessDenied';
import { useAuthStore } from '../../stores/authStore';
import { canPerformAction } from '../../config/rbac';

interface ChecklistItem {
    id: number;
    data_element_id: number;
    element_name: string;
    category: 'E' | 'S' | 'G';
    frequency: string;
    unit: string;
    is_required: boolean;
    assigned_to: number | null;
    assigned_user_name: string | null;
    frameworks: string | null;
}

interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
}

const CATEGORY_CONFIG = {
    E: {
        label: 'Environmental',
        color: 'var(--color-env)',
        bg: 'var(--color-env-bg)',
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
    },
    S: {
        label: 'Social',
        color: 'var(--color-soc)',
        bg: 'var(--color-soc-bg)',
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    },
    G: {
        label: 'Governance',
        color: 'var(--color-gov)',
        bg: 'var(--color-gov-bg)',
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7M4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17" /></svg>
    },
};

const FRAMEWORK_CONFIG: Record<string, { color: string; bg: string }> = {
    'ESG': { color: '#818cf8', bg: 'rgba(99, 102, 241, 0.12)' },       // Indigo
    'DST': { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },      // Amber
    'GREEN KEY': { color: '#34d399', bg: 'rgba(16, 185, 129, 0.12)' }, // Emerald
    'DEFAULT': { color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' }
};

export default function ChecklistView() {
    const queryClient = useQueryClient();
    const userRole = useAuthStore(state => state.user?.profile?.role);
    const canManage = canPerformAction(userRole, 'checklist', 'update');

    const [selectedCategory, setSelectedCategory] = useState<'E' | 'S' | 'G' | 'ALL'>('ALL');
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'BULK' | 'SINGLE';
        category?: string;
        checklistId?: number;
    }>({ isOpen: false, type: 'SINGLE' });
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');

    const { data: checklist, isLoading, error } = useQuery<ChecklistItem[]>({
        queryKey: ['checklist'],
        queryFn: async () => {
            const res = await api.get('/profiling/checklist/me');
            return res.data;
        }
    });

    const isForbidden = (error as any)?.response?.status === 403;

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['companyUsers'],
        queryFn: async () => {
            const res = await api.get('/users/company/me');
            return res.data;
        }
    });

    const assignMutation = useMutation({
        mutationFn: async ({ checklistId, userId }: { checklistId: number; userId: number | null }) => {
            await api.post('/profiling/checklist/assign', { checklist_id: checklistId, user_id: userId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklist'] });
            setModalConfig({ ...modalConfig, isOpen: false });
        }
    });

    const bulkAssignMutation = useMutation({
        mutationFn: async ({ category, userId }: { category: string; userId: number | null }) => {
            await api.post('/profiling/checklist/assign/bulk', { category, user_id: userId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklist'] });
            setModalConfig({ ...modalConfig, isOpen: false });
        }
    });

    const handleAssignSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const userId = selectedUserId === '' ? null : Number(selectedUserId);
        if (modalConfig.type === 'SINGLE' && modalConfig.checklistId) {
            assignMutation.mutate({ checklistId: modalConfig.checklistId, userId });
        } else if (modalConfig.type === 'BULK' && modalConfig.category) {
            bulkAssignMutation.mutate({ category: modalConfig.category, userId });
        }
    };

    if (isLoading) {
        return (
            <AppLayout>
                <div className="loading-screen" style={{ minHeight: 'calc(100vh - 60px)' }}>
                    <div className="spinner" />
                </div>
            </AppLayout>
        );
    }

    if (isForbidden) {
        return <AccessDenied showLayout title="Access Restricted" message="Your role does not have permission to view or manage the data checklist." />;
    }

    const items = checklist || [];
    const envItems = items.filter(i => i.category === 'E');
    const socItems = items.filter(i => i.category === 'S');
    const govItems = items.filter(i => i.category === 'G');
    const assignedCount = items.filter(i => i.assigned_to).length;

    const renderItems = (categoryItems: ChecklistItem[], cat: 'E' | 'S' | 'G') => {
        if (!categoryItems.length) return null;
        if (selectedCategory !== 'ALL' && selectedCategory !== cat) return null;
        const cfg = CATEGORY_CONFIG[cat];
        return (
            <div className="category-group" key={cat}>
                <div className="category-group-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                        <span className="category-group-title" style={{ color: cfg.color }}>
                            {cfg.icon} {cfg.label}
                        </span>
                        <span className="category-group-count">{categoryItems.length}</span>
                    </div>
                    {canManage && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                                setSelectedUserId('');
                                setModalConfig({ isOpen: true, type: 'BULK', category: cat });
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                            </svg>
                            Assign All
                        </button>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                    {categoryItems.map(item => (
                        <div key={item.id} className="checklist-card">
                            {/* Top row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, flex: 1, paddingRight: 12 }}>
                                    {item.element_name}
                                </div>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {item.frameworks && item.frameworks.split(',').map((f, i) => {
                                        const name = f.trim().toUpperCase();
                                        const style = FRAMEWORK_CONFIG[name] || FRAMEWORK_CONFIG['DEFAULT'];
                                        return (
                                            <span
                                                key={i}
                                                className="badge"
                                                style={{
                                                    fontSize: 10,
                                                    color: style.color,
                                                    background: style.bg
                                                }}
                                            >
                                                {name}
                                            </span>
                                        );
                                    })}
                                    {item.is_required && (
                                        <span className="badge badge-red" style={{ fontSize: 10 }}>Required</span>
                                    )}
                                </div>
                            </div>

                            {/* Meta */}
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Unit: </span>
                                    {item.unit || 'N/A'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Freq: </span>
                                    {item.frequency}
                                </div>
                            </div>

                            {/* Assignment */}
                            <div style={{
                                paddingTop: 12,
                                borderTop: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: '50%',
                                        background: item.assigned_user_name
                                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                            : 'var(--bg-elevated)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: item.assigned_user_name ? 'white' : 'var(--text-muted)',
                                        border: '1px solid var(--border-subtle)',
                                    }}>
                                        {item.assigned_user_name ? item.assigned_user_name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Assigned to</div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: item.assigned_user_name ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                                            {item.assigned_user_name || 'Unassigned'}
                                        </div>
                                    </div>
                                </div>
                                {canManage && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => {
                                            setSelectedUserId(item.assigned_to ?? '');
                                            setModalConfig({ isOpen: true, type: 'SINGLE', checklistId: item.id });
                                        }}
                                    >
                                        {item.assigned_user_name ? 'Reassign' : 'Assign'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Data Checklist</h1>
                        <p className="page-subtitle">Assign data collection responsibilities to your team.</p>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="stat-card-grid stat-card-grid-4" style={{ marginBottom: 24 }}>
                    <div className="stat-card blue">
                        <div className="stat-card-header">
                            <span className="stat-card-label">Total Elements</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{items.length}</div>
                    </div>
                    <div className="stat-card green">
                        <div className="stat-card-header">
                            <span className="stat-card-label">Assigned</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{assignedCount}</div>
                    </div>
                    <div className="stat-card amber">
                        <div className="stat-card-header">
                            <span className="stat-card-label">Unassigned</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{items.length - assignedCount}</div>
                    </div>
                    <div className="stat-card purple">
                        <div className="stat-card-header">
                            <span className="stat-card-label">Team Coverage</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{items.length ? Math.round((assignedCount / items.length) * 100) : 0}%</div>
                    </div>
                </div>

                {/* Category Tabs */}
                <div style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 24,
                    padding: '4px',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                    width: 'fit-content',
                }}>
                    {[
                        { key: 'ALL', label: 'All', count: items.length, icon: null },
                        { key: 'E', label: 'Env', count: envItems.length, icon: CATEGORY_CONFIG.E.icon },
                        { key: 'S', label: 'Social', count: socItems.length, icon: CATEGORY_CONFIG.S.icon },
                        { key: 'G', label: 'Gov', count: govItems.length, icon: CATEGORY_CONFIG.G.icon },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedCategory(tab.key as any)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 600,
                                transition: 'all var(--transition-fast)',
                                background: selectedCategory === tab.key ? 'var(--bg-elevated)' : 'transparent',
                                color: selectedCategory === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            {tab.icon && <span style={{ opacity: 0.8, display: 'flex', alignItems: 'center' }}>{tab.icon}</span>}
                            {tab.label}
                            <span style={{
                                fontSize: 11,
                                opacity: 0.5,
                                background: 'rgba(255,255,255,0.05)',
                                padding: '1px 6px',
                                borderRadius: 6,
                                marginLeft: tab.icon ? 0 : 2
                            }}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {renderItems(envItems, 'E')}
                {renderItems(socItems, 'S')}
                {renderItems(govItems, 'G')}
            </div>

            {/* Assignment Modal */}
            {modalConfig.isOpen && (
                <div className="modal-backdrop" onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}>
                    <div className="modal modal-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">
                                {modalConfig.type === 'BULK' ? 'Assign Entire Category' : 'Assign Element'}
                            </span>
                            <button className="modal-close" onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}>✕</button>
                        </div>
                        <form onSubmit={handleAssignSubmit}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {/* Unassigned Option */}
                                    <div
                                        className={`selection-item ${selectedUserId === '' ? 'selected' : ''}`}
                                        onClick={() => setSelectedUserId('')}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: 'var(--radius-lg)',
                                            border: `1px solid ${selectedUserId === '' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                            background: selectedUserId === '' ? 'var(--accent-green-dim)' : 'var(--bg-card)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-disabled)',
                                            border: '1px solid var(--border-subtle)'
                                        }}>?</div>
                                        <div style={{ flex: 1, fontWeight: 600, color: selectedUserId === '' ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                            Unassigned
                                        </div>
                                        {selectedUserId === '' && (
                                            <div style={{ color: 'var(--accent-green)' }}>✓</div>
                                        )}
                                    </div>

                                    {/* User Options */}
                                    {users.map(u => {
                                        const isSelected = u.id === selectedUserId;
                                        return (
                                            <div
                                                key={u.id}
                                                className={`selection-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => setSelectedUserId(u.id)}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderRadius: 'var(--radius-lg)',
                                                    border: `1px solid ${isSelected ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                                    background: isSelected ? 'var(--accent-green-dim)' : 'var(--bg-card)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 12, fontWeight: 700, color: 'white',
                                                    border: '1px solid var(--border-subtle)'
                                                }}>
                                                    {u.first_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, color: isSelected ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                                                        {u.first_name} {u.last_name}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                                                </div>
                                                {isSelected && (
                                                    <div style={{ color: 'var(--accent-green)' }}>✓</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
                                    {modalConfig.type === 'BULK'
                                        ? `This will reassign all ${modalConfig.category === 'E' ? 'Environmental' : modalConfig.category === 'S' ? 'Social' : 'Governance'} elements to this user.`
                                        : 'This user will be responsible for providing data for this element.'}
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}>Cancel</button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={assignMutation.isPending || bulkAssignMutation.isPending}
                                >
                                    {assignMutation.isPending || bulkAssignMutation.isPending ? 'Saving...' : 'Confirm Assignment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
