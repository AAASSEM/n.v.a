import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTranslation, translateUnitStr } from '../../i18n';

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
    const { t, lang, n } = useTranslation();
    const isRtl = lang === 'ar';
    
    // We only need to fetch this if user has > 1 site, but we'll fetch anyway.
    const { data, isLoading } = useQuery<PortfolioData>({
        queryKey: ['portfolio', 'E'],
        queryFn: async () => {
            const res = await api.get(`/dashboard/portfolio?pillar=E`);
            return res.data;
        }
    });

    const translateMonth = (monthName: string) => {
        if (!monthName) return '';
        const clean = monthName.trim().toLowerCase();
        
        if (clean === 'jan' || clean === 'january') return t('months.short.jan');
        if (clean === 'feb' || clean === 'february') return t('months.short.feb');
        if (clean === 'mar' || clean === 'march') return t('months.short.mar');
        if (clean === 'apr' || clean === 'april') return t('months.short.apr');
        if (clean === 'may') return t('months.short.may');
        if (clean === 'jun' || clean === 'june') return t('months.short.jun');
        if (clean === 'jul' || clean === 'july') return t('months.short.jul');
        if (clean === 'aug' || clean === 'august') return t('months.short.aug');
        if (clean === 'sep' || clean === 'september') return t('months.short.sep');
        if (clean === 'oct' || clean === 'october') return t('months.short.oct');
        if (clean === 'nov' || clean === 'november') return t('months.short.nov');
        if (clean === 'dec' || clean === 'december') return t('months.short.dec');
        
        return monthName;
    };

    // Generate colors for sites based on index
    const SITE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6'];

    return (
        <AppLayout>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexDirection: isRtl ? 'row-reverse' : 'row', textAlign: isRtl ? 'right' : 'left' }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f0f2ff', margin: '0 0 8px 0' }}>{t('portfolio.overview')}</h1>
                        <div style={{ fontSize: 15, color: '#8b90b8' }}>{t('portfolio.subtitle')}</div>
                    </div>
                </div>

                {isLoading && (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: '#8b90b8' }}>{t('portfolio.loading')}</div>
                )}
                
                {!isLoading && data?.sites.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: '#8b90b8' }}>
                        {t('portfolio.noSites')}
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
                                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f0f2ff', marginBottom: 24, textAlign: isRtl ? 'right' : 'left' }}>{t(metric.name)} {t('portfolio.trend')}</h3>
                                        {ts && ts.data.length > 0 ? (
                                            <div style={{ height: 300 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={ts.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} dy={10} tickFormatter={translateMonth} interval={0} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90b8', fontSize: 12 }} width={80} orientation={isRtl ? 'right' : 'left'} tickFormatter={(val: any) => n(val, { maximumFractionDigits: 2 })} />
                                                        <Tooltip 
                                                            contentStyle={{ background: '#1c1e30', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, textAlign: isRtl ? 'right' : 'left' }}
                                                            itemStyle={{ fontSize: 13, fontWeight: 600 }}
                                                            labelStyle={{ color: '#8b90b8', fontSize: 12, marginBottom: 8 }}
                                                            formatter={(val: any) => n(val, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            labelFormatter={(val: any) => translateMonth(String(val))}
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
                                                {t('portfolio.noTrend')}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Right: Site Breakdown */}
                                    <div>
                                        <div style={{ marginBottom: 24, textAlign: isRtl ? 'right' : 'left' }}>
                                            <div style={{ fontSize: 13, color: '#8b90b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                                                {t('portfolio.combinedTotal')} ({ts && ts.data.length > 0 ? translateMonth(ts.data[ts.data.length - 1].name) : t('portfolio.currentMonth')})
                                            </div>
                                            <div style={{ fontSize: 28, fontWeight: 900, color: '#f0f2ff', display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: isRtl ? 'flex-end' : 'flex-start', flexDirection: 'row' }}>
                                                {n(metric.combined_total, { maximumFractionDigits: 1 })}
                                                <span style={{ fontSize: 16, color: '#8b90b8', fontWeight: 600 }}>{translateUnitStr(metric.unit, t)}</span>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {metric.sites.sort((a, b) => b.value - a.value).map((s) => {
                                                const color = SITE_COLORS[data.sites.findIndex(xs => xs.id === s.site_id) % SITE_COLORS.length] || '#8b90b8';
                                                return (
                                                    <div key={s.site_id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, textAlign: isRtl ? 'right' : 'left' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff' }}>{s.site_name}</div>
                                                            </div>
                                                            <div style={{ fontSize: 13, fontWeight: 800, color: color }}>
                                                                {n(s.pct_share, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2ff', marginBottom: 8, display: 'flex', gap: 6, justifyContent: isRtl ? 'flex-end' : 'flex-start', flexDirection: 'row' }}>
                                                            {n(s.value, { maximumFractionDigits: 1 })}
                                                            <span>{translateUnitStr(metric.unit, t)}</span>
                                                        </div>
                                                        
                                                        {s.grid_ef !== undefined && (
                                                            <div style={{ fontSize: 11, color: '#8b90b8', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 6, display: 'inline-block' }}>
                                                                EF: <strong>{s.grid_ef !== undefined ? n(s.grid_ef) : ''}</strong> kgCO₂e/kWh ({s.emirate})
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
