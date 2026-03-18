import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import AppLayout from '../../components/layout/AppLayout';
import AccessDenied from '../../components/ui/AccessDenied';
import { canPerformAction } from '../../config/rbac';

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
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_CONFIG = {
    E: { label: 'Environmental', color: 'var(--color-env)', bg: 'var(--color-env-bg)' },
    S: { label: 'Social', color: 'var(--color-soc)', bg: 'var(--color-soc-bg)' },
    G: { label: 'Governance', color: 'var(--color-gov)', bg: 'var(--color-gov-bg)' },
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
    const status = getStatusClass(String(value), evidence);
    if (status === 'status-complete') {
        return <span className="badge badge-green">Complete</span>;
    }
    if (status === 'status-partial') {
        return <span className="badge badge-amber">Partial</span>;
    }
    return <span className="badge badge-red">Missing</span>;
}

export default function DataEntryView() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
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

    const { data: gridData, isLoading, error } = useQuery<GridRow[]>({
        queryKey: ['submissions', year, month],
        queryFn: async () => {
            const res = await api.get(`/submissions/grid/${year}/${month}`);
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

            const res = await api.post('/submissions/bulk', { year, month, entries });
            return { data: res.data, isAutoSave };
        },
        onSuccess: (result: any) => {
            if (result?.data && !result?.isAutoSave) {
                setSaveMessage({ type: 'success', text: `Saved! Created ${result.data.created}, updated ${result.data.updated} records.` });
                setTimeout(() => setSaveMessage(null), 4000);
            }
            queryClient.invalidateQueries({ queryKey: ['submissions', year, month] });
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
            const res = await api.post('/submissions/evidence', formData, {
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
        return <AccessDenied showLayout title="Data Entry Restricted" message="Your role does not have permission to access the data entry grid for this company." />;
    }

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Data Entry Interface</h1>
                        <p className="page-subtitle">Enter monthly metric readings and upload supporting evidence.</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        disabled={bulkSaveMutation.isPending || !gridData?.length || !canUpdate}
                        onClick={() => bulkSaveMutation.mutate({ isAutoSave: false })}
                    >
                        {bulkSaveMutation.isPending ? (
                            <>
                                <div className="spinner spinner-sm" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Save All
                            </>
                        )}
                    </button>
                </div>

                {/* Reporting Period */}
                <div className="reporting-period-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div className="reporting-period-title">Reporting Period</div>

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
                                <span style={{ fontWeight: 700 }}>Year: {year}</span>
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
                                            {y}
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
                                {m}
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
                                <span>All Metric</span>
                                <span className="type-count">{gridData?.length || 0}</span>
                            </button>
                            <button
                                className={`type-btn ${typeFilter === 'monthly' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('monthly')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <span>Monthly</span>
                                <span className="type-count">{counts.monthly}</span>
                            </button>
                            <button
                                className={`type-btn ${typeFilter === 'annual' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('annual')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                <span>Annual</span>
                                <span className="type-count">{counts.annual}</span>
                            </button>
                            <button
                                className={`type-btn ${typeFilter === 'events' ? 'active' : ''}`}
                                onClick={() => setTypeFilter('events')}
                                style={{ minWidth: '130px', justifyContent: 'center' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                                <span>Events</span>
                                <span className="type-count">{counts.events}</span>
                            </button>
                        </div>
                    </div>

                    <div className="command-bar-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="status-chip-group">
                            <button
                                className={`status-chip ${statusFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('all')}
                            >
                                All Status
                            </button>
                            <button
                                className={`status-chip metered ${statusFilter === 'metered' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('metered')}
                            >
                                <div className="dot blue" /> Metered <span className="s-count">{counts.metered}</span>
                            </button>
                            <button
                                className={`status-chip complete ${statusFilter === 'complete' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('complete')}
                            >
                                <div className="dot green" /> Complete <span className="s-count">{counts.complete}</span>
                            </button>
                            <button
                                className={`status-chip partial ${statusFilter === 'partial' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('partial')}
                            >
                                <div className="dot amber" /> Partial <span className="s-count">{counts.partial}</span>
                            </button>
                            <button
                                className={`status-chip missing ${statusFilter === 'missing' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('missing')}
                            >
                                <div className="dot red" /> Missing <span className="s-count">{counts.missing}</span>
                            </button>
                        </div>

                        {/* Search Bar Beside Status Tabs */}
                        <div className="integrated-search" style={{ width: '220px', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Find metric..."
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
                        Note: Annual metrics and Special Events are typically reported in December. You are currently viewing {MONTHS[month - 1]}.
                    </div>
                )}

                {/* Progress Cards */}
                <div className="stat-card-grid stat-card-grid-2" style={{ marginBottom: 20 }}>
                    <div className="progress-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span className="progress-card-title">Data Entry Progress</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 10px', borderRadius: 99 }}>
                                {MONTHS[month - 1]} {year}
                            </span>
                        </div>
                        <div className="progress-metric">
                            <div className="progress-metric-header">
                                <span className="progress-metric-label">Data Entries</span>
                                <span className="progress-metric-value" style={{ color: 'var(--accent-green)' }}>{dataProgress}%</span>
                            </div>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill green" style={{ width: `${dataProgress}%` }} />
                            </div>
                        </div>
                        <div className="progress-metric">
                            <div className="progress-metric-header">
                                <span className="progress-metric-label">Evidence Uploads</span>
                                <span className="progress-metric-value" style={{ color: '#818cf8' }}>{evidenceProgress}%</span>
                            </div>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill blue" style={{ width: `${evidenceProgress}%` }} />
                            </div>
                        </div>
                        <div className="progress-metric-tasks">{withValue} / {total}</div>
                        <div className="progress-metric-tasks-label">Metrics matching current filters</div>
                    </div>

                    <div className="progress-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span className="progress-card-title">Framework Distribution</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 10px', borderRadius: 99 }}>
                                Current View
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
                                            {cfg.label}
                                        </div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {filled}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/{catRows.length}</span>
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
                                    Evidence
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {withEvidenceRows}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/{total}</span>
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
                    <div className="surface" style={{ padding: 60, textAlign: 'center' }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No Data Elements</div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                            Complete your company setup and checklist to activate data entry.
                        </div>
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
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <span className="category-group-count">{rows.length} items</span>
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
                                                        <div className="data-entry-card-name">{row.name}</div>
                                                        {row.is_meter && (
                                                            <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 7px' }}>Meter</span>
                                                        )}
                                                    </div>
                                                    <div className="data-entry-card-freq">
                                                        {row.unit ? `Unit: ${row.unit}` : ''}
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
                                                        Data Entry
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
                                                                {row.unit}
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
                                                        Evidence
                                                    </div>

                                                    {local.evidence_files ? (
                                                        <div className="evidence-uploaded">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-complete)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                                                <polyline points="14 2 14 8 20 8" />
                                                            </svg>
                                                            <a
                                                                href={`http://localhost:8000${local.evidence_files}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-complete)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                            >
                                                                {toEvidenceStr(local.evidence_files).split('/').pop()}
                                                            </a>
                                                            {canUpdate && (
                                                                <button
                                                                    className="btn-delete-file"
                                                                    onClick={() => handleDeleteFile(row.row_id)}
                                                                    title="Delete file"
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
                                                                <div className="evidence-zone-text">{canUpdate ? 'Drop file or click' : 'No file uploaded'}</div>
                                                            </div>
                                                            {canUpdate && (
                                                                <input
                                                                    type="file"
                                                                    style={{ display: 'none' }}
                                                                    onChange={e => {
                                                                        if (e.target.files?.[0]) handleFileUpload(row.row_id, e.target.files[0]);
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
                                                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Assigned To</div>
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: row.assigned_user_name ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                                                            {row.assigned_user_name || 'Unassigned'}
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
                                                    {row.assigned_user_name ? 'Reassign' : 'Assign'}
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
                            <span className="modal-title">Assign Task</span>
                            <button className="modal-close" onClick={() => setAssignmentModal({ ...assignmentModal, isOpen: false })}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>TASK</div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{assignmentModal.rowName}</div>
                            </div>
                            <label className="form-label">Select Team Member</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
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
                                        Unassigned
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
                            <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, textAlign: 'center' }}>
                                The selected member will be responsible for data entry and evidence for this element.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setAssignmentModal({ ...assignmentModal, isOpen: false })}>Cancel</button>
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
                                {assignMutation.isPending ? 'Saving...' : 'Confirm Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
