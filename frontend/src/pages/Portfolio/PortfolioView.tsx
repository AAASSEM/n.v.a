import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SiteData {
    id: number;
    name: string;
    emirate: string;
    grid_ef: number;
}

interface MetricBreakdown {
    name: string;
    unit: string;
    combined_total: number;
    sites: Array<{
        site_id: number;
        site_name: string;
        value: number;
        pct_share: number;
        emirate?: string;
        grid_ef?: number;
    }>;
}

interface Timeseries {
    metric: string;
    data: Array<{
        name: string;
        [site_id: string]: number | string;
    }>;
}

interface PortfolioData {
    metrics: MetricBreakdown[];
    timeseries: Timeseries[];
    sites: SiteData[];
}

export default function PortfolioView() {
    
    // We only need to fetch this if user has > 1 site, but we'll fetch anyway.
    const { data, isLoading } = useQuery<PortfolioData>({
        queryKey: ['portfolio', 'E'],
        queryFn: async () => {
            const res = await api.get(`/dashboard/portfolio?pillar=E`);
            return res.data;
        }
    });

    // Generate colors for sites based on index
    const SITE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6'];

    return (
        <AppLayout>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f0f2ff', margin: '0 0 8px 0' }}>Portfolio Analysis</h1>
                        <div style={{ fontSize: 15, color: '#8b90b8' }}>Cross-site performance tracking and footprint attribution.</div>
                    </div>
                </div>



                {isLoading && (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: '#8b90b8' }}>Loading portfolio data...</div>
                )}
                
                {!isLoading && data?.sites.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: '#8b90b8' }}>
                        No sites configured or active for this company.
                    </div>
                )}

                {!isLoading && data && data.sites.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                        {data.metrics.map(metric => {
                            const ts = data.timeseries.find(t => t.metric === metric.name);
                            return (
                                <div key={metric.name} style={{ background: '#13152a', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', padding: 32, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 40 }}>
                                    
                                    {/* Left: Trend Chart */}
                                    <div>
                                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f0f2ff', marginBottom: 24 }}>{metric.name} Trend</h3>
                                        {ts && ts.data.length > 0 ? (
                                            <div style={{ height: 300 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={ts.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={10} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} width={80} tickFormatter={(val: any) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(val))} />
                                                        <Tooltip 
                                                            contentStyle={{ background: '#1c1e30', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                                                            itemStyle={{ fontSize: 13, fontWeight: 600 }}
                                                            labelStyle={{ color: '#8b90b8', fontSize: 12, marginBottom: 8 }}
                                                            formatter={(val: any) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val))}
                                                        />
                                                        <Legend wrapperStyle={{ paddingTop: 20, fontSize: 12 }} />
                                                        {data.sites.map((site, i) => (
                                                            <Line 
                                                                key={site.id} 
                                                                type="monotone" 
                                                                dataKey={String(site.id)} 
                                                                name={site.name} 
                                                                stroke={SITE_COLORS[i % SITE_COLORS.length]} 
                                                                strokeWidth={3}
                                                                dot={{ r: 4, fill: '#13152a', strokeWidth: 2 }}
                                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                            />
                                                        ))}
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b90b8' }}>
                                                No trend data available.
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Right: Site Breakdown */}
                                    <div>
                                        <div style={{ marginBottom: 24 }}>
                                            <div style={{ fontSize: 13, color: '#8b90b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                                                Combined Total ({ts && ts.data.length > 0 ? ts.data[ts.data.length - 1].name : 'Current Month'})
                                            </div>
                                            <div style={{ fontSize: 28, fontWeight: 900, color: '#f0f2ff' }}>
                                                {metric.combined_total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                <span style={{ fontSize: 16, color: '#8b90b8', fontWeight: 600, marginLeft: 6 }}>{metric.unit}</span>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {metric.sites.sort((a, b) => b.value - a.value).map((s) => {
                                                const color = SITE_COLORS[data.sites.findIndex(xs => xs.id === s.site_id) % SITE_COLORS.length] || '#8b90b8';
                                                return (
                                                    <div key={s.site_id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff' }}>{s.site_name}</div>
                                                            </div>
                                                            <div style={{ fontSize: 13, fontWeight: 800, color: color }}>
                                                                {s.pct_share.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2ff', marginBottom: 8 }}>
                                                            {s.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {metric.unit}
                                                        </div>
                                                        
                                                        {s.grid_ef !== undefined && (
                                                            <div style={{ fontSize: 11, color: '#8b90b8', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 6, display: 'inline-block' }}>
                                                                EF: <strong>{s.grid_ef}</strong> kgCO₂e/kWh ({s.emirate})
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
