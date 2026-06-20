import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { useSiteStore } from '../../../stores/siteStore';
import { useTranslation } from '../../../i18n';

export const AnomalyAlerts = () => {
    const { t, lang, n } = useTranslation();
    const currentSiteId = useSiteStore(s => s.currentSiteId);
    const [dismissed, setDismissed] = useState(false);

    const now = new Date();
    const monthA = { year: now.getFullYear(), month: now.getMonth() || 12 }; // previous month
    if (now.getMonth() === 0) monthA.year -= 1;
    const monthB = { year: now.getFullYear(), month: now.getMonth() + 1 }; // current month

    const { data: compareData, isLoading } = useQuery({
        queryKey: ['dashboard', 'anomaly_check', currentSiteId, monthA, monthB],
        queryFn: async () => {
            const res = await api.get(
                `/dashboard/compare?month_a_year=${monthA.year}&month_a_month=${monthA.month}` +
                `&month_b_year=${monthB.year}&month_b_month=${monthB.month}&pillar=E`
            );
            return res.data;
        },
        staleTime: 1000 * 60 * 60,
    });

    useEffect(() => {
        if (!isLoading && compareData?.rows && !dismissed) {
            const hasAnomalies = compareData.rows.some((r: any) => 
                r.delta_pct !== null && !r.is_improvement && r.delta_pct > 5
            );
            if (hasAnomalies) {
                const timer = setTimeout(() => setDismissed(true), 5000);
                return () => clearTimeout(timer);
            }
        }
    }, [isLoading, compareData, dismissed]);

    if (dismissed || isLoading || !compareData || !compareData.rows) return null;

    // Find anomalies (regressions > 5%)
    const anomalies = compareData.rows.filter((r: any) => 
        r.delta_pct !== null && !r.is_improvement && r.delta_pct > 5
    );

    if (anomalies.length === 0) return null;

    const isRtl = lang === 'ar';

    return (
        <div style={{
            background: isRtl
                ? 'linear-gradient(-90deg, rgba(244,63,94,0.1) 0%, rgba(16,18,30,0) 100%)'
                : 'linear-gradient(90deg, rgba(244,63,94,0.1) 0%, rgba(16,18,30,0) 100%)',
            borderLeft: isRtl ? '1px solid rgba(255,255,255,0.05)' : '4px solid #f43f5e',
            borderTop: '1px solid rgba(244,63,94,0.2)',
            borderBottom: '1px solid rgba(244,63,94,0.2)',
            borderRight: isRtl ? '4px solid #f43f5e' : '1px solid rgba(255,255,255,0.05)',
            borderRadius: isRtl ? '12px 0 0 12px' : '0 12px 12px 0',
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            position: 'relative'
        }}>
            <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'rgba(244,63,94,0.2)',
                color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f2ff', marginBottom: 4 }}>
                    {t('dash.automatedAnomalyDetected')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {t('dash.anomalyDesc')}
                    <ul style={{ margin: isRtl ? '8px 20px 0 0' : '8px 0 0 20px', color: '#f43f5e', fontWeight: 600 }}>
                        {anomalies.map((a: any) => (
                            <li key={a.element_code}>
                                {a.name} {t('dash.increasedBy')} {n(a.delta_pct.toFixed(1))}% ({n(a.value_a)} {isRtl ? '←' : '→'} {n(a.value_b)} {a.unit})
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <button 
                onClick={() => setDismissed(true)}
                style={{ 
                    background: 'none', border: 'none', color: 'var(--text-muted)', 
                    cursor: 'pointer', padding: 4, display: 'flex' 
                }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    );
};
