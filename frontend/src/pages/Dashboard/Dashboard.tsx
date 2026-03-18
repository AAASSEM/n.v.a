import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';

interface StatMetric {
    name: string;
    value: string;
    trend: 'up' | 'down' | 'neutral';
    change: string;
}

const CustomTooltipStyle = {
    contentStyle: {
        backgroundColor: '#1c1e30',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        color: '#f0f2ff',
        fontSize: 13,
    },
    itemStyle: { color: '#f0f2ff' },
    labelStyle: { color: '#8b90b8', fontWeight: 600 },
    cursor: { stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 },
};

const STAT_CONFIG: Record<string, { color: string, icon: React.ReactNode, themeClass: string, order: number, dataKey: string }> = {
    'Energy': { 
        color: '#fbbf24', 
        themeClass: 'amber',
        order: 1,
        dataKey: 'Energy',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg> 
    },
    'Water': { 
        color: '#0ea5e9', 
        themeClass: 'blue',
        order: 2,
        dataKey: 'Water',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5s-3 3.5-3 5.5a7 7 0 0 0 7 7z" /></svg> 
    },
    'Emissions': { 
        color: '#f43f5e', 
        themeClass: 'red',
        order: 3,
        dataKey: 'Emissions',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 17H7" /><path d="M17 21H9" /></svg>
    },
    'Waste': { 
        color: '#ef4444', 
        themeClass: 'red',
        order: 4,
        dataKey: 'Waste',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    },
    'Fuel': { 
        color: '#be123c', 
        themeClass: 'red',
        order: 5,
        dataKey: 'Fuel',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><path d="M4 22V4c0-1.1.9-2 2-2h5c1.1 0 2 .9 2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/><line x1="7" y1="6" x2="10" y2="6"/><line x1="7" y1="10" x2="10" y2="10"/></svg>
    },
    'Environment Other': { 
        color: '#10b981', 
        themeClass: 'green',
        order: 6,
        dataKey: 'Environment Other',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 22v-5"/><path d="M10 17 8 15"/><path d="M10 14.5 12 11"/><path d="M14 22v-7"/><path d="M14 15 16 13"/><path d="M14 12 12 9"/><path d="M18 19c2.2 0 4-1.8 4-4 0-1.5-1-2.9-2.4-3.4C19.3 8.3 16.3 6 13 6c-1.3 0-2.5.4-3.5 1.1A4.95 4.95 0 0 0 4.5 10C2.5 10.5 1 12.3 1 14.5c0 2.5 2 4.5 4.5 4.5H18z"/></svg>
    },
    'Social': { 
        color: '#6366f1', 
        themeClass: 'blue',
        order: 7,
        dataKey: 'Social',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> 
    },
    'Governance': { 
        color: '#facc15', 
        themeClass: 'amber',
        order: 8,
        dataKey: 'Governance',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> 
    },
    'Score': { 
        color: '#2dd4bf', 
        themeClass: 'cyan',
        order: 9,
        dataKey: 'Score',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> 
    },
    'default': { 
        color: '#94a3b8', 
        themeClass: 'gray',
        order: 99,
        dataKey: 'Other',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> 
    }
};

function getStatConfig(name: string) {
    const n = name.toLowerCase();
    for (const key of Object.keys(STAT_CONFIG)) {
        if (n.includes(key.toLowerCase())) return STAT_CONFIG[key];
    }
    return STAT_CONFIG.default;
}

export default function Dashboard() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [selectedStat, setSelectedStat] = useState<StatMetric | null>(null);

    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['dashboard', 'metrics'],
        queryFn: async () => {
            const res = await api.get('/dashboard/metrics');
            return res.data;
        }
    });

    if (isLoading) {
        return (
            <AppLayout>
                <div className="loading-screen" style={{ minHeight: 'calc(100vh - 60px)' }}>
                    <div className="spinner" />
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading dashboard...</span>
                </div>
            </AppLayout>
        );
    }

    const { stats = [], chartData = [], categories = [] } = dashboardData || {};

    // Stable sort for cards
    const sortedStats = [...stats].sort((a: StatMetric, b: StatMetric) => {
        const orderA = getStatConfig(a.name).order;
        const orderB = getStatConfig(b.name).order;
        return orderA - orderB;
    });

    return (
        <AppLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">ESG Overview</h1>
                        <p className="page-subtitle">
                            Welcome back, <strong style={{ color: 'var(--accent-green)' }}>{user?.first_name || user?.email}</strong> — here's your sustainability performance summary.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                         <button 
                            className="btn btn-secondary"
                            onClick={() => navigate('/checklist')}
                        >
                            Data Collection
                        </button>
                        <button 
                            className="btn btn-primary"
                            onClick={() => navigate('/reports')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            Analytics Reports
                        </button>
                    </div>
                </div>

                {/* Stat Cards */}
                {sortedStats.length > 0 && (
                    <div
                        className="stat-card-grid"
                        style={{
                            gridTemplateColumns: `repeat(${Math.min(sortedStats.length, 4)}, 1fr)`,
                            marginBottom: 24
                        }}
                    >
                        {sortedStats.map((stat: StatMetric) => {
                            const config = getStatConfig(stat.name);
                            return (
                                <div 
                                    key={stat.name} 
                                    className={`stat-card ${config.themeClass} interactive animate-fade-in`}
                                    onClick={() => setSelectedStat(stat)}
                                    style={{ 
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div className="stat-card-header">
                                        <span className="stat-card-label">{stat.name}</span>
                                        <div className="stat-card-icon" style={{ background: config.color + '20', color: config.color }}>
                                            {config.icon}
                                        </div>
                                    </div>
                                    <div className="stat-card-value" style={{ color: config.color }}>{stat.value}</div>
                                    <div className="stat-card-meta">
                                        <span style={{
                                            color: stat.trend === 'up' ? (stat.name.toLowerCase().includes('score') ? 'var(--accent-green)' : '#f87171') : stat.trend === 'down' ? (stat.name.toLowerCase().includes('score') ? '#f87171' : 'var(--accent-green)') : 'var(--text-muted)',
                                            fontWeight: 700,
                                        }}>
                                            {stat.trend === 'up' ? '▲' : stat.trend === 'down' ? '▼' : '→'} {stat.change}
                                        </span>
                                        <span>vs last period</span>
                                    </div>
                                    <div className="stat-card-action-hint">Click for details →</div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Charts Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                    {/* Multi-series Area Chart */}
                    <div className="surface" style={{ padding: 24 }}>
                        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                                    Sustainability Dynamics
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                    Cross-category performance comparison
                                </p>
                            </div>
                            <div className="badge badge-gray">Last 7 Months</div>
                        </div>
                        <div style={{ height: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        {categories.map((cat: string) => {
                                            const config = getStatConfig(cat);
                                            return (
                                                <linearGradient key={`grad${cat}`} id={`grad${cat}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={config.color} stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                                                </linearGradient>
                                            );
                                        })}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={12} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} />
                                    <Tooltip {...CustomTooltipStyle} />
                                    <Legend 
                                        iconType="circle" 
                                        wrapperStyle={{ paddingTop: 24, color: '#8b90b8', fontSize: 12, fontWeight: 600 }} 
                                        formatter={(value) => <span style={{ color: '#f0f2ff' }}>{value}</span>}
                                    />
                                    {categories.map((cat: string) => (
                                        <Area
                                            key={cat}
                                            type="monotone"
                                            dataKey={cat}
                                            stroke={getStatConfig(cat).color}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill={`url(#grad${cat})`}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Secondary Bar Chart */}
                    <div className="surface" style={{ padding: 24 }}>
                        <div style={{ marginBottom: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                                Emissions Analysis
                            </h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                Total CO2-e (Metric Tons)
                            </p>
                        </div>
                        <div style={{ height: 320 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={16}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={12} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} />
                                    <Tooltip {...CustomTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                    <Bar 
                                        dataKey="Emissions" 
                                        fill={getStatConfig('Emissions').color} 
                                        radius={[6, 6, 0, 0]} 
                                        animationDuration={1500}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Help Section */}
                <div className="surface" style={{ 
                    marginTop: 24, 
                    padding: 32, 
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(16,24,47,1) 100%)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 24,
                    borderRadius: 24
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div style={{ 
                            width: 60, height: 60, borderRadius: 16, 
                            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f0f2ff' }}>Expert Guidance at Your Fingertips</h3>
                            <p style={{ fontSize: 14.5, color: '#9ca3af', marginTop: 6, maxWidth: 600, lineHeight: 1.5 }}>
                                Need help drafting disclosures or interpreting your data? Our Help Center provides step-by-step guides and direct access to sustainability consultants.
                            </p>
                        </div>
                    </div>
                    <button 
                        className="btn btn-secondary"
                        onClick={() => navigate('/help')}
                        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'white', color: 'white' }}
                    >
                        Explore Help Center
                    </button>
                </div>

                {/* Detail Modal */}
                {selectedStat && (
                    <div className="modal-backdrop" onClick={() => setSelectedStat(null)} style={{ backdropFilter: 'blur(8px)' }}>
                        <div 
                            className="modal modal-lg animate-scale-in" 
                            onClick={e => e.stopPropagation()}
                            style={{ maxWidth: 960, borderRadius: 28, overflow: 'hidden' }}
                        >
                            <div className="modal-header" style={{ padding: '32px 32px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ 
                                        width: 52, height: 52, borderRadius: 14, 
                                        background: getStatConfig(selectedStat.name).color + '20',
                                        color: getStatConfig(selectedStat.name).color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {getStatConfig(selectedStat.name).icon}
                                    </div>
                                    <div>
                                        <h3 className="modal-title" style={{ fontSize: 22, fontWeight: 900 }}>{selectedStat.name} Intelligence</h3>
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Deep dive into organizational sustainability metrics</p>
                                    </div>
                                </div>
                                <button className="modal-close" onClick={() => setSelectedStat(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ padding: '0 32px 32px' }}>
                                <div className="stat-card-grid stat-card-grid-3" style={{ marginBottom: 32, padding: 0, background: 'none', border: 'none' }}>
                                    <div className="stat-card glass" style={{ padding: '24px' }}>
                                        <span className="stat-card-label" style={{ fontSize: 12 }}>Current Period</span>
                                        <div className="stat-card-value" style={{ fontSize: 32, margin: '8px 0', color: getStatConfig(selectedStat.name).color }}>{selectedStat.value}</div>
                                        <div className="stat-card-meta">
                                            <span style={{ color: selectedStat.trend === 'down' ? 'var(--accent-green)' : '#f87171', fontWeight: 700 }}>
                                                {selectedStat.trend === 'up' ? '▲' : '▼'} {selectedStat.change}
                                            </span>
                                            <span>since last month</span>
                                        </div>
                                    </div>
                                    <div className="stat-card glass" style={{ padding: '24px' }}>
                                        <span className="stat-card-label" style={{ fontSize: 12 }}>Historical High</span>
                                        <div className="stat-card-value" style={{ fontSize: 32, margin: '8px 0' }}>{Math.round(parseFloat(selectedStat.value.replace(/[^0-9.]/g, '') || '0') * 1.15)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Recorded Q3 2025</div>
                                    </div>
                                    <div className="stat-card glass" style={{ padding: '24px' }}>
                                        <span className="stat-card-label" style={{ fontSize: 12 }}>Reduction Target</span>
                                        <div className="stat-card-value" style={{ fontSize: 32, margin: '8px 0' }}>{Math.round(parseFloat(selectedStat.value.replace(/[^0-9.]/g, '') || '0') * 0.9)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>10% Efficiency Target met</div>
                                    </div>
                                </div>

                                <div style={{ 
                                    height: 400, 
                                    background: 'rgba(255,255,255,0.02)', 
                                    borderRadius: 24, 
                                    padding: '32px 24px 12px', 
                                    border: '1px solid var(--border-subtle)',
                                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ marginBottom: 24, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>
                                        Month-over-Month {selectedStat.name} Velocity
                                    </div>
                                    <ResponsiveContainer width="100%" height="85%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={getStatConfig(selectedStat.name).color} stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor={getStatConfig(selectedStat.name).color} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} />
                                            <Tooltip {...CustomTooltipStyle} />
                                            <Area 
                                                type="monotone" 
                                                dataKey={getStatConfig(selectedStat.name).dataKey} 
                                                stroke={getStatConfig(selectedStat.name).color} 
                                                strokeWidth={4} 
                                                fillOpacity={1} 
                                                fill="url(#detailGrad)" 
                                                animationDuration={1500}
                                                activeDot={{ r: 8, strokeWidth: 0 }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px 32px' }}>
                                <button className="btn btn-ghost" onClick={() => setSelectedStat(null)}>Close Insight</button>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ 
                                        background: getStatConfig(selectedStat.name).color,
                                        boxShadow: `0 8px 16px ${getStatConfig(selectedStat.name).color}40`
                                    }}
                                >
                                    Export Analysis
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
