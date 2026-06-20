import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../services/api';
import { BASE_URL } from '../../config';
import { useAuthStore } from '../../stores/authStore';
import { useSiteStore } from '../../stores/siteStore';
import AppLayout from '../../components/layout/AppLayout';
import AccessDenied from '../../components/ui/AccessDenied';
import { canPerformAction } from '../../config/rbac';
import { useTranslation, translateUnitStr, translateMeterName } from '../../i18n';

interface GridRow {
    row_id: string;
    data_element_id: number;
    checklist_id: number;
    meter_id: number | null;
    name: string;
    category: 'E' | 'S' | 'G';
    unit: string | null;
    is_meter: boolean;
    value: number | string;
    notes: string;
    evidence_files: string | null;
    collection_frequency: string;
    assigned_to: number | null;
    assigned_user_name: string | null;
}

interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    profile?: {
        role: string;
    } | null;
}

const ROLE_HIERARCHY: Record<string, string[]> = {
    'super_user': ['admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'],
    'admin': ['site_manager', 'uploader', 'viewer', 'meter_manager'],
    'site_manager': ['uploader', 'viewer', 'meter_manager'],
};



const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_CONFIG = {
    E: { labelKey: 'data.env', color: 'var(--color-env)', bg: 'var(--color-env-bg)' },
    S: { labelKey: 'data.soc', color: 'var(--color-soc)', bg: 'var(--color-soc-bg)' },
    G: { labelKey: 'data.gov', color: 'var(--color-gov)', bg: 'var(--color-gov-bg)' },
};

// Normalize evidence_files from the API to a plain string
function toEvidenceStr(raw: unknown): string {
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw[0] || '';
    return String(raw);
}

function getStatusClass(value: string | number, evidence: string): string {
    if (evidence) return 'status-complete';
    if (value !== '' && value !== null && value !== undefined) return 'status-partial';
    return 'status-missing';
}

function StatusBadge({ value, evidence }: { value: string | number, evidence: string }) {
    const { t } = useTranslation();
    const status = getStatusClass(String(value), evidence);
    if (status === 'status-complete') {
        return <span className="badge badge-green">{t('data.complete')}</span>;
    }
    if (status === 'status-partial') {
        return <span className="badge badge-amber">{t('data.partial')}</span>;
    }
    return <span className="badge badge-red">{t('data.missing')}</span>;
}

export default function DataEntryView() {
    const { t, n } = useTranslation();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    const getMonthLabel = (mNum: number) => {
        const keys = [
            'months.january', 'months.february', 'months.march', 'months.april',
            'months.may', 'months.june', 'months.july', 'months.august',
            'months.september', 'months.october', 'months.november', 'months.december'
        ];
        return t(keys[mNum - 1]);
    };

    const getShortMonthLabel = (mNum: number) => {
        const keys = [
            'months.short.jan', 'months.short.feb', 'months.short.mar', 'months.short.apr',
            'months.short.may', 'months.short.jun', 'months.short.jul', 'months.short.aug',
            'months.short.sep', 'months.short.oct', 'months.short.nov', 'months.short.dec'
        ];
        return t(keys[mNum - 1]);
    };

    const currentSiteId = useSiteStore(s => s.currentSiteId);
    const currentDate = new Date();
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [localData, setLocalData] = useState<Record<string, { value: string | number; notes: string; evidence_files: string }>>({});
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
    const yearRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'monthly' | 'annual' | 'events'>('monthly');
    const [statusFilter, setStatusFilter] = useState<'all' | 'metered' | 'complete' | 'partial' | 'missing'>('all');

    const canUpdate = canPerformAction(user?.profile?.role, 'data_entry', 'update');

    const [assignmentModal, setAssignmentModal] = useState<{
        isOpen: boolean;
        checklistId: number | null;
        assignedUserId: number | '';
        rowName: string;
    }>({ isOpen: false, checklistId: null, assignedUserId: '', rowName: '' });

    const [pendingUpload, setPendingUpload] = useState<{ row_id: string; file: File; previewUrl: string | null } | null>(null);
    const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);

    const [modalMode, setModalMode] = useState<'ASSIGN' | 'INVITE'>('ASSIGN');
    const [inviteForm, setInviteForm] = useState({
        email: '',
        first_name: '',
        last_name: '',
        role: '',
    });
    const [inviteError, setInviteError] = useState<string | null>(null);

    const modalInviteMutation = useMutation({
        mutationFn: async (data: typeof inviteForm) => {
            const isAdminRole = data.role === 'admin' || data.role === 'super_user';
            const payload = { ...data, site_id: isAdminRole ? null : currentSiteId };
            const res = await api.post('/users/invite', payload);
            return res.data;
        },
        onSuccess: (newUser) => {
            queryClient.invalidateQueries({ queryKey: ['companyUsers', currentSiteId] });
            setAssignmentModal(prev => ({ ...prev, assignedUserId: newUser.id }));
            setModalMode('ASSIGN');
            setInviteForm({ email: '', first_name: '', last_name: '', role: '' });
            setInviteError(null);
        },
        onError: (err: any) => {
            setInviteError(err.response?.data?.detail || 'Failed to invite user');
        }
    });

    useEffect(() => {
        if (!assignmentModal.isOpen) {
            setModalMode('ASSIGN');
            setInviteForm({ email: '', first_name: '', last_name: '', role: '' });
            setInviteError(null);
        }
    }, [assignmentModal.isOpen]);

    const { data: gridData, isLoading, error } = useQuery<GridRow[]>({
        queryKey: ['submissions', year, month, currentSiteId],
        queryFn: async () => {
            const res = await api.get(`/submissions/grid/${year}/${month}?site_id=${currentSiteId}`);
            return res.data;
        }
    });

    const isForbidden = (error as any)?.response?.status === 403;

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['companyUsers', currentSiteId],
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
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            setAssignmentModal(prev => ({ ...prev, isOpen: false }));
        }
    });

    useEffect(() => {
        if (gridData) {
            const initialMap: Record<string, { value: string | number; notes: string; evidence_files: string }> = {};
            gridData.forEach(row => {
                initialMap[row.row_id] = {
                    value: row.value !== null && row.value !== undefined ? row.value : '',
                    notes: row.notes || '',
                    evidence_files: toEvidenceStr(row.evidence_files),
                };
            });
            setLocalData(initialMap);
        }
    }, [gridData]);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (yearRef.current && !yearRef.current.contains(e.target as Node)) {
                setYearDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const bulkSaveMutation = useMutation({
        mutationFn: async ({ isAutoSave = false, overrideEntries = null }: { isAutoSave?: boolean; overrideEntries?: any[] | null } = {}) => {
            if (!gridData) return { isAutoSave };

            const entries = overrideEntries ?? gridData.map(row => {
                const updated = localData[row.row_id];
                return {
                    data_element_id: row.data_element_id,
                    meter_id: row.meter_id,
                    value: updated?.value === '' ? null : Number(updated?.value),
                    notes: updated?.notes === '' ? null : updated?.notes,
                    evidence_files: updated?.evidence_files === '' ? null : updated?.evidence_files,
                };
            });

            const res = await api.post(`/submissions/bulk?site_id=${currentSiteId}`, { year, month, entries });
            return { data: res.data, isAutoSave };
        },
        onSuccess: (result: any) => {
            if (result?.data && !result?.isAutoSave) {
                setSaveMessage({ type: 'success', text: `Saved! Created ${result.data.created}, updated ${result.data.updated} records.` });
                setTimeout(() => setSaveMessage(null), 4000);
            }
            queryClient.invalidateQueries({ queryKey: ['submissions', year, month, currentSiteId] });
        },
        onError: (error: any) => {
            const msg = error.response?.data?.detail || 'Failed to save data.';
            setSaveMessage({ type: 'error', text: msg });
        }
    });

    const handleValueChange = (row_id: string, value: string) => {
        setLocalData(prev => ({ ...prev, [row_id]: { ...prev[row_id], value } }));
    };

    const handleFileUpload = async (row_id: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post(`/submissions/evidence?site_id=${currentSiteId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const fileUrl = toEvidenceStr(res.data.url);

            // Update local state
            setLocalData(prev => ({ ...prev, [row_id]: { ...prev[row_id], evidence_files: fileUrl } }));

            // Trigger auto-save with the NEW data for this specific row immediately
            // to avoid state race condition
            if (gridData) {
                const entries = gridData.map(row => {
                    const rowLocal = localData[row.row_id];
                    let val = rowLocal?.value;
                    let nts = rowLocal?.notes;
                    let ev = rowLocal?.evidence_files;

                    if (row.row_id === row_id) {
                        ev = fileUrl;
                    }

                    return {
                        data_element_id: row.data_element_id,
                        meter_id: row.meter_id,
                        value: val === '' ? null : Number(val),
                        notes: nts === '' ? null : nts,
                        evidence_files: ev === '' ? null : ev,
                    };
                });
                bulkSaveMutation.mutate({ isAutoSave: true, overrideEntries: entries });
            }
        } catch {
            setSaveMessage({ type: 'error', text: 'Failed to upload evidence file.' });
            setTimeout(() => setSaveMessage(null), 4000);
        }
    };

    const handleDeleteFile = (row_id: string) => {
        // Update local state
        setLocalData(prev => ({ ...prev, [row_id]: { ...prev[row_id], evidence_files: '' } }));

        // Trigger auto-save immediately to clear it on backend
        if (gridData) {
            const entries = gridData.map(row => {
                const rowLocal = localData[row.row_id];
                let val = rowLocal?.value;
                let nts = rowLocal?.notes;
                let ev = rowLocal?.evidence_files;

                if (row.row_id === row_id) {
                    ev = '';
                }

                return {
                    data_element_id: row.data_element_id,
                    meter_id: row.meter_id,
                    value: val === '' ? null : Number(val),
                    notes: nts === '' ? null : nts,
                    evidence_files: ev === '' ? null : ev,
                };
            });
            bulkSaveMutation.mutate({ isAutoSave: true, overrideEntries: entries });
        }
    };

    // Group rows by category
    const filteredRows = gridData?.filter(row => {
        const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase());
        const freq = row.collection_frequency?.toLowerCase() || '';

        // 1. Type Filter Logic
        let matchesType = true;
        if (typeFilter === 'monthly') {
            matchesType = freq === 'monthly' || freq === 'daily';
        } else if (typeFilter === 'annual') {
            matchesType = freq === 'annual';
        } else if (typeFilter === 'events') {
            matchesType = freq !== 'monthly' && freq !== 'daily' && freq !== 'annual' && freq !== '';
        }

        // 2. Status Filter Logic
        let matchesStatus = true;
        const local = localData[row.row_id];
        const hasValue = local?.value !== '' && local?.value !== null;
        const hasEvidence = !!local?.evidence_files;

        if (statusFilter === 'metered') {
            matchesStatus = row.is_meter;
        } else if (statusFilter === 'complete') {
            matchesStatus = hasValue && hasEvidence;
        } else if (statusFilter === 'partial') {
            matchesStatus = (hasValue || hasEvidence) && !(hasValue && hasEvidence);
        } else if (statusFilter === 'missing') {
            matchesStatus = !hasValue && !hasEvidence;
        }

        return matchesSearch && matchesType && matchesStatus;
    }) || [];

    const grouped: Record<'E' | 'S' | 'G', GridRow[]> = { E: [], S: [], G: [] };
    filteredRows.forEach(row => {
        if (grouped[row.category] !== undefined) grouped[row.category].push(row);
    });

    // Dynamic Counts for UI
    const counts = {
        monthly: gridData?.filter(r => r.collection_frequency?.toLowerCase() === 'monthly' || r.collection_frequency?.toLowerCase() === 'daily').length || 0,
        annual: gridData?.filter(r => r.collection_frequency?.toLowerCase() === 'annual' && !r.name.toLowerCase().includes('event')).length || 0,
        events: gridData?.filter(r => {
            const freq = r.collection_frequency?.toLowerCase() || '';
            const isEvent = r.name.toLowerCase().includes('event') || r.name.toLowerCase().includes('party') || r.name.toLowerCase().includes('celebration');
            return isEvent || (freq !== 'monthly' && freq !== 'daily' && freq !== 'annual' && freq !== '');
        }).length || 0,
        metered: gridData?.filter(r => r.is_meter).length || 0,
        complete: gridData?.filter(r => {
            const l = localData[r.row_id];
            return (l?.value !== '' && l?.value !== null) && !!l?.evidence_files;
        }).length || 0,
        partial: gridData?.filter(r => {
            const l = localData[r.row_id];
            const hasV = l?.value !== '' && l?.value !== null;
            const hasE = !!l?.evidence_files;
            return (hasV || hasE) && !(hasV && hasE);
        }).length || 0,
        missing: gridData?.filter(r => {
            const l = localData[r.row_id];
            return (l?.value === '' || l?.value === null) && !l?.evidence_files;
        }).length || 0,
    };

    // Progress stats - Calculated based on CURRENTLY FILTERED rows
    const total = filteredRows.length;
    const withValue = filteredRows.filter(r => {
        const v = localData[r.row_id]?.value;
        return v !== '' && v !== null && v !== undefined;
    }).length;
    const withEvidenceRows = filteredRows.filter(r => localData[r.row_id]?.evidence_files).length;

    const dataProgress = total > 0 ? Math.round((withValue / total) * 100) : 0;
    const evidenceProgress = total > 0 ? Math.round((withEvidenceRows / total) * 100) : 0;

    const years = [year - 2, year - 1, year, year + 1];

    if (isForbidden) {
        return <AccessDenied showLayout title={t('data.restrictedTitle')} message={t('data.restrictedMsg')} />;
    }

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t('data.title')}</h1>
                        <p className="page-subtitle">{t('data.subtitle')}</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        disabled={bulkSaveMutation.isPending || !gridData?.length || !canUpdate}
                        onClick={() => bulkSaveMutation.mutate({ isAutoSave: false })}
                    >
                        {bulkSaveMutation.isPending ? (
                            <>
                                <div className="spinner spinner-sm" />
                                {t('data.saving')}
                            </>
                        ) : (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                {t('data.saveData')}
                            </>
                        )}
                    </button>
                </div>

                {/* Reporting Period */}
                <div className="reporting-period-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div className="reporting-period-title">{t('data.reportingPeriod')}</div>

                        {/* Year Dropdown */}
                        <div className="dropdown-wrapper" ref={yearRef}>
                            <div
                                className={`dropdown-trigger ${yearDropdownOpen ? 'open' : ''}`}
                                onClick={() => setYearDropdownOpen(o => !o)}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <span style={{ fontWeight: 700 }}>{t('data.yearLabel').replace('{{year}}', n(year))}</span>
                                <svg className="dropdown-chevron" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                            {yearDropdownOpen && (
                                <div className="dropdown-panel animate-slide-down" style={{ right: 0, left: 'auto', minWidth: 140 }}>
                                    {years.map(y => (
                                        <div
                                            key={y}
                                            className={`dropdown-item ${y === year ? 'selected' : ''}`}
                                            onClick={() => { setYear(y); setYearDropdownOpen(false); }}
                                        >
                                            {n(y)}
                                            {y === year && (
                                                <svg style={{ marginLeft: 'auto', width: 14, height: 14 }} viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Month Pills */}
                    <div className="month-pill-grid">
                        {MONTH_SHORT.map((m, i) => (
                            <button
                                key={m}
                                className={`month-pill ${month === i + 1 ? 'active' : ''}`}
                                onClick={() => setMonth(i + 1)}
                            >
                                {getShortMonthLabel(i + 1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Advanced Command Bar (Filter Bar) */}
                <div className="command-bar animate-slide-up">
                    <div className="command-bar-main">
                        {/* Primary Filter Group */}
                        <div className="type-filter-group" style={{ flex: 1, overflowX: 'auto' }}>
                            <button
                                className={`type-btn ${typeFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('all')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                                </svg>
                                <span>{t('data.allMetrics')}</span>
                                <span className="type-count">{n(gridData?.length || 0)}</span>
                            </button>
                            <button
                                className={`type-btn ${typeFilter === 'monthly' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('monthly')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <span>{t('data.monthly')}</span>
                                <span className="type-count">{n(counts.monthly)}</span>
                            </button>
                            <button
                                className={`type-btn ${typeFilter === 'annual' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('annual')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                <span>{t('data.annual')}</span>
                                <span className="type-count">{n(counts.annual)}</span>
                            </button>
                            <button
                                className={`type-btn ${typeFilter === 'events' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('events')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                                <span>{t('data.events')}</span>
                                <span className="type-count">{n(counts.events)}</span>
                            </button>
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
                                className={`status-chip metered ${statusFilter === 'metered' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('metered')}
                            >
                                <div className="dot blue" /> {t('data.metered')} <span className="s-count">{n(counts.metered)}</span>
                            </button>
                            <button
                                className={`status-chip complete ${statusFilter === 'complete' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('complete')}
                            >
                                <div className="dot green" /> {t('data.complete')} <span className="s-count">{n(counts.complete)}</span>
                            </button>
                            <button
                                className={`status-chip partial ${statusFilter === 'partial' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('partial')}
                            >
                                <div className="dot amber" /> {t('data.partial')} <span className="s-count">{n(counts.partial)}</span>
                            </button>
                            <button
                                className={`status-chip missing ${statusFilter === 'missing' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('missing')}
                            >
                                <div className="dot red" /> {t('data.missing')} <span className="s-count">{n(counts.missing)}</span>
                            </button>
                        </div>

                        {/* Search Bar Beside Status Tabs */}
                        <div className="integrated-search" style={{ width: '220px', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder={t('data.findMetric')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* December Notice */}
                {month !== 12 && (typeFilter === 'annual' || typeFilter === 'events') && (
                    <div style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: 20,
                        fontSize: 13,
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        {t('data.decemberNotice').replace('{{month}}', getMonthLabel(month))}
                    </div>
                )}

                {/* Progress Cards */}
                <div className="stat-card-grid stat-card-grid-2" style={{ marginBottom: 20 }}>
                    <div className="progress-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span className="progress-card-title">{t('data.progressTitle')}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 10px', borderRadius: 99 }}>
                                {getMonthLabel(month)} {n(year)}
                            </span>
                        </div>
                        <div className="progress-metric">
                            <div className="progress-metric-header">
                                <span className="progress-metric-label">{t('data.entriesLabel')}</span>
                                <span className="progress-metric-value" style={{ color: 'var(--accent-green)' }}>{n(dataProgress)}%</span>
                            </div>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill green" style={{ width: `${dataProgress}%` }} />
                            </div>
                        </div>
                        <div className="progress-metric">
                            <div className="progress-metric-header">
                                <span className="progress-metric-label">{t('data.uploadsLabel')}</span>
                                <span style={{ color: '#818cf8' }} className="progress-metric-value">{n(evidenceProgress)}%</span>
                            </div>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill blue" style={{ width: `${evidenceProgress}%` }} />
                            </div>
                        </div>
                        <div className="progress-metric-tasks">{n(withValue)} / {n(total)}</div>
                        <div className="progress-metric-tasks-label">{t('data.matchingFilters')}</div>
                    </div>

                    <div className="progress-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span className="progress-card-title">{t('data.frameworkDist')}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 10px', borderRadius: 99 }}>
                                {t('data.currentView')}
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                            {(['E', 'S', 'G'] as const).map(cat => {
                                const catRows = grouped[cat];
                                const filled = catRows.filter(r => {
                                    const v = localData[r.row_id]?.value;
                                    return v !== '' && v !== null && v !== undefined;
                                }).length;
                                const cfg = CATEGORY_CONFIG[cat];
                                return (
                                    <div key={cat} style={{
                                        background: 'var(--bg-elevated)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '12px',
                                        border: '1px solid var(--border-subtle)',
                                    }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                                            {t(cfg.labelKey as any)}
                                        </div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {n(filled)}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/{n(catRows.length)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div style={{
                                background: 'var(--bg-elevated)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px',
                                border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                                    {t('data.evidenceLabel')}
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {n(withEvidenceRows)}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/{n(total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Entry Groups */}
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                        <div className="spinner" />
                    </div>
                ) : !gridData?.length ? (
                    <div className="surface" style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        </svg>
                        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{searchQuery ? t('data.noMatchingMetrics') : t('data.noData')}</h3>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
                            {searchQuery ? t('data.adjustSearchQuery') : t('data.noDataDesc')}
                        </p>
                    </div>
                ) : (
                    (['E', 'S', 'G'] as const).map(cat => {
                        const rows = grouped[cat];
                        if (!rows.length) return null;
                        const cfg = CATEGORY_CONFIG[cat];
                        return (
                            <div key={cat} className="category-group">
                                <div className="category-group-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%', background: cfg.color
                                        }} />
                                        <span className="category-group-title" style={{ color: cfg.color }}>
                                            {t(cfg.labelKey as any)}
                                        </span>
                                    </div>
                                    <span className="category-group-count">{t('data.itemsCount').replace('{{count}}', n(rows.length))}</span>
                                </div>

                                {rows.map(row => {
                                    const local = localData[row.row_id] || { value: '', notes: '', evidence_files: '' };
                                    const statusClass = getStatusClass(String(local.value), local.evidence_files);

                                    return (
                                        <div key={row.row_id} className={`data-entry-card ${statusClass}`}>
                                            {/* Card Header */}
                                            <div className="data-entry-card-header">
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div className="data-entry-card-name">{translateMeterName(row.name, t)}</div>
                                                        {row.is_meter && (
                                                            <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 7px' }}>{t('data.meterBadge')}</span>
                                                        )}
                                                    </div>
                                                    <div className="data-entry-card-freq">
                                                        {row.unit ? t('data.unitLabel').replace('{{unit}}', translateUnitStr(row.unit, t)) : ''}
                                                    </div>
                                                </div>
                                                <div className="data-entry-card-actions">
                                                    <StatusBadge value={local.value} evidence={local.evidence_files} />
                                                </div>
                                            </div>

                                            {/* Two-col body: Data Entry + Evidence */}
                                            <div className="data-entry-card-body">
                                                {/* Data Entry */}
                                                <div>
                                                    <div className="data-entry-field-label">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                                        </svg>
                                                        {t('data.entryLabel')}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            className="data-entry-input"
                                                            placeholder="0.00"
                                                            value={local.value}
                                                            readOnly={!canUpdate}
                                                            onChange={e => canUpdate && handleValueChange(row.row_id, e.target.value)}
                                                            onBlur={() => canUpdate && bulkSaveMutation.mutate({ isAutoSave: true })}
                                                        />
                                                        {row.unit && (
                                                            <span style={{
                                                                fontSize: 12,
                                                                color: 'var(--text-muted)',
                                                                background: 'var(--bg-elevated)',
                                                                padding: '8px 10px',
                                                                borderRadius: 'var(--radius-sm)',
                                                                whiteSpace: 'nowrap',
                                                                border: '1px solid var(--border-subtle)',
                                                                fontWeight: 600,
                                                            }}>
                                                                {translateUnitStr(row.unit, t)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Evidence */}
                                                <div>
                                                    <div className="data-entry-field-label">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                                                        </svg>
                                                        {t('data.evidenceLabel')}
                                                    </div>

                                                    {local.evidence_files ? (
                                                        <div className="evidence-uploaded">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-complete)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                                                <polyline points="14 2 14 8 20 8" />
                                                            </svg>
                                                            <button
                                                                onClick={(e) => { e.preventDefault(); setViewingEvidence(`${BASE_URL}${local.evidence_files}`); }}
                                                                style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-complete)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                            >
                                                                {toEvidenceStr(local.evidence_files).split('/').pop()}
                                                            </button>
                                                            {canUpdate && (
                                                                <button
                                                                    className="btn-delete-file"
                                                                    onClick={() => handleDeleteFile(row.row_id)}
                                                                    title={t('data.deleteFile')}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <label style={{ cursor: canUpdate ? 'pointer' : 'default', display: 'block' }}>
                                                            <div className="evidence-zone" style={{ opacity: canUpdate ? 1 : 0.6 }}>
                                                                <div className="evidence-zone-icon">⬆</div>
                                                                <div className="evidence-zone-text">{canUpdate ? t('data.dropFile') : t('data.noFile')}</div>
                                                            </div>
                                                            {canUpdate && (
                                                                <input
                                                                    type="file"
                                                                    style={{ display: 'none' }}
                                                                    value=""
                                                                    onChange={e => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            let previewUrl = null;
                                                                            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                                                                                previewUrl = URL.createObjectURL(file);
                                                                            }
                                                                            setPendingUpload({ row_id: row.row_id, file, previewUrl });
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                        </label>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Assignment Footer */}
                                            <div style={{
                                                marginTop: 16,
                                                paddingTop: 12,
                                                borderTop: '1px solid var(--border-subtle)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: '50%',
                                                        background: row.assigned_user_name
                                                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                                            : 'var(--bg-card)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: row.assigned_user_name ? 'white' : 'var(--text-muted)',
                                                        border: '1px solid var(--border-subtle)',
                                                    }}>
                                                        {row.assigned_user_name ? row.assigned_user_name.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{t('data.assignedTo')}</div>
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: row.assigned_user_name ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                                                            {row.assigned_user_name || t('data.unassigned')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ height: 28, fontSize: 11 }}
                                                    disabled={!canUpdate}
                                                    onClick={() => {
                                                        if (!canUpdate) return;
                                                        setAssignmentModal({
                                                            isOpen: true,
                                                            checklistId: row.checklist_id,
                                                            assignedUserId: row.assigned_to ?? '',
                                                            rowName: row.name
                                                        });
                                                    }}
                                                >
                                                    {row.assigned_user_name ? t('data.reassign') : t('data.assign')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Toast */}
            {saveMessage && (
                <div className={`toast ${saveMessage.type === 'success' ? 'toast-success' : 'toast-error'}`}>
                    <span className={saveMessage.type === 'success' ? 'toast-icon-success' : 'toast-icon-error'}>
                        {saveMessage.type === 'success' ? '✓' : '⚠'}
                    </span>
                    {saveMessage.text}
                </div>
            )}

            {/* Assignment Modal */}
            {assignmentModal.isOpen && (
                <div className="modal-backdrop" onClick={() => setAssignmentModal({ ...assignmentModal, isOpen: false })}>
                    <div className="modal modal-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">
                                {modalMode === 'ASSIGN' ? t('data.assignTask') : t('data.inviteTeamMember')}
                            </span>
                            <button className="modal-close" onClick={() => setAssignmentModal({ ...assignmentModal, isOpen: false })}>✕</button>
                        </div>
                        {modalMode === 'ASSIGN' ? (
                            <>
                                <div className="modal-body">
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('data.taskLabel')}</div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{translateMeterName(assignmentModal.rowName, t)}</div>
                                    </div>
                                    
                                    {users.length <= 1 && (
                                        <div style={{
                                            background: 'rgba(56, 189, 248, 0.08)',
                                            border: '1px dashed rgba(56, 189, 248, 0.25)',
                                            padding: '14px',
                                            borderRadius: 'var(--radius-lg)',
                                            marginBottom: 16,
                                            fontSize: 12,
                                            color: '#60a5fa',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 8,
                                            alignItems: 'center',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', marginBottom: 4 }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                            </div>
                                                                           <div>
                                                <strong>{t('data.onlyMember')}</strong><br/>
                                                {t('data.inviteOthers')}
                                            </div>
                                        </div>
                                    )}

                                    <label className="form-label">{t('data.selectTeamMember')}</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxHeight: '350px', overflowY: 'auto', paddingRight: '4px', marginBottom: 8 }}>
                                        {/* Unassigned Option */}
                                        <div
                                            className={`selection-item ${assignmentModal.assignedUserId === '' ? 'selected' : ''}`}
                                            onClick={() => setAssignmentModal({ ...assignmentModal, assignedUserId: '' })}
                                            style={{
                                                padding: '12px 14px',
                                                borderRadius: 'var(--radius-lg)',
                                                border: `1px solid ${assignmentModal.assignedUserId === '' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                                background: assignmentModal.assignedUserId === '' ? 'var(--accent-green-dim)' : 'var(--bg-card)',
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
                                            <div style={{ flex: 1, fontWeight: 600, color: assignmentModal.assignedUserId === '' ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                                {t('data.unassigned')}
                                            </div>
                                            {assignmentModal.assignedUserId === '' && (
                                                <div style={{ color: 'var(--accent-green)' }}>✓</div>
                                            )}
                                        </div>

                                        {/* User Options */}
                                        {users.map(u => {
                                            const isSelected = u.id === assignmentModal.assignedUserId;
                                            return (
                                                <div
                                                    key={u.id}
                                                    className={`selection-item ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => setAssignmentModal({ ...assignmentModal, assignedUserId: u.id })}
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
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <span style={{ fontWeight: 600, color: isSelected ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                                                                {u.first_name} {u.last_name}
                                                            </span>
                                                            {u.profile?.role && (
                                                                <span style={{
                                                                    fontSize: 9,
                                                                    padding: '2px 6px',
                                                                    borderRadius: 4,
                                                                    fontWeight: 700,
                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                    color: 'var(--text-secondary)',
                                                                    border: '1px solid var(--border-subtle)',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.5px',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {t(`roles.${u.profile.role}` as any)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                                                    </div>
                                                    {isSelected && (
                                                        <div style={{ color: 'var(--accent-green)' }}>✓</div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Invite Link for authorized users */}
                                        {canPerformAction(user?.profile?.role, 'users', 'create') && (
                                            <div
                                                onClick={() => {
                                                    setModalMode('INVITE');
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                                    e.currentTarget.style.borderColor = 'var(--accent-green)';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                                                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                                }}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderRadius: 'var(--radius-lg)',
                                                    border: `1px dashed var(--border-subtle)`,
                                                    background: 'rgba(255, 255, 255, 0.01)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    color: 'var(--accent-green)',
                                                    fontWeight: 600,
                                                    fontSize: 13,
                                                }}
                                            >
                                                <span>+ {t('data.inviteTeamMember')}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, textAlign: 'center' }}>
                                        {t('data.memberResponsible')}
                                    </p>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-ghost" onClick={() => setAssignmentModal({ ...assignmentModal, isOpen: false })}>{t('confirm.cancel')}</button>
                                    <button
                                        className="btn btn-primary"
                                        disabled={assignMutation.isPending}
                                        onClick={() => {
                                            if (assignmentModal.checklistId) {
                                                assignMutation.mutate({
                                                    checklistId: assignmentModal.checklistId,
                                                    userId: assignmentModal.assignedUserId === '' ? null : Number(assignmentModal.assignedUserId)
                                                });
                                            }
                                        }}
                                    >
                                        {assignMutation.isPending ? t('data.saving') : t('data.confirmAssignment')}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <form onSubmit={e => {
                                e.preventDefault();
                                modalInviteMutation.mutate(inviteForm);
                            }}>
                                <div className="modal-body">
                                    {inviteError && (
                                        <div style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                            color: '#f87171',
                                            padding: '10px 12px',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 12,
                                            marginBottom: 14
                                        }}>
                                            ⚠ {inviteError}
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div>
                                            <label className="form-label" style={{ fontSize: 11 }}>{t('settings.firstName')}</label>
                                            <input
                                                required
                                                type="text"
                                                className="form-input"
                                                placeholder="John"
                                                value={inviteForm.first_name}
                                                onChange={e => setInviteForm(prev => ({ ...prev, first_name: e.target.value }))}
                                                style={{ height: 36, fontSize: 13 }}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label" style={{ fontSize: 11 }}>{t('settings.lastName')}</label>
                                            <input
                                                required
                                                type="text"
                                                className="form-input"
                                                placeholder="Doe"
                                                value={inviteForm.last_name}
                                                onChange={e => setInviteForm(prev => ({ ...prev, last_name: e.target.value }))}
                                                style={{ height: 36, fontSize: 13 }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: 12 }}>
                                        <label className="form-label" style={{ fontSize: 11 }}>{t('settings.email')}</label>
                                        <input
                                            required
                                            type="email"
                                            className="form-input"
                                            placeholder="john.doe@example.com"
                                            value={inviteForm.email}
                                            onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                                            style={{ height: 36, fontSize: 13 }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: 16 }}>
                                        <label className="form-label" style={{ fontSize: 11 }}>{t('users.role')}</label>
                                        <select
                                            required
                                            className="form-input"
                                            value={inviteForm.role}
                                            onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                                            style={{
                                                height: 36,
                                                fontSize: 13,
                                                background: 'var(--bg-elevated)',
                                                color: 'var(--text-primary)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: 'var(--radius-md)'
                                            }}
                                        >
                                            <option value="" disabled>{t('users.selectRole')}</option>
                                            {ROLE_HIERARCHY[user?.profile?.role || '']?.map(role => (
                                                <option key={role} value={role}>
                                                    {t(`roles.${role}` as any)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            setModalMode('ASSIGN');
                                            setInviteError(null);
                                        }}
                                    >
                                        {t('data.back')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={modalInviteMutation.isPending}
                                    >
                                        {modalInviteMutation.isPending ? t('data.inviting') : t('data.sendInvite')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
                )}
                {/* Upload Confirmation Modal */}
                {pendingUpload && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => {
                            if (pendingUpload.previewUrl) URL.revokeObjectURL(pendingUpload.previewUrl);
                            setPendingUpload(null);
                        }} />
                        <div style={{ position: 'relative', width: '100%', maxWidth: 500, background: '#13152a', borderRadius: 20, padding: 24, border: '1px solid rgba(255,255,255,0.1)' }} className="animate-slide-up">
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f0f2ff', marginBottom: 16 }}>{t('data.confirmUploadTitle')}</h3>
                            <p style={{ color: '#8b90b8', fontSize: 14, marginBottom: 20 }}>{t('data.confirmUploadMsg').replace('{{filename}}', pendingUpload.file.name)}</p>
                            
                            {pendingUpload.previewUrl ? (
                                <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    {pendingUpload.file.type === 'application/pdf' ? (
                                        <iframe src={pendingUpload.previewUrl} style={{ width: '100%', height: 300, border: 'none', background: '#fff' }} />
                                    ) : (
                                        <img src={pendingUpload.previewUrl} alt="Preview" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: 'rgba(0,0,0,0.2)' }} />
                                    )}
                                </div>
                            ) : (
                                <div style={{ marginBottom: 24, padding: 32, background: 'rgba(255,255,255,0.02)', borderRadius: 12, textAlign: 'center', color: '#8b90b8', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, opacity: 0.5 }}>
                                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <div style={{ fontSize: 14 }}>{t('data.noPreview')}</div>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#f0f2ff' }} onClick={() => {
                                    if (pendingUpload.previewUrl) URL.revokeObjectURL(pendingUpload.previewUrl);
                                    setPendingUpload(null);
                                }}>
                                    {t('confirm.cancel')}
                                </button>
                                <button className="btn btn-primary" onClick={() => {
                                    handleFileUpload(pendingUpload.row_id, pendingUpload.file);
                                    if (pendingUpload.previewUrl) URL.revokeObjectURL(pendingUpload.previewUrl);
                                    setPendingUpload(null);
                                }}>
                                    {t('data.uploadFile')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Evidence Viewer Modal */}
                {viewingEvidence && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} onClick={() => setViewingEvidence(null)} />
                        <div style={{ position: 'relative', width: '100%', maxWidth: 900, height: '85vh', background: '#13152a', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} className="animate-slide-up">
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f2ff', margin: 0 }}>{t('data.viewEvidence')}</h3>
                                    <span style={{ fontSize: 13, color: '#8b90b8', fontFamily: 'monospace' }}>{viewingEvidence.split('/').pop()}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <a href={viewingEvidence} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', color: '#f0f2ff', textDecoration: 'none' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                        {t('data.openNewTab')}
                                    </a>
                                    <button onClick={() => setViewingEvidence(null)} className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', color: '#f0f2ff', border: 'none', padding: '0 12px' }}>
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div style={{ flex: 1, background: '#0a0b14', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 24 }}>
                                {viewingEvidence.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) ? (
                                    <img src={viewingEvidence} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                ) : viewingEvidence.match(/\.(pdf)(\?.*)?$/i) ? (
                                    <iframe src={viewingEvidence} style={{ width: '100%', height: '100%', border: 'none', background: '#fff', borderRadius: 8 }} />
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#8b90b8' }}>
                                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16, opacity: 0.5, margin: '0 auto' }}>
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        <div style={{ fontSize: 16, marginBottom: 8, fontWeight: 500, color: '#f0f2ff' }}>{t('data.previewNotSupported')}</div>
                                        <div style={{ fontSize: 14 }}>{t('data.previewNotSupportedDesc')}</div>
                                        <a href={viewingEvidence} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 16, color: '#38bdf8', textDecoration: 'none', fontWeight: 600, background: 'rgba(56,189,248,0.1)', padding: '8px 16px', borderRadius: 8 }}>
                                            {t('data.downloadFile')}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
        </AppLayout>
    );
}
