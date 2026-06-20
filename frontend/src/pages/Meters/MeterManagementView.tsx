import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useSiteStore } from '../../stores/siteStore';
import AppLayout from '../../components/layout/AppLayout';
import AccessDenied from '../../components/ui/AccessDenied';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useTranslation, translateUnitStr, translateMeterName } from '../../i18n';

interface Meter {
    id: number;
    data_element_id: number;
    element_name: string;
    category: 'E' | 'S' | 'G';
    unit: string;
    name: string;
    meter_type: string;
    account_number: string | null;
    location: string | null;
    is_active: boolean;
    created_at: string;
}


// Selection Card Styles
const selectionCardStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 20,
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 16,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
    textAlign: 'center' as const,
};

export default function MeterManagementView() {
    const { t, n } = useTranslation();
    const queryClient = useQueryClient();
    const userRole = useAuthStore(state => state.user?.profile?.role);
    const currentSiteId = useSiteStore(s => s.currentSiteId);
    const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
    const [editForm, setEditForm] = useState({ name: '', account_number: '', location: '' });
    const [isCreating, setIsCreating] = useState(false);
    const [creationStep, setCreationStep] = useState(1);
    const [createForm, setCreateForm] = useState({ data_element_id: '', name: '', account_number: '', location: '' });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [confirmDeleteMeter, setConfirmDeleteMeter] = useState<Meter | null>(null);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

    const getTypeIcon = (type: string): { icon: React.ReactNode, bg: string, color: string, label: string } => {
        const typeLower = type?.toLowerCase() || '';
        const props = { width: 14, height: 14, strokeWidth: 2.5, stroke: "currentColor" };

        if (typeLower.includes('elect')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
            bg: 'rgba(234, 88, 12, 0.15)', color: '#fb923c', label: t('meters.types.electricity')
        };
        if (typeLower.includes('cooling') || typeLower.includes('chill')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M2 12h10M9 4v16M3 9l3 3-3 3M12 12h10M15 4v16M21 9l-3 3 3 3" /></svg>,
            bg: 'rgba(3, 105, 161, 0.15)', color: '#38bdf8', label: t('meters.types.cooling')
        };
        if (typeLower.includes('heating') || typeLower.includes('hot')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M12 2v2M12 18v4M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /><circle cx="12" cy="12" r="4" /></svg>,
            bg: 'rgba(225, 29, 72, 0.15)', color: '#fb7185', label: t('meters.types.heating')
        };
        if (typeLower.includes('water')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5s-3 3.5-3 5.5a7 7 0 0 0 7 7z" /></svg>,
            bg: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', label: t('meters.types.water')
        };
        if (typeLower.includes('fuel') || typeLower.includes('gas') || typeLower.includes('lpg')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M3 22V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12M7 2h10M12 2v6M12 11v3M12 17v2" /></svg>,
            bg: 'rgba(220, 38, 38, 0.15)', color: '#f87171', label: t('meters.types.fuel_gas')
        };
        if (typeLower.includes('steam')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M17.5 19c.7 0 1.3-.2 1.8-.7s.7-1.1.7-1.8c0-2.5-3.5-3.5-3.5-3.5s-3.5 1-3.5 3.5c0 .7.2 1.3.7 1.8s1.1.7 1.8.7zM7.5 19c.7 0 1.3-.2 1.8-.7s.7-1.1.7-1.8c0-2.5-3.5-3.5-3.5-3.5s-3.5 1-3.5 3.5c0 .7.2 1.3.7 1.8s1.1.7 1.8.7zM12.5 13c.7 0 1.3-.2 1.8-.7s.7-1.1.7-1.8c0-2.5-3.5-3.5-3.5-3.5s-3.5 1-3.5 3.5c0 .7.2 1.3.7 1.8s1.1.7 1.8.7z" /></svg>,
            bg: 'rgba(71, 85, 105, 0.15)', color: '#94a3b8', label: t('meters.types.steam')
        };
        if (typeLower.includes('waste')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M7 11V7a5 5 0 0 1 10 0v4" /><path d="M12 18v2M12 7l4 4-4 4" /></svg>,
            bg: 'rgba(22, 163, 74, 0.15)', color: '#4ade80', label: t('meters.types.waste')
        };
        if (typeLower.includes('renew')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8a7 7 0 0 1-10 10z" /><path d="M12 10.5c0-3 .5-3 2-3" /><path d="m19 10-1.5 1.5" /></svg>,
            bg: 'rgba(13, 148, 136, 0.15)', color: '#2dd4bf', label: t('meters.types.renewables')
        };
        if (typeLower.includes('energy')) return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="16" height="10" rx="2" /><path d="M22 11v2M6 11v2M10 11v2M14 11v2" /></svg>,
            bg: 'rgba(202, 138, 4, 0.15)', color: '#facc15', label: t('meters.types.energy')
        };
        return {
            icon: <svg {...props} viewBox="0 0 24 24" fill="none"><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>,
            bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', label: t(`meters.types.${typeLower.replace('/', '_').replace(' ', '_')}` as any, type)
        };
    };

    const { data: dataElements } = useQuery<any[]>({
        queryKey: ['data-elements'],
        queryFn: async () => {
            const res = await api.get('/data-elements/');
            return res.data.filter((d: any) => d.is_metered);
        }
    });

    const { data: meters, isLoading, error } = useQuery<Meter[]>({
        queryKey: ['meters', currentSiteId],
        queryFn: async () => {
            const res = await api.get('/meters/me');
            return res.data;
        }
    });

    // Check for access denied
    const isForbidden = (error as any)?.response?.status === 403;

    const updateMeterMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const res = await api.put(`/meters/${id}`, data);
            return res.data;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['meters', currentSiteId] }); setEditingMeter(null); }
    });

    const createMeterMutation = useMutation({
        mutationFn: async (data: any) => { const res = await api.post('/meters/', data); return res.data; },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meters', currentSiteId] });
            setIsCreating(false);
            setCreationStep(1);
            setCreateForm({ data_element_id: '', name: '', account_number: '', location: '' });
        },
        onError: (error: any) => {
            const msg = error.response?.data?.detail || error.message || 'Failed to create meter';
            setErrorMessage(Array.isArray(msg) ? JSON.stringify(msg) : msg);
        }
    });

    const toggleStatusMutation = useMutation({
        mutationFn: async (id: number) => { const res = await api.post(`/meters/${id}/toggle-active`); return res.data; },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meters', currentSiteId] })
    });

    const deleteMeterMutation = useMutation({
        mutationFn: async (id: number) => { const res = await api.delete(`/meters/${id}`); return res.data; },
        onSuccess: () => { setConfirmDeleteMeter(null); queryClient.invalidateQueries({ queryKey: ['meters', currentSiteId] }); },
        onError: (error: any) => {
            setErrorMessage(error.response?.status === 400 ? error.response.data.detail : 'Failed to delete meter.');
            setConfirmDeleteMeter(null);
        }
    });

    const canAdmin = ['super_user', 'admin', 'site_manager', 'meter_manager'].includes(userRole || '');
    const activeMeters = meters?.filter(m => m.is_active).length ?? 0;

    const availableTypes = Array.from(new Set(meters?.map(m => m.meter_type) || []));

    const filteredMeters = meters?.filter(m => {
        const matchesSearch = !searchQuery || 
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            translateMeterName(m.name, t).toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.account_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.location || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesType = typeFilter === 'all' || m.meter_type === typeFilter;
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? m.is_active : !m.is_active);
        
        return matchesSearch && matchesType && matchesStatus;
    });

    const counts = {
        all: meters?.length ?? 0,
        active: meters?.filter(m => m.is_active).length ?? 0,
        archived: meters?.filter(m => !m.is_active).length ?? 0,
        ...availableTypes.reduce((acc, type) => {
            acc[type] = meters?.filter(m => m.meter_type === type).length ?? 0;
            return acc;
        }, {} as Record<string, number>)
    } as Record<string, number>;

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
        return <AccessDenied showLayout title={t('meters.restrictedTitle')} message={t('meters.restrictedMsg')} />;
    }

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t('meters.title')}</h1>
                        <p className="page-subtitle">{t('meters.subtitle')}</p>
                    </div>
                    {canAdmin && (
                        <button className="btn btn-primary" onClick={() => { setErrorMessage(null); setCreationStep(1); setIsCreating(true); }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {t('meters.addMeter')}
                        </button>
                    )}
                </div>

                {/* Stat Cards */}
                <div className="stat-card-grid stat-card-grid-3" style={{ marginBottom: 24 }}>
                    <div className="stat-card blue">
                        <div className="stat-card-header">
                            <span className="stat-card-label">{t('meters.totalMeters')}</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{n(meters?.length ?? 0)}</div>
                    </div>
                    <div className="stat-card green">
                        <div className="stat-card-header">
                            <span className="stat-card-label">{t('meters.active')}</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{n(activeMeters)}</div>
                    </div>
                    <div className="stat-card amber">
                        <div className="stat-card-header">
                            <span className="stat-card-label">{t('meters.archived')}</span>
                            <div className="stat-card-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" />
                                </svg>
                            </div>
                        </div>
                        <div className="stat-card-value">{n((meters?.length ?? 0) - activeMeters)}</div>
                    </div>
                </div>

                {/* Error */}
                {errorMessage && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        ⚠ {errorMessage}
                        <button onClick={() => setErrorMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
                    </div>
                )}

                {/* Command Filter Bar */}
                <div className="command-bar animate-slide-up">
                    <div className="command-bar-main">
                        <div className="type-filter-group" style={{ flex: 1, overflowX: 'auto' }}>
                            <button
                                className={`type-btn ${typeFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('all')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                                </svg>
                                <span>{t('meters.allMeters')}</span>
                                <span className="type-count">{n(counts.all)}</span>
                            </button>
                            {availableTypes.map(type => {
                                const typeInfo = getTypeIcon(type);
                                return (
                                    <button
                                        key={type}
                                        className={`type-btn ${typeFilter === type ? 'active' : ''}`}
                                        onClick={() => setTypeFilter(type)}
                                        style={{ minWidth: '130px', justifyContent: 'center' }}
                                    >
                                        <div style={{ color: typeInfo.color, display: 'flex', alignItems: 'center' }}>{typeInfo.icon}</div>
                                        <span style={{ textTransform: 'capitalize' }}>{t(`meters.types.${type.toLowerCase().replace('/', '_').replace(' ', '_')}` as any, type)}</span>
                                        <span className="type-count">{n(counts[type] || 0)}</span>
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
                                <div className="dot green" /> {t('meters.active')} <span className="s-count">{n(counts.active)}</span>
                            </button>
                            <button
                                className={`status-chip gray ${statusFilter === 'archived' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('archived')}
                            >
                                <div className="dot red" /> {t('meters.archived')} <span className="s-count">{n(counts.archived)}</span>
                            </button>
                        </div>

                        <div className="integrated-search" style={{ width: '220px', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder={t('meters.searchPlaceholder')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Meter List (Card-Based) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {(() => {
                        if (!filteredMeters?.length) return (
                            <div className="dark-table-wrap" style={{ border: 'none', background: 'transparent' }}>
                                <div style={{ padding: '80px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)' }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 20, opacity: 0.6 }}>
                                        <path d="m12 14 4-4" />
                                        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
                                    </svg>
                                    <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{searchQuery ? t('meters.noMatching') : t('meters.noMeters')}</h3>
                                    <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
                                        {searchQuery ? t('meters.adjustFilters') : t('meters.noMetersDesc')}
                                    </p>
                                </div>
                            </div>
                        );

                        // Group by meter_type
                        const groups: Record<string, { category: string, unit: string, meters: Meter[] }> = {};
                        filteredMeters.forEach(m => {
                            const typeKey = m.meter_type || 'Other';
                            if (!groups[typeKey]) {
                                groups[typeKey] = {
                                    category: m.category,
                                    unit: m.unit,
                                    meters: []
                                };
                            }
                            groups[typeKey].meters.push(m);
                        });

                        return Object.entries(groups).map(([type, group]) => {
                            const typeInfo = getTypeIcon(type);

                            return (
                                <div key={type} className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {/* Group Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', marginBottom: 2 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: 8,
                                            background: typeInfo.bg,
                                            color: typeInfo.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: `0 3px 8px ${typeInfo.bg}60`
                                        }}>
                                            <div style={{ transform: 'scale(0.6)' }}>{typeInfo.icon}</div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.2px', textTransform: 'capitalize' }}>
                                                    {t('meters.groupTitle').replace('{{type}}', t(`meters.types.${type.toLowerCase().replace('/', '_').replace(' ', '_')}` as any, type))}
                                                </h3>
                                                <span className="badge badge-gray" style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{n(group.meters.length)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Meter Cards List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {group.meters.sort((a,b) => a.id - b.id).map(meter => {
                                            const isMain = meter.name.toLowerCase().includes('main');
                                            
                                            return (
                                                <div 
                                                    key={meter.id}
                                                    className="meter-row-card"
                                                    style={{
                                                        background: 'var(--bg-elevated)',
                                                        border: `1px solid ${meter.is_active ? 'var(--border-subtle)' : 'rgba(255,255,255,0.05)'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: '8px 16px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        transition: 'all 0.2s ease',
                                                        opacity: meter.is_active ? 1 : 0.7,
                                                        position: 'relative',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {/* Active Indicator Line (Synced with Type Color) */}
                                                    {meter.is_active && (
                                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: typeInfo.color }} />
                                                    )}

                                                    {/* Resource Icon (Streamlined) */}
                                                    <div style={{
                                                        width: 38, height: 38, borderRadius: 8,
                                                        background: typeInfo.bg,
                                                        color: typeInfo.color,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0,
                                                        boxShadow: `0 2px 6px ${typeInfo.bg}30`
                                                    }}>
                                                        <div style={{ transform: 'scale(0.75)' }}>{typeInfo.icon}</div>
                                                    </div>

                                                    {/* Status Badge Group (Resized) */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 85, alignItems: 'center', flexShrink: 0 }}>
                                                        <span className={`badge ${meter.is_active ? (isMain ? 'badge-blue' : 'badge-green') : 'badge-gray'}`} style={{ fontSize: 10, width: '100%', textAlign: 'center', padding: '3px 6px', fontWeight: 800 }}>
                                                            {isMain ? t('meters.main') : t('meters.subMeter')}
                                                        </span>
                                                        {!meter.is_active && <span style={{ fontSize: 8, fontWeight: 800, color: '#f87171', textTransform: 'uppercase', marginTop: 1 }}>{t('meters.archivedBadge')}</span>}
                                                    </div>

                                                    {/* Meter Identity (Enhanced Readability) */}
                                                    <div style={{ flex: 1, minWidth: 150 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                            <div style={{ fontWeight: 800, color: meter.is_active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 14.5 }}>
                                                                {translateMeterName(meter.name, t)}
                                                            </div>
                                                            {isMain && (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2C6.5 2 2 6.5 2 12c0 3 1.3 5.7 3.5 7.5" opacity="0.6" />
    <path d="M12 6a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6 2.3 0 4.3-1.3 5.3-3.3" />
    <circle cx="12" cy="12" r="2.5" fill="var(--accent-blue)" stroke="none" />
    <path d="M18.5 11c0-2-1.5-3.5-3.5-3.5S11.5 9 11.5 11s1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5Z" fill="var(--accent-blue)" stroke="none" />
</svg>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: meter.location ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 11.5 }}>
                                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-green)', opacity: 0.8 }}>
                                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                                                </svg>
                                                                <span style={{ fontWeight: 500 }}>{meter.location ? t(meter.location) : t('meters.locationNotSet')}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: meter.account_number ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 11.5 }}>
                                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                                </svg>
                                                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{meter.account_number || t('meters.noAccount')}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Unit Display */}
                                                    <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-subtle)', textAlign: 'center', flexShrink: 0 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 800, color: typeInfo.color }}>{translateUnitStr(group.unit, t)}</div>
                                                    </div>

                                                    {/* Actions Toolbar */}
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 10 }}>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ height: 28, fontSize: 10, padding: '0 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}
                                                            onClick={() => {
                                                                setEditingMeter(meter);
                                                                setEditForm({ name: meter.name, account_number: meter.account_number || '', location: meter.location || '' });
                                                            }}
                                                        >
                                                            {t('meters.editMeter')}
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ height: 28, fontSize: 10, padding: '0 10px' }}
                                                            onClick={() => toggleStatusMutation.mutate(meter.id)}
                                                        >
                                                            {meter.is_active ? t('meters.archiveAction') : t('meters.activateAction')}
                                                        </button>
                                                        {canAdmin && (
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                onClick={() => setConfirmDeleteMeter(meter)}
                                                                title={t('meters.deleteMeter')}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* EDIT MODAL */}
            {editingMeter && (
                <div className="modal-backdrop" onClick={() => setEditingMeter(null)}>
                    <div className="modal modal-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{t('meters.editMeter')}</span>
                            <button className="modal-close" onClick={() => setEditingMeter(null)}>✕</button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); if (editingMeter) updateMeterMutation.mutate({ id: editingMeter.id, data: editForm }); }}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label className="form-label">{t('meters.meterName')}</label>
                                    <input required type="text" className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">{t('meters.location')}</label>
                                    <input type="text" className="form-input" placeholder={t('meters.locationPlaceholder')} value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">{t('meters.accountNo')}</label>
                                    <input type="text" className="form-input" placeholder={t('meters.accountPlaceholder')} value={editForm.account_number} onChange={e => setEditForm({ ...editForm, account_number: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setEditingMeter(null)}>{t('confirm.cancel')}</button>
                                <button type="submit" className="btn btn-primary" disabled={updateMeterMutation.isPending}>
                                    {updateMeterMutation.isPending ? t('data.saving') : t('settings.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE MODAL */}
            {isCreating && (
                <div className="modal-backdrop" onClick={() => { setIsCreating(false); setCreationStep(1); }}>
                    <div className="modal modal-md animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: creationStep === 1 ? 650 : 500 }}>
                        <div className="modal-header">
                            <span className="modal-title">{creationStep === 1 ? t('meters.selectType') : t('meters.newMeterTitle').replace('{{type}}', t(`meters.types.${createForm.data_element_id.toLowerCase().replace('/', '_').replace(' ', '_')}` as any, createForm.data_element_id))}</span>
                            <button className="modal-close" onClick={() => { setIsCreating(false); setCreationStep(1); }}>✕</button>
                        </div>

                        {creationStep === 1 ? (
                            <div className="modal-body">
                                <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{t('meters.chooseResourceType')}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
                                    {Array.from(new Set(dataElements?.map(el => el.meter_type).filter(Boolean))).map(type => {
                                        const cfg = getTypeIcon(type as string);
                                        return (
                                            <button
                                                key={type as string}
                                                onClick={() => {
                                                    setCreateForm({ ...createForm, data_element_id: type as string });
                                                    setCreationStep(2);
                                                }}
                                                style={selectionCardStyle}
                                                className="hover-scale"
                                            >
                                                <div style={{
                                                    fontSize: 36, width: 80, height: 80, borderRadius: 24,
                                                    background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', boxShadow: `0 8px 16px ${cfg.bg}80`
                                                }}>
                                                    {cfg.icon}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 16 }}>{t(`meters.types.${(type as string).toLowerCase().replace('/', '_').replace(' ', '_')}` as any, type as string)}</span>
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{t('meters.trackType').replace('{{type}}', cfg.label)}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={e => {
                                e.preventDefault();
                                const targetElement = dataElements?.find(el => el.meter_type === createForm.data_element_id);
                                if (!targetElement) { setErrorMessage("Invalid meter type selected."); return; }
                                createMeterMutation.mutate({
                                    data_element_id: targetElement.id,
                                    name: createForm.name,
                                    account_number: createForm.account_number || null,
                                    location: createForm.location || null,
                                });
                            }}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div>
                                        <label className="form-label">{t('meters.meterName')}</label>
                                        <input required type="text" className="form-input" placeholder={t('meters.namePlaceholder')} value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label className="form-label">{t('meters.location')}</label>
                                            <input type="text" className="form-input" placeholder={t('meters.locationPlaceholder2')} value={createForm.location} onChange={e => setCreateForm({ ...createForm, location: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="form-label">{t('meters.accountNo')}</label>
                                            <input type="text" className="form-input" placeholder={t('meters.optional')} value={createForm.account_number} onChange={e => setCreateForm({ ...createForm, account_number: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid var(--border-subtle)', fontSize: 13 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10,
                                                background: getTypeIcon(createForm.data_element_id).bg,
                                                color: getTypeIcon(createForm.data_element_id).color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <div style={{ transform: 'scale(0.8)' }}>
                                                    {getTypeIcon(createForm.data_element_id).icon}
                                                </div>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)' }}>{t('meters.resourceType')} </span>
                                                <strong style={{ color: 'var(--text-primary)' }}>{getTypeIcon(createForm.data_element_id).label}</strong>
                                            </div>
                                            <button type="button" onClick={() => setCreationStep(1)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>{t('meters.change')}</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer" style={{ marginTop: 8 }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setCreationStep(1)}>{t('data.back')}</button>
                                    <button type="submit" className="btn btn-primary" disabled={createMeterMutation.isPending}>
                                        {createMeterMutation.isPending ? t('meters.addingMeter') : t('meters.createMeter')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            <ConfirmModal
                isOpen={!!confirmDeleteMeter}
                title={t('meters.deleteMeter')}
                message={t('meters.deleteConfirmMsg').replace('{{name}}', translateMeterName(confirmDeleteMeter?.name || '', t))}
                confirmLabel={t('confirm.delete')}
                danger
                onConfirm={() => { if (confirmDeleteMeter) deleteMeterMutation.mutate(confirmDeleteMeter.id); }}
                onCancel={() => setConfirmDeleteMeter(null)}
            />
        </AppLayout>
    );
}
