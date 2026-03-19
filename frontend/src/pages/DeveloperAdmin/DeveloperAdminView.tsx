import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import ElementModal from './ElementModal';
import FrameworkModal from './FrameworkModal';
import ProfilingModal from './ProfilingModal';
import MeterTypeModal from './MeterTypeModal';
import ConfirmModal from '../../components/ui/ConfirmModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId =
    | 'diagnostics'
    | 'elements'
    | 'frameworks'
    | 'meter_types'
    | 'profiling'
    | 'companies'
    | 'users'
    | 'settings'
    | 'logs';

interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
}

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
    { id: 'diagnostics', label: '⬡ Health' },
    { id: 'settings', label: '⚑ Flags' },
    { id: 'logs', label: '⊟ Audit' },
    { id: 'elements', label: '◈ Elements' },
    { id: 'frameworks', label: '◫ Frameworks' },
    { id: 'meter_types', label: '◎ Meters' },
    { id: 'profiling', label: '◷ Profiling' },
    { id: 'companies', label: '⬡ Nodes' },
    { id: 'users', label: '◉ Identities' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string) => new Date(d).toLocaleDateString();
const fmtTime = (d: string) => new Date(d).toLocaleString();
const hexId = (id: number) => `#${id.toString(16).toUpperCase().padStart(4, '0')}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    sub,
    accent,
}: {
    label: string;
    value: React.ReactNode;
    sub?: string;
    accent?: string;
}) {
    return (
        <div
            className="stat-card"
            style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
        >
            <div className="stat-card-header">
                <span className="stat-card-label">{label}</span>
            </div>
            <div className="stat-card-value">{value}</div>
            {sub && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

function TableEmpty({ message = 'No records found.' }: { message?: string }) {
    return (
        <tr>
            <td
                colSpan={99}
                style={{
                    textAlign: 'center',
                    padding: '40px 0',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                }}
            >
                {message}
            </td>
        </tr>
    );
}

function LoadingRows() {
    return (
        <>
            {[...Array(5)].map((_, i) => (
                <tr key={i} style={{ opacity: 0.4 }}>
                    {[...Array(5)].map((_, j) => (
                        <td key={j}>
                            <div
                                style={{
                                    height: 12,
                                    background: 'var(--bg-hover)',
                                    borderRadius: 4,
                                    width: `${60 + Math.random() * 30}%`,
                                }}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({
    onLogin,
}: {
    onLogin: (secret: string) => Promise<void>;
}) {
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await onLogin(secret);
        } catch {
            setError('Invalid Developer Secret Key.');
            setSecret('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card" style={{ maxWidth: 400 }}>
                {/* Icon */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            margin: '0 auto 16px',
                            background: 'linear-gradient(135deg, #f43f5e, #be123c)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 24px rgba(225,29,72,0.35)',
                        }}
                    >
                        <span
                            style={{ fontSize: 14, fontWeight: 900, color: 'white', letterSpacing: 1 }}
                        >
                            DEV
                        </span>
                    </div>
                    <h1
                        style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            marginBottom: 6,
                        }}
                    >
                        Restricted Access
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Platform Developer Console — Authorised Personnel Only
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                    <input
                        type="password"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        placeholder="Enter Developer Secret"
                        className="form-input"
                        style={{
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            letterSpacing: '6px',
                            fontSize: 18,
                        }}
                        required
                        autoFocus
                    />

                    {error && (
                        <div
                            style={{
                                padding: '10px 14px',
                                background: 'rgba(239,68,68,0.1)',
                                color: '#f87171',
                                borderRadius: 8,
                                fontSize: 12,
                                textAlign: 'center',
                                fontWeight: 600,
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}
                        >
                            ✕ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !secret}
                        className="btn btn-primary"
                        style={{
                            height: 48,
                            background: 'linear-gradient(to right, #e11d48, #be123c)',
                            opacity: loading || !secret ? 0.6 : 1,
                        }}
                    >
                        {loading ? 'Verifying…' : 'Authenticate & Enter'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DeveloperAdminView() {
    const queryClient = useQueryClient();

    // Auth
    const [secret, setSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Navigation
    const [activeTab, setActiveTab] = useState<TabId>('diagnostics');

    // Modals
    const [elementModalOpen, setElementModalOpen] = useState(false);
    const [selectedElement, setSelectedElement] = useState<any>(null);
    const [frameworkModalOpen, setFrameworkModalOpen] = useState(false);
    const [selectedFramework, setSelectedFramework] = useState<any>(null);
    const [profilingModalOpen, setProfilingModalOpen] = useState(false);
    const [selectedProfiling, setSelectedProfiling] = useState<any>(null);
    const [meterTypeModalOpen, setMeterTypeModalOpen] = useState(false);
    const [selectedMeterType, setSelectedMeterType] = useState<any>(null);

    const [confirmState, setConfirmState] = useState<ConfirmState>({
        isOpen: false,
        title: '',
        message: '',
        type: 'danger',
        onConfirm: () => { },
    });

    const [seedModal, setSeedModal] = useState({ isOpen: false, name: '', email: '' });
    const [impersonateToken, setImpersonateToken] = useState<string | null>(null);

    // ── Request Config (memoised so React Query doesn't re-fetch on every render) ──
    const reqConfig = useMemo(
        () => ({ headers: { 'X-Developer-Secret': secret } }),
        [secret],
    );

    // ── Queries ──────────────────────────────────────────────────────────────────

    const enabled = isAuthenticated;

    const { data: diagnostics, isLoading: loadingDiag } = useQuery({
        queryKey: ['admin_diagnostics', secret],
        queryFn: async () => (await api.get('/developer-admin/diagnostics', reqConfig)).data,
        enabled,
    });

    const { data: settings, isLoading: loadingSettings } = useQuery({
        queryKey: ['admin_settings', secret],
        queryFn: async () => (await api.get('/developer-admin/settings', reqConfig)).data,
        enabled,
    });

    const { data: logsData, isLoading: loadingLogs } = useQuery({
        queryKey: ['admin_logs', secret],
        queryFn: async () => (await api.get('/developer-admin/logs', reqConfig)).data,
        enabled,
    });

    const { data: elements, isLoading: loadingElements } = useQuery({
        queryKey: ['admin_elements', secret],
        queryFn: async () => (await api.get('/developer-admin/data-elements', reqConfig)).data,
        enabled,
    });

    const { data: frameworks, isLoading: loadingFrameworks } = useQuery({
        queryKey: ['admin_frameworks', secret],
        queryFn: async () => (await api.get('/developer-admin/frameworks', reqConfig)).data,
        enabled,
    });

    const { data: meterTypes, isLoading: loadingMeterTypes } = useQuery({
        queryKey: ['admin_meter_types', secret],
        queryFn: async () => (await api.get('/developer-admin/meter-types', reqConfig)).data,
        enabled,
    });

    const { data: profiling, isLoading: loadingProfiling } = useQuery({
        queryKey: ['admin_profiling', secret],
        queryFn: async () =>
            (await api.get('/developer-admin/profiling-questions', reqConfig)).data,
        enabled,
    });

    const { data: companies, isLoading: loadingCompanies } = useQuery({
        queryKey: ['admin_companies', secret],
        queryFn: async () => (await api.get('/developer-admin/companies', reqConfig)).data,
        enabled,
    });

    const { data: users, isLoading: loadingUsers } = useQuery({
        queryKey: ['admin_users', secret],
        queryFn: async () => (await api.get('/developer-admin/users', reqConfig)).data,
        enabled,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────────

    // Map API path segments → query keys
    const resourceQueryKey: Record<string, string> = {
        'data-elements': 'admin_elements',
        frameworks: 'admin_frameworks',
        'meter-types': 'admin_meter_types',
        'profiling-questions': 'admin_profiling',
        companies: 'admin_companies',
        users: 'admin_users',
    };

    const deleteMutation = useMutation({
        mutationFn: async ({ resource, id }: { resource: string; id: number }) =>
            api.delete(`/developer-admin/${resource}/${id}`, reqConfig),
        onSuccess: (_, { resource }) => {
            const key = resourceQueryKey[resource];
            if (key) queryClient.invalidateQueries({ queryKey: [key] });
            queryClient.invalidateQueries({ queryKey: ['admin_diagnostics'] });
        },
    });

    const updateSettingMutation = useMutation({
        mutationFn: async ({ key, value }: { key: string; value: any }) =>
            api.put(`/developer-admin/settings/${key}`, { value }, reqConfig),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['admin_settings'] }),
    });

    const seedMutation = useMutation({
        mutationFn: async ({ name, email }: { name: string; email: string }) =>
            api.post(
                `/developer-admin/seed-demo?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`,
                {},
                reqConfig,
            ),
        onSuccess: () => {
            setSeedModal({ isOpen: false, name: '', email: '' });
            ['admin_companies', 'admin_users', 'admin_diagnostics'].forEach((k) =>
                queryClient.invalidateQueries({ queryKey: [k] }),
            );
        },
    });

    const seedSystemMutation = useMutation({
        mutationFn: async () =>
            api.post('/developer-admin/seed-system-defaults', {}, reqConfig),
        onSuccess: () => {
            ['admin_frameworks', 'admin_meter_types', 'admin_profiling', 'admin_diagnostics', 'admin_elements'].forEach((k) =>
                queryClient.invalidateQueries({ queryKey: [k] }),
            );
            alert('System defaults (Frameworks, Meters, Profiling, Elements) seeded successfully.');
        },
    });

    const impersonateMutation = useMutation({
        mutationFn: async (userId: number) => {
            const res = await api.post(
                `/developer-admin/impersonate/${userId}`,
                {},
                reqConfig,
            );
            return res.data;
        },
        onSuccess: (data) => setImpersonateToken(data.access_token),
    });

    // ── Helpers ───────────────────────────────────────────────────────────────────

    const handleLogin = async (inputSecret: string) => {
        await api.get('/developer-admin/diagnostics', {
            headers: { 'X-Developer-Secret': inputSecret },
        });
        setSecret(inputSecret);
        setIsAuthenticated(true);
    };

    /**
     * Opens a confirmation dialog before deleting a resource.
     * @param resource  The API path segment (e.g. "companies", "data-elements")
     * @param id        The resource ID
     * @param label     Human-readable name shown in the dialog
     */
    const handleDelete = (resource: string, id: number, label?: string) => {
        setConfirmState({
            isOpen: true,
            type: 'danger',
            title: `Delete ${label ?? 'Record'}`,
            message: `This action is permanent and cannot be undone. Are you sure you want to delete this record?`,
            onConfirm: () => {
                deleteMutation.mutate({ resource, id });
                setConfirmState((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };

    const switchTab = (tab: TabId) => setActiveTab(tab);

    // ── Guard ─────────────────────────────────────────────────────────────────────

    if (!isAuthenticated) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    // ── Render ────────────────────────────────────────────────────────────────────

    return (
        <AppLayout hideNav>
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 80px' }}>

                {/* ── Command Bar ─────────────────────────────────────────────────── */}
                <div
                    className="command-bar"
                    style={{ marginBottom: 24, position: 'sticky', top: 0, zIndex: 50 }}
                >
                    <div className="command-bar-main">
                        {/* Brand */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: 'linear-gradient(135deg, #f43f5e, #be123c)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 900,
                                    fontSize: 9,
                                    letterSpacing: 1,
                                    flexShrink: 0,
                                    boxShadow: '0 4px 14px rgba(225,29,72,0.3)',
                                }}
                            >
                                DEV
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>
                                    Terminal Console
                                </div>
                                <div
                                    style={{
                                        fontSize: 9,
                                        color: '#f43f5e',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        marginTop: 2,
                                    }}
                                >
                                    Global Admin
                                </div>
                            </div>
                        </div>

                        {/* Tab pills — scrollable on small screens */}
                        <div
                            className="type-filter-group"
                            style={{ overflowX: 'auto', flex: 1, padding: '0 8px' }}
                        >
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => switchTab(tab.id)}
                                    className={`type-btn ${activeTab === tab.id ? 'active' : ''}`}
                                    style={
                                        activeTab === tab.id
                                            ? { color: '#f43f5e', background: 'rgba(244,63,94,0.12)' }
                                            : undefined
                                    }
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <button
                                onClick={() => seedSystemMutation.mutate()}
                                disabled={seedSystemMutation.isPending}
                                className="btn btn-secondary btn-sm"
                                style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                            >
                                {seedSystemMutation.isPending ? 'Seeding System…' : 'Seed Defaults'}
                            </button>
                            <button
                                onClick={() => setSeedModal({ ...seedModal, isOpen: true })}
                                className="btn btn-secondary btn-sm"
                                style={{ borderColor: '#f43f5e', color: '#f43f5e' }}
                            >
                                + Seed Demo
                            </button>
                            <button
                                onClick={() => {
                                    setIsAuthenticated(false);
                                    setSecret('');
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                Lock
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Content ──────────────────────────────────────────────────────── */}
                <div className="animate-in fade-in duration-300">

                    {/* DIAGNOSTICS */}
                    {activeTab === 'diagnostics' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div className="stat-card-grid stat-card-grid-3">
                                <StatCard
                                    label="Nodes (L30D)"
                                    value={
                                        loadingDiag ? (
                                            '…'
                                        ) : (
                                            <>
                                                {diagnostics?.total_nodes}{' '}
                                                <span style={{ fontSize: 14, color: 'var(--accent-green)' }}>
                                                    +{diagnostics?.growth_30d}
                                                </span>
                                            </>
                                        )
                                    }
                                    sub="Corporate entities registered"
                                />
                                <StatCard
                                    label="Data Submissions"
                                    value={loadingDiag ? '…' : diagnostics?.total_data_points}
                                    sub="Total metrics recorded globally"
                                />
                                <StatCard
                                    label="Evidence Files"
                                    value={loadingDiag ? '…' : diagnostics?.evidence_doc_count}
                                    sub="Audit-ready documents"
                                />
                            </div>

                            <div className="stat-card-grid stat-card-grid-3">
                                <StatCard
                                    label="Identities"
                                    value={loadingDiag ? '…' : diagnostics?.total_identities}
                                    accent="#10b981"
                                />
                                <StatCard
                                    label="Metric Library"
                                    value={loadingDiag ? '…' : diagnostics?.total_metric_definitions}
                                    accent="#3b82f6"
                                />
                                <StatCard
                                    label="Platform Status"
                                    value={
                                        <span style={{ color: '#10b981' }}>
                                            {loadingDiag ? '…' : '● HEALTHY'}
                                        </span>
                                    }
                                    accent="#f43f5e"
                                />
                            </div>
                        </div>
                    )}

                    {/* SETTINGS */}
                    {activeTab === 'settings' && (
                        <div className="dark-table-wrap">
                            <div style={{ padding: '24px 24px 0' }}>
                                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                                    Platform Configuration
                                </h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    Manage feature flags and global system variables.
                                </p>
                            </div>

                            <div
                                style={{
                                    padding: 24,
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                    gap: 16,
                                }}
                            >
                                {[
                                    {
                                        key: 'maintenance_mode',
                                        label: 'Maintenance Mode',
                                        desc: 'Immediately disables the platform for all users.',
                                    },
                                    {
                                        key: 'disable_registration',
                                        label: 'Disable Signup',
                                        desc: 'Prevents new companies from registering.',
                                    },
                                    {
                                        key: 'show_banner',
                                        label: 'Global Alert Banner',
                                        desc: 'Shows a persistent message to all logged-in users.',
                                    },
                                ].map((flag) => {
                                    const val = settings?.find(
                                        (s: any) => s.key === flag.key,
                                    )?.value;
                                    const isActive = Boolean(val);
                                    return (
                                        <div
                                            key={flag.key}
                                            style={{
                                                padding: '16px 20px',
                                                borderRadius: 12,
                                                border: `1px solid ${isActive ? 'rgba(244,63,94,0.4)' : 'var(--border-subtle)'}`,
                                                background: isActive
                                                    ? 'rgba(244,63,94,0.05)'
                                                    : 'var(--bg-card)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 16,
                                            }}
                                        >
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        fontSize: 14,
                                                        color: isActive ? '#f43f5e' : 'var(--text-primary)',
                                                    }}
                                                >
                                                    {flag.label}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: 'var(--text-muted)',
                                                        marginTop: 3,
                                                    }}
                                                >
                                                    {flag.desc}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    updateSettingMutation.mutate({
                                                        key: flag.key,
                                                        value: !val,
                                                    })
                                                }
                                                disabled={loadingSettings || updateSettingMutation.isPending}
                                                className={`btn btn-sm ${isActive ? 'btn-danger' : 'btn-secondary'}`}
                                                style={{ flexShrink: 0 }}
                                            >
                                                {isActive ? 'Disable' : 'Enable'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* LOGS */}
                    {activeTab === 'logs' && (
                        <div className="dark-table-wrap">
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Audit Log</h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {logsData?.logs?.length ?? 0} events recorded
                                </p>
                            </div>
                            <table className="dark-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Action</th>
                                        <th>Subject</th>
                                        <th>Entity</th>
                                        <th>IP Origin</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingLogs ? (
                                        <LoadingRows />
                                    ) : !logsData?.logs?.length ? (
                                        <TableEmpty message="No log entries found." />
                                    ) : (
                                        logsData.logs.map((log: any) => (
                                            <tr key={log.id}>
                                                <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                    {fmtTime(log.created_at)}
                                                </td>
                                                <td>
                                                    <span className="badge badge-gray" style={{ fontSize: 10 }}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: 12, fontWeight: 600 }}>
                                                    {log.user_id ? `User #${log.user_id}` : 'SYSTEM'}
                                                </td>
                                                <td style={{ fontSize: 12 }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>
                                                        {log.entity_type}
                                                    </span>{' '}
                                                    {log.entity_id}
                                                </td>
                                                <td
                                                    style={{
                                                        fontSize: 11,
                                                        fontFamily: 'monospace',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    {log.ip_address ?? '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ELEMENTS */}
                    {activeTab === 'elements' && (
                        <div className="dark-table-wrap">
                            <div
                                style={{
                                    padding: '20px 24px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid var(--border-subtle)',
                                }}
                            >
                                <div>
                                    <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                                        Master Metric Library
                                    </h2>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                        {elements?.length ?? 0} elements defined
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedElement(null);
                                        setElementModalOpen(true);
                                    }}
                                    className="btn btn-primary btn-sm"
                                    style={{ background: 'linear-gradient(to right, #e11d48, #be123c)' }}
                                >
                                    + Add Element
                                </button>
                            </div>

                            <table className="dark-table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Mode</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingElements ? (
                                        <LoadingRows />
                                    ) : !elements?.length ? (
                                        <TableEmpty message="No elements defined yet." />
                                    ) : (
                                        elements.map((el: any) => (
                                            <tr key={el.id}>
                                                <td
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        color: '#f43f5e',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {el.element_code}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{el.name}</td>
                                                <td>
                                                    <span className="status-chip">{el.category}</span>
                                                </td>
                                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {el.is_metered ? 'Metered' : 'Manual'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'flex-end',
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() => {
                                                                setSelectedElement(el);
                                                                setElementModalOpen(true);
                                                            }}
                                                            className="btn-icon-sm"
                                                            title="Edit"
                                                        >
                                                            {/* Pencil icon */}
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleDelete('data-elements', el.id, el.name)
                                                            }
                                                            className="btn-icon-sm"
                                                            title="Delete"
                                                            style={{ color: '#f87171' }}
                                                        >
                                                            {/* Trash icon */}
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                <path d="M10 11v6M14 11v6" />
                                                                <path d="M9 6V4h6v2" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* FRAMEWORKS */}
                    {activeTab === 'frameworks' && (
                        <div className="dark-table-wrap">
                            <div
                                style={{
                                    padding: '20px 24px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid var(--border-subtle)',
                                }}
                            >
                                <div>
                                    <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                                        Compliance Frameworks
                                    </h2>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                        {frameworks?.length ?? 0} frameworks configured
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedFramework(null);
                                        setFrameworkModalOpen(true);
                                    }}
                                    className="btn btn-primary btn-sm"
                                    style={{ background: 'linear-gradient(to right, #e11d48, #be123c)' }}
                                >
                                    + Add Framework
                                </button>
                            </div>

                            <table className="dark-table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Version</th>
                                        <th>Region</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingFrameworks ? (
                                        <LoadingRows />
                                    ) : !frameworks?.length ? (
                                        <TableEmpty message="No frameworks defined yet." />
                                    ) : (
                                        frameworks.map((fw: any) => (
                                            <tr key={fw.id}>
                                                <td
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        color: '#f43f5e',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {fw.code}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{fw.name}</td>
                                                <td style={{ fontSize: 12 }}>{fw.version ?? '—'}</td>
                                                <td style={{ fontSize: 12 }}>{fw.region ?? '—'}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedFramework(fw);
                                                                setFrameworkModalOpen(true);
                                                            }}
                                                            className="btn-icon-sm"
                                                            title="Edit"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('frameworks', fw.id, fw.name)}
                                                            className="btn-icon-sm"
                                                            title="Delete"
                                                            style={{ color: '#f87171' }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                <path d="M10 11v6M14 11v6" />
                                                                <path d="M9 6V4h6v2" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* METER TYPES */}
                    {activeTab === 'meter_types' && (
                        <div className="dark-table-wrap">
                            <div
                                style={{
                                    padding: '20px 24px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid var(--border-subtle)',
                                }}
                            >
                                <div>
                                    <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                                        Meter Types
                                    </h2>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                        {meterTypes?.length ?? 0} meter types configured
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedMeterType(null);
                                        setMeterTypeModalOpen(true);
                                    }}
                                    className="btn btn-primary btn-sm"
                                    style={{ background: 'linear-gradient(to right, #e11d48, #be123c)' }}
                                >
                                    + Add Meter Type
                                </button>
                            </div>

                            <table className="dark-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Unit</th>
                                        <th>Category</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingMeterTypes ? (
                                        <LoadingRows />
                                    ) : !meterTypes?.length ? (
                                        <TableEmpty message="No meter types defined yet." />
                                    ) : (
                                        meterTypes.map((mt: any) => (
                                            <tr key={mt.id}>
                                                <td
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: 11,
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    {hexId(mt.id)}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{mt.name}</td>
                                                <td>
                                                    <span className="status-chip">{mt.unit}</span>
                                                </td>
                                                <td style={{ fontSize: 12 }}>{mt.category ?? '—'}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedMeterType(mt);
                                                                setMeterTypeModalOpen(true);
                                                            }}
                                                            className="btn-icon-sm"
                                                            title="Edit"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('meter-types', mt.id, mt.name)}
                                                            className="btn-icon-sm"
                                                            title="Delete"
                                                            style={{ color: '#f87171' }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                <path d="M10 11v6M14 11v6" />
                                                                <path d="M9 6V4h6v2" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* PROFILING */}
                    {activeTab === 'profiling' && (
                        <div className="dark-table-wrap">
                            <div
                                style={{
                                    padding: '20px 24px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid var(--border-subtle)',
                                }}
                            >
                                <div>
                                    <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                                        Profiling Questions
                                    </h2>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                        {profiling?.length ?? 0} questions configured
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedProfiling(null);
                                        setProfilingModalOpen(true);
                                    }}
                                    className="btn btn-primary btn-sm"
                                    style={{ background: 'linear-gradient(to right, #e11d48, #be123c)' }}
                                >
                                    + Add Question
                                </button>
                            </div>

                            <table className="dark-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Question</th>
                                        <th>Type</th>
                                        <th>Required</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingProfiling ? (
                                        <LoadingRows />
                                    ) : !profiling?.length ? (
                                        <TableEmpty message="No profiling questions defined yet." />
                                    ) : (
                                        profiling.map((q: any, i: number) => (
                                            <tr key={q.id}>
                                                <td
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: 11,
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    {i + 1}
                                                </td>
                                                <td style={{ fontWeight: 600, maxWidth: 380 }}>{q.question}</td>
                                                <td>
                                                    <span className="status-chip">{q.input_type}</span>
                                                </td>
                                                <td style={{ fontSize: 12 }}>
                                                    {q.is_required ? (
                                                        <span style={{ color: '#f43f5e', fontWeight: 700 }}>Yes</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>Optional</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProfiling(q);
                                                                setProfilingModalOpen(true);
                                                            }}
                                                            className="btn-icon-sm"
                                                            title="Edit"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleDelete('profiling-questions', q.id, 'Question')
                                                            }
                                                            className="btn-icon-sm"
                                                            title="Delete"
                                                            style={{ color: '#f87171' }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                <path d="M10 11v6M14 11v6" />
                                                                <path d="M9 6V4h6v2" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* COMPANIES */}
                    {activeTab === 'companies' && (
                        <div className="dark-table-wrap">
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                                    Company Nodes
                                </h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {companies?.length ?? 0} nodes registered
                                </p>
                            </div>
                            <table className="dark-table">
                                <thead>
                                    <tr>
                                        <th>HEX ID</th>
                                        <th>Company Name</th>
                                        <th>Sector</th>
                                        <th>Region</th>
                                        <th>Joined</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingCompanies ? (
                                        <LoadingRows />
                                    ) : !companies?.length ? (
                                        <TableEmpty message="No companies found." />
                                    ) : (
                                        companies.map((c: any) => (
                                            <tr key={c.id}>
                                                <td
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: 11,
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    {hexId(c.id)}
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{c.name}</td>
                                                <td style={{ fontSize: 12 }}>{c.sector ?? '—'}</td>
                                                <td style={{ fontSize: 12 }}>{c.emirate ?? '—'}</td>
                                                <td
                                                    style={{
                                                        fontSize: 11,
                                                        color: 'var(--text-muted)',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {fmt(c.created_at)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => handleDelete('companies', c.id, c.name)}
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ color: '#f87171' }}
                                                    >
                                                        Terminate
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* USERS */}
                    {activeTab === 'users' && (
                        <div className="dark-table-wrap">
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                                    User Identities
                                </h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {users?.length ?? 0} identities registered
                                </p>
                            </div>
                            <table className="dark-table">
                                <thead>
                                    <tr>
                                        <th>Identity</th>
                                        <th>Role</th>
                                        <th>Company</th>
                                        <th style={{ textAlign: 'right' }}>Developer Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingUsers ? (
                                        <LoadingRows />
                                    ) : !users?.length ? (
                                        <TableEmpty message="No users found." />
                                    ) : (
                                        users.map((u: any) => (
                                            <tr key={u.id}>
                                                <td>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{u.email}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {u.first_name} {u.last_name}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge badge-gray">{u.profile?.role ?? '—'}</span>
                                                </td>
                                                <td style={{ fontSize: 12 }}>
                                                    {u.profile?.company_id
                                                        ? `Node ${hexId(u.profile.company_id)}`
                                                        : 'Unassigned'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'flex-end',
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() => impersonateMutation.mutate(u.id)}
                                                            disabled={impersonateMutation.isPending}
                                                            className="btn btn-secondary btn-sm"
                                                        >
                                                            Impersonate
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('users', u.id, u.email)}
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ color: '#f87171' }}
                                                        >
                                                            Revoke
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Impersonation Token Toast ──────────────────────────────────────────── */}
            {impersonateToken && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 24,
                        right: 24,
                        background: 'var(--bg-card)',
                        padding: 18,
                        borderRadius: 14,
                        border: '1px solid rgba(244,63,94,0.5)',
                        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                        zIndex: 1000,
                        maxWidth: 320,
                        width: '100%',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                        }}
                    >
                        <span style={{ fontWeight: 800, color: '#f43f5e', fontSize: 13 }}>
                            ✓ Impersonation Token
                        </span>
                        <button
                            onClick={() => setImpersonateToken(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: 16,
                                lineHeight: 1,
                            }}
                        >
                            ✕
                        </button>
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            wordBreak: 'break-all',
                            background: '#000',
                            padding: '8px 10px',
                            borderRadius: 6,
                            fontFamily: 'monospace',
                            color: '#86efac',
                            lineHeight: 1.6,
                        }}
                    >
                        {impersonateToken}
                    </div>
                    <button
                        onClick={() => navigator.clipboard.writeText(impersonateToken)}
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 10, width: '100%' }}
                    >
                        Copy Token
                    </button>
                    <p style={{ fontSize: 10, marginTop: 8, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                        Paste this token in a private window to view the user's session.
                    </p>
                </div>
            )}

            {/* ── Seed Demo Modal ────────────────────────────────────────────────────── */}
            {seedModal.isOpen && (
                <div
                    className="modal-backdrop"
                    onClick={() => setSeedModal({ isOpen: false, name: '', email: '' })}
                >
                    <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Seed Demo Company</span>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label className="form-label">Company Name</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Grand Plaza Resort"
                                    value={seedModal.name}
                                    onChange={(e) =>
                                        setSeedModal({ ...seedModal, name: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="form-label">Admin Email</label>
                                <input
                                    className="form-input"
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={seedModal.email}
                                    onChange={(e) =>
                                        setSeedModal({ ...seedModal, email: e.target.value })
                                    }
                                />
                            </div>
                            <p
                                style={{
                                    fontSize: 11,
                                    color: 'var(--text-muted)',
                                    background: 'var(--bg-hover)',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    margin: 0,
                                }}
                            >
                                ⚠ This will create a new company and populate 6 months of synthetic
                                metric data across all active elements.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSeedModal({ isOpen: false, name: '', email: '' })}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                style={{ background: 'linear-gradient(to right, #e11d48, #be123c)' }}
                                disabled={
                                    !seedModal.name ||
                                    !seedModal.email ||
                                    seedMutation.isPending
                                }
                                onClick={() =>
                                    seedMutation.mutate({ name: seedModal.name, email: seedModal.email })
                                }
                            >
                                {seedMutation.isPending ? 'Seeding…' : 'Execute Seed'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modals ─────────────────────────────────────────────────────────────── */}
            <ElementModal
                isOpen={elementModalOpen}
                onClose={() => { setElementModalOpen(false); setSelectedElement(null); }}
                initialData={selectedElement}
                reqConfig={reqConfig}
            />

            <FrameworkModal
                isOpen={frameworkModalOpen}
                onClose={() => { setFrameworkModalOpen(false); setSelectedFramework(null); }}
                initialData={selectedFramework}
                reqConfig={reqConfig}
            />

            <ProfilingModal
                isOpen={profilingModalOpen}
                onClose={() => { setProfilingModalOpen(false); setSelectedProfiling(null); }}
                initialData={selectedProfiling}
                reqConfig={reqConfig}
            />

            <MeterTypeModal
                isOpen={meterTypeModalOpen}
                onClose={() => { setMeterTypeModalOpen(false); setSelectedMeterType(null); }}
                initialData={selectedMeterType}
                reqConfig={reqConfig}
            />

            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
                confirmLabel="Confirm Deletion"
                cancelLabel="Abort"
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
            />
        </AppLayout>
    );
}