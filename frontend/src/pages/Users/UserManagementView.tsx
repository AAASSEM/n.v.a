import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useSiteStore } from '../../stores/siteStore';
import AppLayout from '../../components/layout/AppLayout';
import AccessDenied from '../../components/ui/AccessDenied';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CustomDropdown from '../../components/ui/CustomDropdown';
import { useTranslation } from '../../i18n';

interface UserProfile { role: string; company_id: number | null; }
interface User {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    email_verified: boolean;
    profile: UserProfile | null;
}

const ROLE_HIERARCHY: Record<string, string[]> = {
    'super_user': ['admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'],
    'admin': ['site_manager', 'uploader', 'viewer', 'meter_manager'],
    'site_manager': ['uploader', 'viewer', 'meter_manager'],
};

const ROLE_LABELS: Record<string, string> = {
    'super_user': 'Super User',
    'admin': 'Admin',
    'site_manager': 'Site Manager',
    'meter_manager': 'Meter Manager',
    'uploader': 'Data Uploader',
    'viewer': 'Viewer',
};

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

const CATEGORY_CONFIG = {
    E: { label: 'Environmental', color: 'var(--color-env)', bg: 'var(--color-env-bg)' },
    S: { label: 'Social', color: 'var(--color-soc)', bg: 'var(--color-soc-bg)' },
    G: { label: 'Governance', color: 'var(--color-gov)', bg: 'var(--color-gov-bg)' },
};



function getInitials(user: User) {
    return `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase();
}

const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #0ea5e9, #6366f1)',
    'linear-gradient(135deg, #10b981, #06b6d4)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
];

export default function UserManagementView() {
    const { t, n } = useTranslation();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore(state => state.user);
    const currentUserRole = currentUser?.profile?.role || '';
    const currentSiteId = useSiteStore(s => s.currentSiteId);

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [creationStep, setCreationStep] = useState(1);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
    const [activityScope, setActivityScope] = useState<'month' | 'year'>('month');

    const { data: userActivity, isLoading: isActivityLoading } = useQuery({
        queryKey: ['user-activity', selectedUser?.id, selectedYear, selectedMonth, activityScope, currentSiteId],
        queryFn: async () => {
            if (!selectedUser) return null;
            const res = await api.get(`/users/${selectedUser.id}/activity`, {
                params: {
                    year: selectedYear,
                    month: selectedMonth,
                    scope: activityScope,
                    site_id: currentSiteId
                }
            });
            return res.data;
        },
        enabled: isActivityModalOpen && !!selectedUser,
    });

    const getRoleConfig = (role: string): { icon: React.ReactNode, bg: string, color: string, descKey: string } => {
        const r = role?.toLowerCase() || '';
        const props = { width: 14, height: 14, strokeWidth: 2.5, stroke: "currentColor" };

        if (r.includes('admin')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
            bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', descKey: 'roles.desc.admin'
        };
        if (r.includes('site')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7M4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17" /></svg>,
            bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', descKey: 'roles.desc.site'
        };
        if (r.includes('meter')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>,
            bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', descKey: 'roles.desc.meter'
        };
        if (r.includes('upload')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>,
            bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', descKey: 'roles.desc.uploader'
        };
        if (r.includes('view')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" /><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /></svg>,
            bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', descKey: 'roles.desc.viewer'
        };
        if (r.includes('super')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="m12 15 5 3-1-5 4-4-5-1-3-4-3 4-5 1 4 4-1 5z" /></svg>,
            bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', descKey: 'roles.desc.super'
        };
        return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
            bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', descKey: 'roles.desc.default'
        };
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const [inviteForm, setInviteForm] = useState({
        email: '', first_name: '', last_name: '', password: '', role: ''
    });
    const [editRole, setEditRole] = useState('');

    const { data: users, isLoading, error } = useQuery<User[]>({
        queryKey: ['users', 'company', currentSiteId],
        queryFn: async () => {
            const res = await api.get('/users/company/me');
            return res.data;
        }
    });

    // Check for access denied
    const isForbidden = (error as any)?.response?.status === 403;

    const inviteMutation = useMutation({
        mutationFn: async (data: any) => {
            // Backend requires site_id for non-admin invites from company-wide admins.
            // Default to the admin's currently-selected site unless the role is an admin itself.
            const isAdminRole = data.role === 'admin' || data.role === 'super_user';
            const payload = { ...data, site_id: isAdminRole ? null : (data.site_id ?? currentSiteId) };
            const res = await api.post('/users/invite', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', 'company', currentSiteId] });
            setIsInviteModalOpen(false);
            setCreationStep(1);
            setInviteForm({ email: '', first_name: '', last_name: '', password: '', role: '' });
            setErrorMessage(null);
        },
        onError: (error: any) => setErrorMessage(error.response?.data?.detail || 'Failed to invite user'),
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
            const res = await api.put(`/users/${userId}/role`, { role });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', 'company', currentSiteId] });
            setIsEditModalOpen(false);
            setSelectedUser(null);
            setErrorMessage(null);
        },
        onError: (error: any) => setErrorMessage(error.response?.data?.detail || 'Failed to update role'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: number) => { const res = await api.delete(`/users/${userId}`); return res.data; },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', 'company', currentSiteId] });
            setConfirmDelete(null);
            setErrorMessage(null);
        },
        onError: (error: any) => setErrorMessage(error.response?.data?.detail || 'Failed to delete user'),
    });

    const canManageTarget = (targetRole: string) => {
        const manageable = ROLE_HIERARCHY[currentUserRole] || [];
        return manageable.includes(targetRole);
    };

    const availableRolesToAssign = ROLE_HIERARCHY[currentUserRole] || [];

    const filteredUsers = users?.filter(u => {
        const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || fullName.includes(q) || u.email.toLowerCase().includes(q);
        const matchesRole = filterRole === 'all' || u.profile?.role === filterRole;
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active);
        return matchesSearch && matchesRole && matchesStatus;
    });

    const counts = {
        all: users?.length ?? 0,
        active: users?.filter(u => u.is_active).length ?? 0,
        inactive: users?.filter(u => !u.is_active).length ?? 0,
        pending: users?.filter(u => !u.email_verified).length ?? 0,
        super_user: users?.filter(u => u.profile?.role === 'super_user').length ?? 0,
        admin: users?.filter(u => u.profile?.role === 'admin').length ?? 0,
        site_manager: users?.filter(u => u.profile?.role === 'site_manager').length ?? 0,
        meter_manager: users?.filter(u => u.profile?.role === 'meter_manager').length ?? 0,
        uploader: users?.filter(u => u.profile?.role === 'uploader').length ?? 0,
        viewer: users?.filter(u => u.profile?.role === 'viewer').length ?? 0,
    };
    const totalUsers = counts.all;
    const activeUsers = counts.active;
    const pendingInvites = users?.filter(u => !u.email_verified && u.id !== currentUser?.id).length ?? 0;

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
        return <AccessDenied showLayout title={t('access.title')} message={t('access.message')} />;
    }

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t('users.title')}</h1>
                        <p className="page-subtitle">{t('users.subtitle')}</p>
                    </div>
                    {availableRolesToAssign.length > 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setErrorMessage(null);
                                setCreationStep(1);
                                setIsInviteModalOpen(true);
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {t('users.addUser')}
                        </button>
                    )}
                </div>

                {/* Stat Cards */}
                <div className="stat-card-grid stat-card-grid-4" style={{ marginBottom: 24 }}>
                    <div className="stat-card blue">
                        <div className="stat-card-header">
                            <span className="stat-card-label">{t('users.totalUsers')}</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{n(totalUsers)}</div>
                    </div>
                    <div className="stat-card green">
                        <div className="stat-card-header">
                            <span className="stat-card-label">{t('users.active')}</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{n(activeUsers)}</div>
                    </div>
                    <div className="stat-card amber">
                        <div className="stat-card-header">
                            <span className="stat-card-label">{t('users.inactive')}</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="18" y1="8" x2="22" y2="12" /><line x1="22" y1="8" x2="18" y2="12" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{n(totalUsers - activeUsers)}</div>
                    </div>
                    <div className="stat-card purple">
                        <div className="stat-card-header">
                            <span className="stat-card-label">{t('users.pending')}</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{n(pendingInvites)}</div>
                    </div>
                </div>

                {/* Error */}
                {errorMessage && (
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

                {/* Command Bar (Optimized Two-Line Layout) */}
                <div className="command-bar animate-slide-up">
                    <div className="command-bar-main">
                        {/* Role Tabs Group */}
                        <div className="type-filter-group" style={{ flex: 1, overflowX: 'auto' }}>
                            <button
                                className={`type-btn ${filterRole === 'all' ? 'active' : ''}`}
                                onClick={() => setFilterRole('all')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                                </svg>
                                <span>{t('users.allUsers')}</span>
                                <span className="type-count">{n(counts.all)}</span>
                            </button>
                            {Object.entries(ROLE_LABELS).map(([role]) => {
                                const cfg = getRoleConfig(role);
                                return (
                                    <button
                                        key={role}
                                        className={`type-btn ${filterRole === role ? 'active' : ''}`}
                                        onClick={() => setFilterRole(role)}
                                        style={{ minWidth: '130px', justifyContent: 'center' }}
                                    >
                                        <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                                        <span>{t(`roles.${role}` as any)}</span>
                                        <span className="type-count">{n((counts as any)[role])}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="command-bar-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="status-chip-group">
                            <button
                                className={`status-chip ${statusFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('all')}
                            >
                                {t('data.allStatus')}
                            </button>
                            <button
                                className={`status-chip green ${statusFilter === 'active' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('active')}
                            >
                                <div className="dot green" /> {t('users.active')} <span className="s-count">{n(counts.active)}</span>
                            </button>
                            <button
                                className={`status-chip gray ${statusFilter === 'inactive' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('inactive')}
                            >
                                <div className="dot red" /> {t('users.inactive')} <span className="s-count">{n(counts.inactive)}</span>
                            </button>
                        </div>

                        {/* Search Bar moved to secondary row */}
                        <div className="integrated-search" style={{ width: '220px', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder={t('users.findUser')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="dark-table-wrap">
                    <table className="dark-table">
                        <thead>
                            <tr>
                                <th>{t('users.user')}</th>
                                <th>{t('users.role')}</th>
                                <th>{t('users.status')}</th>
                                <th>{t('users.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers?.map((user, idx) => {
                                const userRole = user.profile?.role || 'unknown';
                                const cManage = canManageTarget(userRole) && user.id !== currentUser?.id;
                                return (
                                    <tr key={user.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div
                                                    className="avatar"
                                                    style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length], color: 'white' }}
                                                >
                                                    {getInitials(user)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {user.first_name} {user.last_name}
                                                        {user.id === currentUser?.id && (
                                                            <span className="badge badge-gray" style={{ fontSize: 10 }}>You</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: getRoleConfig(userRole).bg,
                                                    color: getRoleConfig(userRole).color,
                                                    border: `1px solid ${getRoleConfig(userRole).color}30`
                                                }}
                                            >
                                                {t(`roles.${userRole}` as any)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${user.is_active ? 'badge-green' : 'badge-gray'}`}>
                                                {user.is_active ? t('users.active') : t('users.inactive')}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setErrorMessage(null);
                                                        setIsActivityModalOpen(true);
                                                    }}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20V10" />
                                                        <path d="M18 20V4" />
                                                        <path d="M6 20v-4" />
                                                    </svg>
                                                    {t('users.activity')}
                                                </button>
                                                {cManage && (
                                                    <>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setEditRole(userRole);
                                                                setErrorMessage(null);
                                                                setIsEditModalOpen(true);
                                                            }}
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                            {t('users.edit')}
                                                        </button>
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => setConfirmDelete(user)}
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                <path d="M10 11v6M14 11v6" />
                                                            </svg>
                                                            {t('users.remove')}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!filteredUsers?.length && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                            {t('users.noUsersFound')}
                        </div>
                    )}
                </div>
            </div>

            {/* INVITE MODAL */}
            {isInviteModalOpen && (
                <div className="modal-backdrop" onClick={() => { setIsInviteModalOpen(false); setCreationStep(1); }}>
                    <div className="modal modal-md animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: creationStep === 1 ? 650 : 500 }}>
                        <div className="modal-header">
                            <span className="modal-title">{creationStep === 1 ? t('users.selectRole') : t('users.userDetails')}</span>
                            <button className="modal-close" onClick={() => { setIsInviteModalOpen(false); setCreationStep(1); }}>✕</button>
                        </div>

                        {creationStep === 1 ? (
                            <div className="modal-body">
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                                    {t('users.selectAccessLevel')}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                                    {availableRolesToAssign.map(role => {
                                        const cfg = getRoleConfig(role);
                                        return (
                                            <button
                                                key={role}
                                                onClick={() => {
                                                    setInviteForm({ ...inviteForm, role: role });
                                                    setCreationStep(2);
                                                }}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid var(--border-subtle)',
                                                    borderRadius: 20,
                                                    padding: '28px 16px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    textAlign: 'center'
                                                }}
                                                className="hover-scale"
                                            >
                                                <div style={{
                                                    fontSize: 36, width: 72, height: 72, borderRadius: 20,
                                                    background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', boxShadow: `0 8px 16px ${cfg.bg}80`
                                                }}>
                                                    {cfg.icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15, marginBottom: 4 }}>{t(`roles.${role}` as any)}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, paddingInline: 8 }}>{t(cfg.descKey as any)}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={e => { e.preventDefault(); setErrorMessage(null); inviteMutation.mutate(inviteForm); }}>
                                <div className="modal-body">
                                    {errorMessage && (
                                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 16 }}>
                                            {errorMessage}
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                        <div>
                                            <label className="form-label">{t('signup.firstName')}</label>
                                            <input required type="text" className="form-input" placeholder="John" value={inviteForm.first_name}
                                                onChange={e => setInviteForm({ ...inviteForm, first_name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="form-label">{t('signup.lastName')}</label>
                                            <input required type="text" className="form-input" placeholder="Doe" value={inviteForm.last_name}
                                                onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: 16 }}>
                                        <label className="form-label">{t('signup.emailLabel')}</label>
                                        <input required type="email" className="form-input" placeholder="john.doe@example.com" value={inviteForm.email}
                                            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
                                    </div>
                                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid var(--border-subtle)', fontSize: 13 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 8,
                                                background: getRoleConfig(inviteForm.role).bg,
                                                color: getRoleConfig(inviteForm.role).color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                                            }}>
                                                <div style={{ transform: 'scale(0.7)' }}>
                                                    {getRoleConfig(inviteForm.role).icon}
                                                </div>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)' }}>{t('users.assignedRole')} </span>
                                                <strong style={{ color: 'var(--text-primary)' }}>{t(`roles.${inviteForm.role}` as any)}</strong>
                                            </div>
                                            <button type="button" onClick={() => setCreationStep(1)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{t('users.change')}</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setCreationStep(1)}>{t('users.back')}</button>
                                    <button type="submit" className="btn btn-primary" disabled={inviteMutation.isPending}>
                                        {inviteMutation.isPending ? t('users.inviting') : t('users.sendInvite')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* EDIT ROLE MODAL */}
            {isEditModalOpen && selectedUser && (
                <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
                    <div className="modal modal-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{t('users.editRole')}</span>
                            <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); setErrorMessage(null); if (selectedUser) updateRoleMutation.mutate({ userId: selectedUser.id, role: editRole }); }}>
                            <div className="modal-body">
                                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                                    {t('users.updateRoleFor')} <strong style={{ color: 'var(--text-primary)' }}>{selectedUser.first_name} {selectedUser.last_name}</strong>
                                </p>
                                <label className="form-label">{t('users.newRole')}</label>
                                <CustomDropdown
                                    options={availableRolesToAssign.map(r => ({ value: r, label: t(`roles.${r}` as any) }))}
                                    value={editRole}
                                    onChange={setEditRole}
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setIsEditModalOpen(false)}>{t('confirm.cancel')}</button>
                                <button type="submit" className="btn btn-primary" disabled={updateRoleMutation.isPending}>
                                    {updateRoleMutation.isPending ? t('users.saving') : t('settings.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRM DELETE MODAL */}
            <ConfirmModal
                isOpen={!!confirmDelete}
                title={t('users.removeUser')}
                message={t('users.removeConfirmMsg').replace('{{name}}', `${confirmDelete?.first_name} ${confirmDelete?.last_name}`)}
                confirmLabel={t('users.confirmRemove')}
                danger
                onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete.id); }}
                onCancel={() => setConfirmDelete(null)}
            />

            {/* ACTIVITY LOGS MODAL */}
            {isActivityModalOpen && selectedUser && (
                <div className="modal-backdrop" style={{ alignItems: 'flex-start', paddingTop: '100px', paddingBottom: '40px', overflowY: 'auto' }} onClick={() => { setIsActivityModalOpen(false); setSelectedUser(null); }}>
                    <div className="modal modal-md animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <div>
                                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-blue)' }}>
                                        <path d="M12 20V10" />
                                        <path d="M18 20V4" />
                                        <path d="M6 20v-4" />
                                    </svg>
                                    {t('users.activityLogs')}
                                </span>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{t('users.trackingTasksFor')}</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{selectedUser.first_name} {selectedUser.last_name}</strong>
                                    <span className="badge badge-gray" style={{ fontSize: 10 }}>{t(`roles.${selectedUser.profile?.role}` as any)}</span>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => { setIsActivityModalOpen(false); setSelectedUser(null); }}>✕</button>
                        </div>

                        <div className="modal-body" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
                            {/* Filter Bar */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                                <div className="status-chip-group" style={{ margin: 0 }}>
                                    <button
                                        type="button"
                                        className={`status-chip ${activityScope === 'month' ? 'active' : ''}`}
                                        onClick={() => setActivityScope('month')}
                                        style={{ padding: '6px 14px', fontSize: 12.5 }}
                                    >
                                        {t('users.monthView')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`status-chip ${activityScope === 'year' ? 'active' : ''}`}
                                        onClick={() => setActivityScope('year')}
                                        style={{ padding: '6px 14px', fontSize: 12.5 }}
                                    >
                                        {t('users.yearView')}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {activityScope === 'month' && (
                                        <select
                                            className="form-input"
                                            style={{ width: 120, height: 36, padding: '0 10px', borderRadius: 8, fontSize: 13 }}
                                            value={selectedMonth}
                                            onChange={e => setSelectedMonth(Number(e.target.value))}
                                        >
                                            {MONTHS.map((m, idx) => (
                                                <option key={m} value={idx + 1}>{t(`months.${m.toLowerCase()}` as any)}</option>
                                            ))}
                                        </select>
                                    )}
                                    <select
                                        className="form-input"
                                        style={{ width: 90, height: 36, padding: '0 10px', borderRadius: 8, fontSize: 13 }}
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                    >
                                        {YEARS.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {isActivityLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                                    <div className="spinner" />
                                </div>
                            ) : !userActivity || userActivity.summary.total_assigned === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-subtle)' }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
                                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                    </svg>
                                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('users.noTasksAssigned')}</h4>
                                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>
                                        {t('users.noTasksAssignedDesc')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Stats cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                                        <div style={{ padding: '14px 16px', background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: 12 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{t('checklist.assigned')}</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{n(userActivity.summary.total_assigned)}</div>
                                        </div>
                                        <div style={{ padding: '14px 16px', background: 'rgba(34, 197, 94, 0.04)', border: '1px solid rgba(34, 197, 94, 0.15)', borderRadius: 12 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{t('users.completed')}</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{n(userActivity.summary.completed)}</div>
                                        </div>
                                        {userActivity.summary.partial > 0 && (
                                            <div style={{ padding: '14px 16px', background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: 12 }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{t('data.partial')}</div>
                                                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{n(userActivity.summary.partial)}</div>
                                            </div>
                                        )}
                                        <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 12 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{t('users.pendingTask')}</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{n(userActivity.summary.pending)}</div>
                                        </div>
                                        <div style={{ padding: '14px 16px', background: 'rgba(168, 85, 247, 0.04)', border: '1px solid rgba(168, 85, 247, 0.15)', borderRadius: 12 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{t('users.completion')}</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{n(userActivity.summary.completion_rate)}%</div>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            <span>{t('users.progress')}</span>
                                            <span>{t('users.tasksDone').replace('{{completed}}', n(userActivity.summary.completed)).replace('{{total}}', n(userActivity.summary.total_assigned))}</span>
                                        </div>
                                        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${userActivity.summary.completion_rate}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                                        </div>
                                    </div>

                                    {/* Task Checklist Items */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.2px', textTransform: 'uppercase', marginBottom: 4 }}>{t('users.assignedTasks')}</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {userActivity.tasks.map((task: any, idx: number) => {
                                                const catInfo = CATEGORY_CONFIG[task.category as 'E'|'S'|'G'] || { label: task.category, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
                                                
                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.015)',
                                                            border: '1px solid var(--border-subtle)',
                                                            borderRadius: 12,
                                                            padding: 12,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 10
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span
                                                                    className="badge"
                                                                    style={{
                                                                        background: catInfo.bg,
                                                                        color: catInfo.color,
                                                                        border: `1px solid ${catInfo.color}30`,
                                                                        fontSize: 10,
                                                                        fontWeight: 800
                                                                    }}
                                                                >
                                                                    {task.category}
                                                                </span>
                                                                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{task.name}</strong>
                                                            </div>

                                                            <div>
                                                                {task.status === 'complete' && (
                                                                    <span className="badge badge-green">{t('users.badgeComplete')}</span>
                                                                )}
                                                                {task.status === 'partial' && (
                                                                    <span className="badge badge-amber">{t('users.badgePartial')}</span>
                                                                )}
                                                                {task.status === 'pending' && (
                                                                    <span className="badge badge-red">{t('users.badgePending')}</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 8 }}>
                                                            <div>{t('users.frequency')} <strong style={{ color: 'var(--text-secondary)' }}>{task.frequency}</strong></div>
                                                            <div>{t('users.scope')} <strong style={{ color: 'var(--text-secondary)' }}>{task.details}</strong></div>
                                                            {task.latest_submission && (
                                                                <>
                                                                    <div>{t('users.value')} <strong style={{ color: 'var(--accent-blue)' }}>{n(task.latest_submission.value)}</strong></div>
                                                                    <div>
                                                                        {t('users.submittedBy')} <strong style={{ color: 'var(--text-secondary)' }}>{task.latest_submission.submitted_by || t('users.unknown')}</strong>
                                                                    </div>
                                                                    <div>
                                                                        {t('users.dateLabel')} <strong style={{ color: 'var(--text-secondary)' }}>{n(new Date(task.latest_submission.submitted_at).toLocaleDateString())}</strong>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        
                                                        {task.latest_submission?.notes && (
                                                            <div style={{ fontSize: 11, background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: 6, borderLeft: '2px solid var(--border-subtle)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                "{task.latest_submission.notes}"
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                            <button type="button" className="btn btn-secondary" onClick={() => { setIsActivityModalOpen(false); setSelectedUser(null); }}>
                                {t('users.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
