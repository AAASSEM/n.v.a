import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { useSiteStore } from '../../../stores/siteStore';

interface StatDetailModalProps {
    stat: {
        name: string;
        value: string;
        trend: 'up' | 'down' | 'neutral';
        change: string;
        pillar?: string;
        scope?: number;
        methodology?: string;
        breakdown?: Array<{
            label: string;
            scope: number;
            tco2e: number;
            ef_used: number;
            unit: string;
        }>;
        contributing_elements?: Array<{
            code: string;
            name: string;
            value: number;
            unit: string;
        }>;
        emirate?: string;
        grid_ef?: number;
        grid_ef_source?: string;
    };
    chartData: Array<{
        name: string;
        [key: string]: number | string;
    }>;
    color: string;
    dataKey: string;
    unit: string;
    onClose: () => void;
}


function ElementBreakdownPanel({ 
    elements, 
    color, 
    primaryUnit 
}: { 
    elements: Array<{code: string; name: string; value: number; unit: string}>;
    color: string;
    primaryUnit: string;
}) {
    if (!elements || elements.length === 0) return null;

    const isPrimaryUnit = (u: string) => {
        const ul = (u || '').toLowerCase().trim();
        if (ul === 'boolean' || ul === 'count' || ul === 'l/min' || ul === 'text') return false;
        if (ul === '%' && !primaryUnit.includes('%')) return false;
        return true;
    };

    const primaryElements = elements.filter(e => isPrimaryUnit(e.unit));
    const secondaryElements = elements.filter(e => !isPrimaryUnit(e.unit));

    const totalPrimary = primaryElements.reduce((sum, e) => sum + e.value, 0);

    return (
        <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff', marginBottom: 16 }}>Element Breakdown</h4>
            
            {primaryElements.length > 0 && (
                <div style={{ marginBottom: secondaryElements.length > 0 ? 24 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b90b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                        Primary Contributors ({primaryUnit})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {primaryElements.map((item, i) => {
                            const pct = totalPrimary > 0 ? (item.value / totalPrimary) * 100 : 0;
                            const opacities = [1, 0.8, 0.6, 0.4, 0.3, 0.2];
                            
                            return (
                                <div key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 160, fontSize: 13, color: '#f0f2ff' }}>
                                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ fontSize: 10, color: '#8b90b8', fontFamily: 'monospace' }}>{item.code}</div>
                                    </div>
                                    <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{ 
                                            height: '100%', 
                                            background: color, 
                                            opacity: opacities[i % opacities.length],
                                            width: `${pct}%`,
                                            transition: 'width 0.8s ease'
                                        }} />
                                    </div>
                                    <div style={{ width: 50, fontSize: 13, fontWeight: 600, color: '#f0f2ff', textAlign: 'right' }}>
                                        {Math.round(pct)}%
                                    </div>
                                    <div style={{ width: 100, fontSize: 13, fontWeight: 600, color: '#8b90b8', textAlign: 'right' }}>
                                        {item.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ 
                        marginTop: 16, paddingTop: 16, 
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#f0f2ff' }}>Total Included</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: color }}>
                            {totalPrimary.toLocaleString(undefined, { maximumFractionDigits: 1 })} {primaryUnit}
                        </span>
                    </div>
                </div>
            )}

            {secondaryElements.length > 0 && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b90b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                        Supplementary Metrics (Excluded from total)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {secondaryElements.map(item => (
                            <div key={item.code} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px' }}>
                                <div style={{ fontSize: 10, color: '#8b90b8', fontFamily: 'monospace', marginBottom: 2 }}>{item.code}</div>
                                <div style={{ fontSize: 13, color: '#f0f2ff', fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                                <div style={{ fontSize: 15, color: color, fontWeight: 800 }}>
                                    {item.unit.toLowerCase() === 'boolean' 
                                        ? (item.value > 0 ? 'Yes' : 'No') 
                                        : `${item.value.toLocaleString()} ${item.unit}`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StatDetailModal({ stat, chartData, color, dataKey, unit, onClose }: StatDetailModalProps) {

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    const isEnv = !stat.pillar || stat.pillar === 'E';

    // ── Dynamic Subtitle ───────────────────────────────────────────────────────
    let subtitle = "Deep dive into sustainability metrics";
    const nameLower = stat.name.toLowerCase();
    if (nameLower.includes("fuel")) {
        subtitle = "Generator, vehicle & equipment consumption breakdown";
    } else if (nameLower.includes("energy") || nameLower.includes("electricity")) {
        subtitle = "Grid consumption, renewables & efficiency analysis";
    } else if (nameLower.includes("water")) {
        subtitle = "Consumption tracking & intensity benchmarking";
    } else if (nameLower.includes("waste")) {
        subtitle = "Disposal, recycling & diversion rate analysis";
    } else if (nameLower.includes("emission") || nameLower.includes("ghg") || nameLower.includes("scope")) {
        if (nameLower.includes("scope 1")) {
            subtitle = "GHG Protocol Scope 1 — direct emissions";
        } else if (nameLower.includes("scope 2")) {
            subtitle = "GHG Protocol Scope 2 — location-based method";
        } else {
            subtitle = "GHG Protocol Scope 1 & 2 — location-based method";
        }
    }

    // ── Icons ──────────────────────────────────────────────────────────────────
    let Icon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    );

    if (nameLower.includes("energy")) {
        Icon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
        );
    } else if (nameLower.includes("water")) {
        Icon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
        );
    } else if (nameLower.includes("waste")) {
        Icon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
        );
    } else if (nameLower.includes("fuel")) {
        Icon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 22v-8c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v8M16 8h.01M12 22h6a2 2 0 0 0 2-2v-4.5a2.5 2.5 0 0 0-5 0v1" />
                <path d="M3 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
                <path d="M7 2h.01" />
            </svg>
        );
    } else if (nameLower.includes("recycling")) {
        Icon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
        );
    } else if (nameLower.includes("emission") || nameLower.includes("ghg")) {
        Icon = () => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2-1.2-3.7-2.9-4.3-.2-2.3-2.1-4.2-4.6-4.2-1.7 0-3.1.9-3.9 2.2C9.8 7.3 8.5 6.5 7 6.5c-2.4 0-4.3 1.9-4.5 4.2C1.2 11.3 0 13 0 15c0 2.5 2 4.5 4.5 4.5h13z" />
            </svg>
        );
    }

    // ── KPIs Computations ──────────────────────────────────────────────────────
    const vals = chartData.map(d => (typeof d[dataKey] === 'number' ? d[dataKey] as number : 0));
    const nonZeroVals = vals.filter(v => v > 0);
    
    // Average
    const avg = nonZeroVals.length > 0 ? nonZeroVals.reduce((a, b) => a + b, 0) / nonZeroVals.length : 0;
    
    // Peak / Low
    let peak = { month: '', value: -Infinity };
    let low = { month: '', value: Infinity };
    
    chartData.forEach((d) => {
        const v = typeof d[dataKey] === 'number' ? d[dataKey] as number : 0;
        if (v > 0) {
            if (v > peak.value) { peak = { month: d.name, value: v }; }
            if (v < low.value) { low = { month: d.name, value: v }; }
        }
    });

    if (peak.value === -Infinity) peak.value = 0;
    if (low.value === Infinity) low.value = 0;

    // Last Month
    let currentVal = 0;
    let prevVal = 0;
    let hasPrev = false;
    
    if (chartData.length >= 2) {
        currentVal = typeof chartData[chartData.length - 1][dataKey] === 'number' ? chartData[chartData.length - 1][dataKey] as number : 0;
        prevVal = typeof chartData[chartData.length - 2][dataKey] === 'number' ? chartData[chartData.length - 2][dataKey] as number : 0;
        if (prevVal > 0) hasPrev = true;
    }

    const absDelta = currentVal - prevVal;
    const sign = absDelta > 0 ? '+' : '';
    const deltaStr = `${sign}${absDelta.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
    
    let deltaColor = '#8b90b8';
    if (hasPrev) {
        if (absDelta > 0) deltaColor = isEnv ? '#f87171' : '#10b981'; // higher is bad for env
        else if (absDelta < 0) deltaColor = isEnv ? '#10b981' : '#f87171'; // lower is good for env
    }

    let badgeColor = '#8b90b8';
    let badgeBg = 'rgba(255,255,255,0.1)';
    if (stat.trend === 'up') {
        badgeColor = isEnv ? '#f87171' : '#10b981';
        badgeBg = isEnv ? 'rgba(248,113,113,0.12)' : 'rgba(16,185,129,0.12)';
    } else if (stat.trend === 'down') {
        badgeColor = isEnv ? '#10b981' : '#f87171';
        badgeBg = isEnv ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)';
    }

    const arrow = stat.trend === 'up' ? '↗' : stat.trend === 'down' ? '↘' : '→';

    // Trend Warning Badge
    let trendBadge = null;
    if (vals.length >= 6) {
        const last6 = vals.slice(-6);
        // Compare last 3 with previous 3
        const sumLast3 = last6.slice(3, 6).reduce((a,b)=>a+b,0);
        const sumPrev3 = last6.slice(0, 3).reduce((a,b)=>a+b,0);
        if (sumLast3 > sumPrev3 * 1.1) {
            trendBadge = isEnv ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                    <span>⚠</span> Consistent upward trend detected — review consumption drivers
                </div>
            ) : null;
        } else if (sumLast3 < sumPrev3 * 0.9) {
            trendBadge = isEnv ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                    <span>✓</span> Downward trend — consumption improving
                </div>
            ) : null;
        }
    }

    // Chart Custom Dots
    const renderCustomDot = (props: any) => {
        const { cx, cy, payload, value } = props;
        if (!cx || !cy) return null;

        if (payload.name === peak.month && value === peak.value) {
            return <circle cx={cx} cy={cy} r={6} fill="#13152a" stroke={isEnv ? "#f87171" : "#10b981"} strokeWidth={3} />;
        }
        if (payload.name === low.month && value === low.value) {
            return <circle cx={cx} cy={cy} r={6} fill="#13152a" stroke={isEnv ? "#10b981" : "#f87171"} strokeWidth={3} />;
        }
        return null;
    };

    const CustomTooltipBox = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: '#1c1e30', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    <div style={{ color: '#f0f2ff', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: color, fontSize: 13, fontWeight: 600 }}>
                        {payload[0].value?.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
                    </div>
                </div>
            );
        }
        return null;
    };

    // ── Conditional Breakdowns ─────────────────────────────────────────────────

    const renderFuelBreakdown = () => {
        if (dataKey !== 'Fuel') return null;
        const fuelKeys = ['Diesel Generators', 'Diesel Vehicles', 'Petrol Vehicles', 'LPG'];
        
        // Sum across all chartData or just latest? The prompt doesn't specify, let's use the last month or a sum.
        // Let's use the last month's data.
        const lastMonth = chartData[chartData.length - 1] || {};
        
        let totalFuel = 0;
        const sources: { name: string, value: number }[] = [];
        fuelKeys.forEach(k => {
            const v = (typeof lastMonth[k] === 'number') ? lastMonth[k] as number : 0;
            if (v > 0) {
                totalFuel += v;
                sources.push({ name: k, value: v });
            }
        });

        if (sources.length === 0) return null;

        return (
            <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff', marginBottom: 16 }}>Fuel Source Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sources.map((s, i) => {
                        const pct = totalFuel > 0 ? (s.value / totalFuel) * 100 : 0;
                        const opacities = [1, 0.7, 0.4, 0.2];
                        const barColor = color; // We can use variant opacities of the color
                        
                        return (
                            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ width: 140, fontSize: 13, color: '#f0f2ff' }}>{s.name}</div>
                                <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        background: barColor, 
                                        opacity: opacities[i % opacities.length],
                                        width: mounted ? `${pct}%` : '0%',
                                        transition: 'width 0.8s ease'
                                    }} />
                                </div>
                                <div style={{ width: 40, fontSize: 13, fontWeight: 600, color: '#f0f2ff', textAlign: 'right' }}>{Math.round(pct)}%</div>
                                <div style={{ width: 70, fontSize: 13, color: '#8b90b8', textAlign: 'right' }}>{s.value.toLocaleString()} {unit}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderGHGBreakdown = () => {
        if (!stat.breakdown || stat.breakdown.length === 0) return null;

        const scope1 = stat.breakdown.filter(b => b.scope === 1);
        const scope2 = stat.breakdown.filter(b => b.scope === 2);
        
        const totalEmissions = stat.breakdown.reduce((sum, b) => sum + b.tco2e, 0);

        const renderScopeGroup = (title: string, items: typeof stat.breakdown, barColor: string) => {
            if (items.length === 0) return null;
            return (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b90b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {items.map(item => {
                            const pct = totalEmissions > 0 ? (item.tco2e / totalEmissions) * 100 : 0;
                            return (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 140, fontSize: 13, color: '#f0f2ff' }}>{item.label}</div>
                                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{ 
                                            height: '100%', 
                                            background: barColor, 
                                            width: mounted ? `${pct}%` : '0%',
                                            transition: 'width 0.8s ease'
                                        }} />
                                    </div>
                                    <div style={{ width: 80, fontSize: 13, fontWeight: 600, color: '#f0f2ff', textAlign: 'right' }}>{item.tco2e.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        };

        return (
            <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff', marginBottom: 16 }}>GHG Emissions Source Breakdown</h4>
                
                {renderScopeGroup('Scope 1 (Direct)', scope1, '#f87171')}
                {renderScopeGroup('Scope 2 (Indirect)', scope2, '#fb923c')}
                
                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '16px 0' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 800 }}>
                    <div style={{ fontSize: 14, color: '#f0f2ff' }}>Total GHG Emissions</div>
                    <div style={{ fontSize: 15, color: '#f0f2ff' }}>{totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</div>
                </div>

                {stat.methodology && (
                    <div style={{ marginTop: 20, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                            </svg>
                            <h5 style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', margin: 0 }}>Carbon Calculation Methodology</h5>
                        </div>
                        <div style={{ fontSize: 12, color: '#bae6fd', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {stat.methodology}
                            <div style={{ marginTop: 8 }}>
                                <a href="https://ghgprotocol.org/corporate-standard" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Read the GHG Protocol Corporate Standard</a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const { currentSiteId, sites } = useSiteStore();
    const currentSite = sites.find(s => s.id === currentSiteId);
    const isAbuDhabi = currentSite?.name.toLowerCase().includes('abu dhabi');
    const rooms = currentSiteId ? (isAbuDhabi ? 240 : 300) : 540;

    const renderWaterBenchmark = () => {
        if (dataKey !== 'Water') return null;
        
        // Let's assume currentVal is m3 based on the app logic, so * 1000
        const isM3 = unit.includes('m³');
        const intensityL = isM3 ? (currentVal * 1000) / (rooms * 30) : currentVal / (rooms * 30);
        
        let statusPct = 90;
        if (intensityL < 200) { statusPct = 20; }
        else if (intensityL <= 350) { statusPct = 50; }

        return (
            <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff' }}>Dubai Hospitality Benchmark</h4>
                    <div style={{ cursor: 'help', fontSize: 12, color: '#8b90b8' }} title={`Room count used: ${rooms} (${currentSiteId ? currentSite?.name : 'All Sites'}). Connect your occupancy data for accurate intensity.`}>
                        ⓘ
                    </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 16px', fontSize: 13, marginBottom: 16 }}>
                    <div style={{ color: '#8b90b8' }}>Your intensity:</div>
                    <div style={{ color: '#f0f2ff', fontWeight: 600 }}>{intensityL.toFixed(1)} L/room/day</div>
                    
                    <div style={{ color: '#8b90b8' }}>Industry average:</div>
                    <div style={{ color: '#f0f2ff', fontWeight: 600 }}>250–350 L/room/day</div>
                    
                    <div style={{ color: '#8b90b8' }}>LEED EB target:</div>
                    <div style={{ color: '#f0f2ff', fontWeight: 600 }}>&lt; 200 L/room/day</div>
                </div>

                <div style={{ height: 8, background: 'linear-gradient(to right, #10b981 33%, #fbbf24 33% 66%, #f87171 66%)', borderRadius: 4, position: 'relative' }}>
                    <div style={{ 
                        position: 'absolute', top: -4, bottom: -4, width: 4, background: '#fff', borderRadius: 2,
                        left: mounted ? `${Math.min(100, Math.max(0, statusPct))}%` : '0%',
                        transition: 'left 0.8s ease',
                        boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                    }} />
                </div>

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: '#8b90b8', lineHeight: 1.6 }}>
                    <div style={{ color: '#f0f2ff', fontWeight: 600, marginBottom: 4 }}>Sources & Methodology</div>
                    <div style={{ marginBottom: 4 }}>
                        <strong style={{ color: '#3b82f6' }}>Dubai Hospitality Avg:</strong> Sourced from <a href="https://www.dubaisce.gov.ae/en/" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Dubai Supreme Council of Energy (DSCE)</a> and <a href="https://str.com/" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>STR/HotStats</a>. The benchmark is based on <em>occupied</em> rooms. The intensity above uses a generic {rooms} total room count.
                    </div>
                    <div>
                        <strong style={{ color: '#3b82f6' }}>LEED EB Target:</strong> Approximated from <a href="https://www.usgbc.org/leed/v41" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>LEED v4.1 O+M</a> Indoor Water Use Reduction baseline for hot/dry climates.
                    </div>
                </div>
            </div>
        );
    };

    const renderEnergyBenchmark = () => {
        if (dataKey !== 'Energy') return null;
        
        const intensity = currentVal / (rooms * 30); // kWh / room / day
        
        let statusPct = 90;
        if (intensity < 30) { statusPct = 20; }
        else if (intensity <= 45) { statusPct = 50; }

        return (
            <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff' }}>Energy Intensity</h4>
                    <div style={{ cursor: 'help', fontSize: 12, color: '#8b90b8' }} title={`Room count used: ${rooms} (${currentSiteId ? currentSite?.name : 'All Sites'}). Connect your occupancy data for accurate intensity.`}>
                        ⓘ
                    </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 16px', fontSize: 13, marginBottom: 16 }}>
                    <div style={{ color: '#8b90b8' }}>Your usage:</div>
                    <div style={{ color: '#f0f2ff', fontWeight: 600 }}>{intensity.toFixed(1)} kWh/room/day</div>
                    
                    <div style={{ color: '#8b90b8' }}>UAE hotel avg:</div>
                    <div style={{ color: '#f0f2ff', fontWeight: 600 }}>~35–45 kWh/room/day</div>
                    
                    <div style={{ color: '#8b90b8' }}>Green Key target:</div>
                    <div style={{ color: '#f0f2ff', fontWeight: 600 }}>&lt; 30 kWh/room/day</div>
                </div>

                <div style={{ height: 8, background: 'linear-gradient(to right, #10b981 33%, #fbbf24 33% 66%, #f87171 66%)', borderRadius: 4, position: 'relative' }}>
                    <div style={{ 
                        position: 'absolute', top: -4, bottom: -4, width: 4, background: '#fff', borderRadius: 2,
                        left: mounted ? `${Math.min(100, Math.max(0, statusPct))}%` : '0%',
                        transition: 'left 0.8s ease',
                        boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                    }} />
                </div>

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: '#8b90b8', lineHeight: 1.6 }}>
                    <div style={{ color: '#f0f2ff', fontWeight: 600, marginBottom: 4 }}>Sources & Methodology</div>
                    <div style={{ marginBottom: 4 }}>
                        <strong style={{ color: '#10b981' }}>UAE Hotel Avg:</strong> Sourced from <a href="https://edgebuildings.com/" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>IFC EDGE tool</a> (Climate Zone 1) and <a href="https://www.cbre.ae/services/real-estate-types/hotels-and-hospitality" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>CBRE Hotels ME</a> Benchmarking Report. This is a midpoint baseline; luxury properties may skew higher.
                    </div>
                    <div>
                        <strong style={{ color: '#10b981' }}>Green Key Target:</strong> Industry-accepted "high performance" threshold for MENA climate zone. <a href="https://www.greenkey.global/" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>Green Key</a> focuses on continuous improvement rather than hard limits.
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div 
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} 
                onClick={onClose}
            />
            <div style={{ position: 'relative', width: '100%', maxWidth: 900, maxHeight: '90vh', background: '#13152a', borderRadius: 28, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                
                <div style={{ overflowY: 'auto', padding: 32 }}>
                    
                    {/* Section 1: Modal Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}20`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon />
                            </div>
                            <div>
                                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f0f2ff', margin: 0 }}>{stat.name} Intelligence</h2>
                                <div style={{ fontSize: 14, color: '#8b90b8', marginTop: 4 }}>{subtitle}</div>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: 36, height: 36, borderRadius: '50%', color: '#f0f2ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✕
                        </button>
                    </div>

                    {/* Section 2: 4 KPI Tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 13, color: '#8b90b8', marginBottom: 8 }}>Current Period</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: color, marginBottom: 12 }}>{stat.value}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: badgeBg, color: badgeColor, padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                <span>{arrow}</span> {stat.change}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 13, color: '#8b90b8', marginBottom: 8 }}>vs Last Month</div>
                            {hasPrev ? (
                                <>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: deltaColor, marginBottom: 12 }}>
                                        {deltaStr}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#8b90b8' }}>
                                        {((absDelta / prevVal) * 100).toFixed(1)}% {absDelta > 0 ? 'increase' : 'decrease'}
                                    </div>
                                </>
                            ) : (
                                <div style={{ fontSize: 16, fontWeight: 600, color: '#f0f2ff', marginTop: 8 }}>First recorded period</div>
                            )}
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 13, color: '#8b90b8', marginBottom: 8 }}>7-month baseline</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f2ff', marginBottom: 12 }}>
                                Avg: {avg.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: 14, color: '#8b90b8' }}>{unit}</span>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f2ff' }}>
                                <span style={{ color: isEnv ? '#f87171' : '#10b981', marginRight: 4 }}>↑</span> 
                                Peak: {peak.month} ({peak.value.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f2ff' }}>
                                <span style={{ color: isEnv ? '#10b981' : '#f87171', marginRight: 4 }}>↓</span> 
                                Low: {low.month} ({low.value.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Annotated Chart */}
                    <div style={{ marginBottom: 16 }}>
                        {trendBadge}
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="modalColorGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dx={-10} width={60} />
                                    <RechartsTooltip content={<CustomTooltipBox />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                    
                                    {avg > 0 && (
                                        <>
                                            <ReferenceArea y1={avg * 0.9} y2={avg * 1.1} fill="rgba(255,255,255,0.03)" strokeOpacity={0} />
                                            <ReferenceLine y={avg} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" strokeWidth={1} label={{ position: 'right', value: 'Avg', fill: '#8b90b8', fontSize: 11 }} />
                                        </>
                                    )}

                                    <Area 
                                        type="monotone" 
                                        dataKey={dataKey} 
                                        stroke={color} 
                                        strokeWidth={3} 
                                        fillOpacity={1} 
                                        fill="url(#modalColorGradient)" 
                                        animationDuration={1500}
                                        activeDot={{ r: 6, fill: color, stroke: '#13152a', strokeWidth: 2 }}
                                        dot={renderCustomDot}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Section 4: Source Breakdown */}
                    {!stat.scope && stat.contributing_elements && stat.contributing_elements.length > 0 && (
                        <ElementBreakdownPanel elements={stat.contributing_elements} color={color} primaryUnit={unit.trim()} />
                    )}
                    {renderFuelBreakdown()}
                    {renderGHGBreakdown()}
                    {renderWaterBenchmark()}
                    {renderEnergyBenchmark()}
                </div>

            </div>
        </div>
    );
}
