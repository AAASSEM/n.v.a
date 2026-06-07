import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSiteStore } from '../../stores/siteStore';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell,
} from 'recharts';
import StatDetailModal from './components/StatDetailModal';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import { CompletenessTracker } from './components/CompletenessTracker';
import { ScoreRing } from './components/ScoreRing';
import { AnomalyAlerts } from './components/AnomalyAlerts';
import { PillarMetricsGrid } from './components/PillarMetricsGrid';

// ─── Types ───────────────────────────────────────────────────────────────────

type Pillar = 'E' | 'S' | 'G';

interface StatMetric {
    name: string;
    value: string;
    change: string;
    trend: 'up' | 'down' | 'neutral';
    pillar?: string;
    scope?: number;
    methodology?: string;
    breakdown?: any;
}

function deriveUnit(valueStr: string): string {
    const match = valueStr.replace(/,/g, '').match(/[\d.]+\s*(.+)/);
    return match ? match[1].trim() : '';
}

interface CompareRow {
    element_code: string;
    name: string;
    category: string;
    unit: string;
    value_a: number | null;
    value_b: number | null;
    delta: number | null;
    delta_pct: number | null;
    direction: 'up' | 'down' | 'neutral';
    is_improvement: boolean;
}

interface CompareData {
    month_a: { label: string; year: number; month: number };
    month_b: { label: string; year: number; month: number };
    rows: CompareRow[];
    summary: { total_elements_compared: number; improvements: number; regressions: number; no_change: number };
    ghg?: { month_a_tco2e: number; month_b_tco2e: number; delta_tco2e: number; delta_pct: number };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PILLAR_META = {
    E: { 
        label: 'Environmental', color: '#10b981', accent: 'rgba(16,185,129,0.12)', 
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 0 9.5a7 7 0 0 1-8 8.5z" /><path d="M19 2L11 10" /></svg> 
    },
    S: { 
        label: 'Social', color: '#6366f1', accent: 'rgba(99,102,241,0.12)', 
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> 
    },
    G: { 
        label: 'Governance', color: '#f59e0b', accent: 'rgba(245,158,11,0.12)', 
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> 
    },
};

// Which display category belongs to which pillar
const CATEGORY_PILLAR: Record<string, Pillar> = {
    'Energy': 'E', 'Water': 'E', 'Waste': 'E', 'Fuel': 'E',
    'Environment Other': 'E', 'Emissions': 'E',
    'Social': 'S',
    'Governance': 'G',
};

// Element metadata derived from seed — unit + display type
const ELEMENT_META: Record<string, { unit: string; type: 'numeric' | 'boolean' | 'percent' | 'text' }> = {
    'HOSP-E-001': { unit: 'kWh', type: 'numeric' },
    'HOSP-E-002': { unit: 'm³', type: 'numeric' },
    'HOSP-E-003': { unit: 'RT-h', type: 'numeric' },
    'HOSP-E-005': { unit: 'kg', type: 'numeric' },
    'HOSP-E-006': { unit: 'kg', type: 'numeric' },
    'HOSP-E-007': { unit: 'L', type: 'numeric' },
    'HOSP-E-008': { unit: 'L', type: 'numeric' },
    'HOSP-E-009': { unit: 'L', type: 'numeric' },
    'HOSP-E-010': { unit: 'kg', type: 'numeric' },
    'HOSP-E-019': { unit: '%', type: 'percent' },
    'HOSP-E-023': { unit: 'kWh', type: 'numeric' },
    'HOSP-E-042': { unit: 'L', type: 'numeric' },
    'HOSP-E-072': { unit: '%', type: 'percent' },
    'HOSP-E-073': { unit: 'kg', type: 'numeric' },
    'HOSP-S-024': { unit: 'people', type: 'numeric' },
    'HOSP-S-025': { unit: '%', type: 'percent' },
    'HOSP-S-026': { unit: 'hires', type: 'numeric' },
    'HOSP-S-027': { unit: '%', type: 'percent' },
    'HOSP-S-028': { unit: 'hrs/emp', type: 'numeric' },
    'HOSP-S-029': { unit: 'per M hrs', type: 'numeric' },
    'HOSP-S-030': { unit: 'count', type: 'numeric' },
    'HOSP-S-031': { unit: 'count', type: 'numeric' },
    'HOSP-S-032': { unit: 'count', type: 'numeric' },
    'HOSP-S-033': { unit: 'nationalities', type: 'numeric' },
    'HOSP-S-034': { unit: 'AED', type: 'numeric' },
    'HOSP-S-076': { unit: 'hours', type: 'numeric' },
    'HOSP-S-077': { unit: 'activities', type: 'numeric' },
    'HOSP-G-060': { unit: 'actions', type: 'numeric' },
    'HOSP-G-061': { unit: '%', type: 'percent' },
    'HOSP-G-065': { unit: 'checks/day', type: 'numeric' },
    'HOSP-G-071': { unit: 'categories', type: 'numeric' },
    'HOSP-G-078': { unit: '%', type: 'percent' },
};

const BOOLEAN_CODES = new Set([
    'HOSP-S-012', 'HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037',
    'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041', 'HOSP-E-043',
    'HOSP-S-044', 'HOSP-S-045', 'HOSP-S-046', 'HOSP-S-047', 'HOSP-E-048',
    'HOSP-E-049', 'HOSP-E-050', 'HOSP-E-051', 'HOSP-E-052', 'HOSP-E-053',
    'HOSP-E-054', 'HOSP-E-055', 'HOSP-E-056', 'HOSP-E-057', 'HOSP-S-058',
    'HOSP-G-059', 'HOSP-E-064', 'HOSP-G-070', 'HOSP-E-075', 'HOSP-G-079', 'HOSP-G-080',
]);

const STAT_CONFIG: Record<string, { color: string; icon: React.ReactNode; themeClass: string; order: number; dataKey: string }> = {
    'Energy': {
        color: '#fbbf24', themeClass: 'amber', order: 1, dataKey: 'Energy',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
    },
    'Water': {
        color: '#0ea5e9', themeClass: 'blue', order: 2, dataKey: 'Water',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5s-3 3.5-3 5.5a7 7 0 0 0 7 7z" /></svg>
    },
    'Emissions': {
        color: '#f43f5e', themeClass: 'red', order: 3, dataKey: 'Emissions',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 17H7" /><path d="M17 21H9" /></svg>
    },
    'Waste': {
        color: '#ef4444', themeClass: 'red', order: 4, dataKey: 'Waste',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
    },
    'Fuel': {
        color: '#be123c', themeClass: 'red', order: 5, dataKey: 'Fuel',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="15" y2="22" /><path d="M4 22V4c0-1.1.9-2 2-2h5c1.1 0 2 .9 2 2v18" /><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" /><line x1="7" y1="6" x2="10" y2="6" /><line x1="7" y1="10" x2="10" y2="10" /></svg>
    },
    'Environment Other': {
        color: '#10b981', themeClass: 'green', order: 6, dataKey: 'Environment Other',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 22v-5" /><path d="M10 17 8 15" /><path d="M10 14.5 12 11" /><path d="M14 22v-7" /><path d="M14 15 16 13" /><path d="M14 12 12 9" /><path d="M18 19c2.2 0 4-1.8 4-4 0-1.5-1-2.9-2.4-3.4C19.3 8.3 16.3 6 13 6c-1.3 0-2.5.4-3.5 1.1A4.95 4.95 0 0 0 4.5 10C2.5 10.5 1 12.3 1 14.5c0 2.5 2 4.5 4.5 4.5H18z" /></svg>
    },
    'Social': {
        color: '#6366f1', themeClass: 'blue', order: 7, dataKey: 'Social',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    },
    'Governance': {
        color: '#f59e0b', themeClass: 'amber', order: 8, dataKey: 'Governance',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
    },
    'default': {
        color: '#94a3b8', themeClass: 'gray', order: 99, dataKey: 'Other',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
    },
};

const CustomTooltipStyle = {
    contentStyle: { backgroundColor: '#1c1e30', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', color: '#f0f2ff', fontSize: 13 },
    itemStyle: { color: '#f0f2ff' },
    labelStyle: { color: '#8b90b8', fontWeight: 600 },
    cursor: { stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatConfig(name: string) {
    const n = name.toLowerCase();
    for (const key of Object.keys(STAT_CONFIG)) {
        if (key !== 'default' && n.includes(key.toLowerCase())) return STAT_CONFIG[key];
    }
    return STAT_CONFIG.default;
}

function getLast24Months(): { label: string; year: number; month: number }[] {
    const results = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        results.push({
            label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            year: d.getFullYear(),
            month: d.getMonth() + 1,
        });
    }
    return results;
}

function formatVal(value: number | null | undefined, unit: string): string {
    if (value === null || value === undefined) return '—';
    if (unit === 'boolean' || BOOLEAN_CODES.has(unit)) return value === 1 ? 'Yes' : 'No';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return value % 1 === 0 ? String(value) : value.toFixed(2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PillarTab({ pillar, active, onClick }: { pillar: Pillar; active: boolean; onClick: () => void }) {
    const meta = PILLAR_META[pillar];
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s ease',
                border: active ? `1.5px solid ${meta.color}` : '1.5px solid rgba(255,255,255,0.1)',
                background: active ? meta.accent : 'transparent',
                color: active ? meta.color : 'var(--text-secondary)',
                boxShadow: active ? `0 0 14px ${meta.color}30` : 'none',
            }}
        >
            {meta.icon && <span style={{ fontSize: 14 }}>{meta.icon}</span>}
            {meta.label}
        </button>
    );
}

// Individual element card for S and G pillars
function ElementCard({ row, name, code, value, unit, pillar }: { row: CompareRow | null; name: string; code: string; value: string | number | null; unit: string; pillar: Pillar }) {
    const meta = PILLAR_META[pillar] || PILLAR_META.E;
    const isBoolean = BOOLEAN_CODES.has(code) || unit === 'boolean';
    const boolVal = value === 1 || value === true || value === 'true' || value === '1';

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8,
            transition: 'border-color 0.2s',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {code}
                </span>
                {isBoolean && (
                    <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
                        background: boolVal ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                        color: boolVal ? '#10b981' : '#f43f5e',
                    }}>
                        {boolVal ? '✓ YES' : '✗ NO'}
                    </span>
                )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{name}</div>
            {!isBoolean && value !== null && value !== undefined && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: meta.color }}>
                        {formatVal(Number(value), unit)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unit}</span>
                </div>
            )}
            {value === null && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No data submitted</span>
            )}
        </div>
    );
}

// ─── Compare Panel ────────────────────────────────────────────────────────────

function ComparePanel({ pillar, onClose }: { pillar: Pillar; onClose: () => void }) {
    const currentSiteId = useSiteStore(s => s.currentSiteId);
    const months = useMemo(() => getLast24Months(), []);
    const [monthAIdx, setMonthAIdx] = useState(1); // default: last month
    const [monthBIdx, setMonthBIdx] = useState(0); // default: this month

    const monthA = months[monthAIdx];
    const monthB = months[monthBIdx];
    const sameMonth = monthA.year === monthB.year && monthA.month === monthB.month;

    const { data: compareData, isLoading } = useQuery<CompareData>({
        queryKey: ['dashboard', 'compare', currentSiteId, monthA, monthB, pillar],
        queryFn: async () => {
            const res = await api.get(
                `/dashboard/compare?month_a_year=${monthA.year}&month_a_month=${monthA.month}` +
                `&month_b_year=${monthB.year}&month_b_month=${monthB.month}&pillar=${pillar}`
            );
            return res.data;
        },
        enabled: !sameMonth,
    });

    const rows = compareData?.rows || [];
    const ghg = compareData?.ghg;
    const summary = compareData?.summary;

    // Delta bar chart data
    const barData = rows
        .filter(r => r.delta_pct !== null)
        .map(r => ({ name: r.name.length > 20 ? r.name.slice(0, 18) + '…' : r.name, pct: r.delta_pct, good: r.is_improvement }));

    return (
        <div style={{
            background: 'rgba(16,18,30,0.98)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: 28, marginBottom: 24, backdropFilter: 'blur(20px)',
        }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                    </svg>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Month Comparison</span>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {/* Month pickers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        Period A
                    </label>
                    <select
                        value={monthAIdx}
                        onChange={e => setMonthAIdx(Number(e.target.value))}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#f0f2ff', fontSize: 14, padding: '10px 14px', cursor: 'pointer' }}
                    >
                        {months.map((m, i) => <option key={i} value={i} style={{ background: '#1c1e30' }}>{m.label}</option>)}
                    </select>
                </div>
                <div style={{ paddingTop: 20, color: 'var(--text-muted)', fontWeight: 700, fontSize: 16 }}>vs</div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        Period B
                    </label>
                    <select
                        value={monthBIdx}
                        onChange={e => setMonthBIdx(Number(e.target.value))}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#f0f2ff', fontSize: 14, padding: '10px 14px', cursor: 'pointer' }}
                    >
                        {months.map((m, i) => <option key={i} value={i} style={{ background: '#1c1e30' }}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            {sameMonth && (
                <div style={{ textAlign: 'center', padding: 20, color: '#f87171', fontSize: 14, fontWeight: 600 }}>
                    ⚠ Select two different months to compare
                </div>
            )}

            {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14, gap: 10 }}>
                    <div className="spinner" style={{ width: 18, height: 18 }} /> Loading comparison...
                </div>
            )}

            {!isLoading && !sameMonth && rows.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
                    No data found for one or both selected months. Submit data in the Data Entry section first.
                </div>
            )}

            {!isLoading && rows.length > 0 && (
                <>
                    {/* Summary banner */}
                    {summary && (
                        <div style={{
                            display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap',
                            background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 18px',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {monthA.label} → {monthB.label}:
                            </span>
                            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>✅ {summary.improvements} improved</span>
                            <span style={{ fontSize: 13, color: '#f87171', fontWeight: 700 }}>⚠️ {summary.regressions} regressed</span>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>→ {summary.no_change} flat</span>
                            {ghg && (
                                <span style={{ fontSize: 13, color: ghg.delta_tco2e < 0 ? '#10b981' : '#f87171', fontWeight: 700, marginLeft: 'auto' }}>
                                    GHG: {ghg.month_a_tco2e.toFixed(1)} → {ghg.month_b_tco2e.toFixed(1)} tCO2e
                                    ({ghg.delta_pct > 0 ? '+' : ''}{ghg.delta_pct.toFixed(1)}%)
                                </span>
                            )}
                        </div>
                    )}

                    {/* Comparison table */}
                    <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    {['Metric', monthA.label, monthB.label, 'Change', ''].map((h, i) => (
                                        <th key={i} style={{
                                            textAlign: i === 0 ? 'left' : 'right', padding: '8px 12px',
                                            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                            whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const hasData = row.value_a !== null || row.value_b !== null;
                                    const showDelta = row.delta_pct !== null;
                                    const good = row.is_improvement;
                                    const deltaColor = row.direction === 'neutral' ? 'var(--text-muted)' : good ? '#10b981' : '#f87171';
                                    const arrow = row.direction === 'up' ? '▲' : row.direction === 'down' ? '▼' : '→';

                                    return (
                                        <tr key={row.element_code} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                <div>{row.name}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>{row.element_code} · {row.unit}</div>
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                {row.value_a !== null ? `${formatVal(row.value_a, row.unit)} ${row.unit}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                {row.value_b !== null ? `${formatVal(row.value_b, row.unit)} ${row.unit}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: deltaColor, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                {showDelta ? `${arrow} ${Math.abs(row.delta_pct!).toFixed(1)}%` : '—'}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                {showDelta ? (
                                                    <span style={{ fontSize: 16 }}>{good ? '✅' : '⚠️'}</span>
                                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Delta bar chart */}
                    {barData.length > 0 && (
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                % Change per Metric ({monthA.label} → {monthB.label})
                            </div>
                            <div style={{ height: Math.max(200, barData.length * 32) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 40, left: 20, bottom: 0 }} barSize={14}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 11 }} width={120} />
                                        <Tooltip
                                            {...CustomTooltipStyle}
                                            formatter={(val: number) => [`${val > 0 ? '+' : ''}${val.toFixed(1)}%`, 'Change']}
                                        />
                                        <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                                        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                                            {barData.map((entry, i) => (
                                                <Cell key={i} fill={entry.good ? '#10b981' : '#f43f5e'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
    const { user } = useAuthStore();
    const currentSiteId = useSiteStore(s => s.currentSiteId);
    const navigate = useNavigate();

    const [activePillar, setActivePillar] = useState<Pillar>('E');
    const [compareMode, setCompareMode] = useState(false);
    const [selectedStat, setSelectedStat] = useState<StatMetric | null>(null);

    const [frameworkFilter, setFrameworkFilter] = useState<string | null>(null);

    // ── Data fetch ──────────────────────────────────────────────────────────
    const { data: companyData } = useQuery({
        queryKey: ['company_me'],
        queryFn: async () => (await api.get('/companies/me')).data,
    });
    
    const activeFrameworks = useMemo(() => {
        let fws = ['ESG', 'DST', 'GREEN KEY'];
        if (companyData?.active_frameworks) {
            if (typeof companyData.active_frameworks === 'string') {
                try { fws = JSON.parse(companyData.active_frameworks); } catch(e) {}
            } else if (Array.isArray(companyData.active_frameworks) && companyData.active_frameworks.length > 0) {
                fws = companyData.active_frameworks;
            }
        }
        return fws;
    }, [companyData]);

    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['dashboard', 'metrics', currentSiteId, activePillar, frameworkFilter],
        queryFn: async () => {
            const fwParam = frameworkFilter ? `&framework=${frameworkFilter}` : '';
            return (await api.get(`/dashboard/metrics?pillar=${activePillar}${fwParam}`)).data;
        },
    });

    // ── Element-level data for S and G pillars ──────────────────────────────
    const { data: elementData } = useQuery({
        queryKey: ['dashboard', 'elements', currentSiteId, activePillar, frameworkFilter],
        queryFn: async () => {
            const fwParam = frameworkFilter ? `&framework=${frameworkFilter}` : '';
            return (await api.get(`/dashboard/elements?pillar=${activePillar}${fwParam}`)).data;
        },
        enabled: activePillar === 'S' || activePillar === 'G',
    });

    const { stats = [], chartData = [], categories = [] } = dashboardData || {};

    // ── Filter stat cards by pillar ─────────────────────────────────────────
    const filteredStats: StatMetric[] = useMemo(() => {
        const sorted = [...stats].sort((a: StatMetric, b: StatMetric) =>
            getStatConfig(a.name).order - getStatConfig(b.name).order
        );
        return sorted.filter((s: StatMetric) => {
            if (s.pillar) return s.pillar === activePillar;
            // fallback: infer from name
            const displayCat = Object.keys(CATEGORY_PILLAR).find(k =>
                s.name.toLowerCase().includes(k.toLowerCase())
            );
            return displayCat ? CATEGORY_PILLAR[displayCat] === activePillar : false;
        });
    }, [stats, activePillar]);

    // ── Filter chart series by pillar ───────────────────────────────────────
    const visibleCategories: string[] = useMemo(() => {
        return categories.filter((c: string) => CATEGORY_PILLAR[c] === activePillar);
    }, [categories, activePillar]);

    if (isLoading) {
        return (
            <AppLayout>
                <div className="page-header" style={{ marginBottom: 24 }}>
                    <div className="skeleton" style={{ width: 300, height: 40, borderRadius: 8, marginBottom: 8 }} />
                    <div className="skeleton" style={{ width: 500, height: 20, borderRadius: 8 }} />
                </div>
                <div className="skeleton" style={{ width: '100%', height: 100, borderRadius: 16, marginBottom: 24 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
                    <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
                    <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
                    <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
                </div>
            </AppLayout>
        );
    }

    // ── Element cards for S / G ─────────────────────────────────────────────
    const elementCards: { code: string; name: string; value: number | null; unit: string }[] =
        elementData?.elements || [];

    const pillarColor = PILLAR_META[activePillar].color;
    const pillarHasSeries = visibleCategories.length > 0;

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div style={{ flex: 1 }}>
                        <h1 className="page-title">ESG Overview</h1>
                        <p className="page-subtitle">
                            Welcome back, <strong style={{ color: 'var(--accent-green)' }}>{user?.first_name || user?.email}</strong> — here's your sustainability performance summary.
                        </p>
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.02)', padding: 6, borderRadius: 100, border: '1px solid rgba(255,255,255,0.05)' }}>
                            {(['E', 'S', 'G'] as Pillar[]).map(p => (
                                <PillarTab key={p} pillar={p} active={activePillar === p} onClick={() => { setActivePillar(p); setCompareMode(false); }} />
                            ))}
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        <ScoreRing />
                    </div>
                </div>

                {/* ── Framework Filter ───────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
                        <button
                            onClick={() => setFrameworkFilter(null)}
                            style={{
                                padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                                border: frameworkFilter === null ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                background: frameworkFilter === null ? 'rgba(16,185,129,0.1)' : 'transparent',
                                color: frameworkFilter === null ? '#10b981' : 'var(--text-secondary)',
                                boxShadow: frameworkFilter === null ? '0 0 10px rgba(16,185,129,0.2)' : 'none',
                            }}
                        >
                            All Frameworks
                        </button>
                        {activeFrameworks.map(fw => (
                            <button
                                key={fw}
                                onClick={() => setFrameworkFilter(fw)}
                                style={{
                                    padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                                    border: frameworkFilter === fw ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                                    background: frameworkFilter === fw ? 'rgba(99,102,241,0.1)' : 'transparent',
                                    color: frameworkFilter === fw ? '#818cf8' : 'var(--text-secondary)',
                                    boxShadow: frameworkFilter === fw ? '0 0 10px rgba(99,102,241,0.2)' : 'none',
                                }}
                            >
                                {fw === 'GREEN KEY' ? 'Green Key' : fw}
                            </button>
                        ))}
                    </div>

                <AnomalyAlerts />

                {/* ── Compare toggle ────────────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                    <button
                        onClick={() => setCompareMode(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s ease',
                            border: compareMode ? '1.5px solid #6366f1' : '1.5px solid rgba(255,255,255,0.1)',
                            background: compareMode ? 'rgba(99,102,241,0.15)' : 'transparent',
                            color: compareMode ? '#818cf8' : 'var(--text-secondary)',
                            boxShadow: compareMode ? '0 0 14px rgba(99,102,241,0.3)' : 'none',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                        </svg>
                        {compareMode ? 'Hide Comparison' : 'Compare Months'}
                    </button>
                </div>
                
                <CompletenessTracker framework={frameworkFilter} />

                {/* ── Compare Panel ─────────────────────────────────────────── */}
                {compareMode && <ComparePanel pillar={activePillar} onClose={() => setCompareMode(false)} />}

                {/* ── Stat Cards (E) ──────────────────────────────────── */}
                {activePillar === 'E' && filteredStats.length > 0 && (
                    <div
                        className="stat-card-grid"
                        style={{ gridTemplateColumns: `repeat(${Math.min(filteredStats.length, 4)}, 1fr)`, marginBottom: 24 }}
                    >
                        {filteredStats.map((stat: StatMetric) => {
                            const config = getStatConfig(stat.name);
                            return (
                                <div
                                    key={stat.name}
                                    className={`stat-card ${config.themeClass} interactive animate-fade-in`}
                                    onClick={() => setSelectedStat(stat)}
                                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                >
                                    <div className="stat-card-header">
                                        <span className="stat-card-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {stat.name}
                                            {stat.methodology && (
                                                <span style={{ color: '#38bdf8', fontSize: 14, display: 'inline-flex' }} title="Click to view Carbon Calculation Methodology">
                                                    ⓘ
                                                </span>
                                            )}
                                        </span>
                                        <div className="stat-card-icon" style={{ background: config.color + '20', color: config.color }}>{config.icon}</div>
                                    </div>
                                    <div className="stat-card-value" style={{ color: config.color }}>{stat.value}</div>
                                    <div className="stat-card-meta">
                                        <span style={{
                                            color: stat.trend === 'up' ? '#f87171' : stat.trend === 'down' ? 'var(--accent-green)' : 'var(--text-muted)',
                                            fontWeight: 700,
                                        }}>
                                            {stat.trend === 'up' ? '▲' : stat.trend === 'down' ? '▼' : '→'} {stat.change}
                                        </span>
                                    </div>
                                    <div className="stat-card-action-hint">Click for details →</div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Social / Governance Element Cards ─────────────────────── */}
                {(activePillar === 'S' || activePillar === 'G') && elementCards.length > 0 && (
                    <PillarMetricsGrid pillar={activePillar as 'S' | 'G'} elements={elementCards} />
                )}

                {/* ── Charts Section (E) ──────────────────────────────── */}
                {activePillar === 'E' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                        {/* Area chart */}
                        <div className="surface" style={{ padding: 24 }}>
                            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Sustainability Dynamics</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        {activePillar === 'E' ? 'Environmental performance over time' : 'Cross-category performance comparison'}
                                    </p>
                                </div>
                                <div className="badge badge-gray">Last 7 Months</div>
                            </div>
                            {pillarHasSeries ? (
                                <div style={{ height: 350 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                {visibleCategories.map((cat: string) => {
                                                    const cfg = getStatConfig(cat);
                                                    const id = `grad${cat.replace(/\s+/g, '')}`;
                                                    return (
                                                        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={cfg.color} stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                                                        </linearGradient>
                                                    );
                                                })}
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={12} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} />
                                            <Tooltip {...CustomTooltipStyle} />
                                            {visibleCategories.map((cat: string) => (
                                                <Area key={cat} type="monotone" dataKey={cat}
                                                    stroke={getStatConfig(cat).color} strokeWidth={3}
                                                    fillOpacity={1} fill={`url(#grad${cat.replace(/\s+/g, '')})`}
                                                    activeDot={{ r: 6, strokeWidth: 0 }} />
                                            ))}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 10 }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                                        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
                                    </svg>
                                    No time-series data for this pillar
                                </div>
                            )}
                        </div>

                        {/* Emissions bar chart */}
                        <div className="surface" style={{ padding: 24 }}>
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Emissions Analysis</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Total CO₂e (Metric Tonnes) — GHG Protocol</p>
                            </div>
                            <div style={{ height: 320 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={16}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={12} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} />
                                        <Tooltip {...CustomTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <Bar dataKey="Scope 1" fill="#f87171" radius={[4, 4, 0, 0]} stackId="ghg" animationDuration={1500} />
                                        <Bar dataKey="Scope 2" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="ghg" animationDuration={1800} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Help banner ───────────────────────────────────────────── */}
                <div className="surface" style={{
                    marginTop: 24, padding: 32,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(16,24,47,1) 100%)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderRadius: 24,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f0f2ff' }}>Expert Guidance at Your Fingertips</h3>
                            <p style={{ fontSize: 14.5, color: '#9ca3af', marginTop: 6, maxWidth: 600, lineHeight: 1.5 }}>
                                Need help interpreting your ESG data? Our Help Center provides step-by-step guides and direct access to sustainability consultants.
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => navigate('/help')} style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'white', color: 'white' }}>
                        Explore Help Center
                    </button>
                </div>

                {/* ── Detail Modal ──────────────────────────────────────────── */}
                {selectedStat && (
                    <StatDetailModal
                        stat={selectedStat}
                        chartData={chartData}
                        color={getStatConfig(selectedStat.name).color}
                        dataKey={getStatConfig(selectedStat.name).dataKey}
                        unit={deriveUnit(selectedStat.value)}
                        onClose={() => setSelectedStat(null)}
                    />
                )}
            </div>
        </AppLayout>
    );
}