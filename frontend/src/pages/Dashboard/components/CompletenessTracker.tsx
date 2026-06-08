
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useSiteStore } from '../../../stores/siteStore';

export const CompletenessTracker = ({ framework }: { framework: string | null }) => {
    const currentSiteId = useSiteStore(s => s.currentSiteId);
    const navigate = useNavigate();

    const { data: completeness, isLoading } = useQuery({
        queryKey: ['dashboard', 'completeness', currentSiteId, framework],
        queryFn: async () => {
            const url = framework 
                ? `/dashboard/completeness?framework=${framework}` 
                : '/dashboard/completeness';
            return (await api.get(url)).data;
        }
    });

    if (isLoading || !completeness) {
        return (
            <div className="skeleton" style={{ height: 100, borderRadius: 16, marginBottom: 24 }}></div>
        );
    }

    const { period, total_elements, submitted, by_pillar } = completeness;
    const pct = total_elements > 0 ? Math.round((submitted / total_elements) * 100) : 0;
    
    // E, S, G percentages relative to total
    const ePct = total_elements > 0 ? (by_pillar.E.submitted / total_elements) * 100 : 0;
    const sPct = total_elements > 0 ? (by_pillar.S.submitted / total_elements) * 100 : 0;
    const gPct = total_elements > 0 ? (by_pillar.G.submitted / total_elements) * 100 : 0;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12,
            backdropFilter: 'blur(20px)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {period} Reporting Progress
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#f0f2ff' }}>
                    {submitted}/{total_elements} ({pct}%)
                </span>
            </div>
            
            {/* The Bar */}
            <div style={{ display: 'flex', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                {ePct > 0 && <div style={{ width: `${ePct}%`, background: '#10b981', transition: 'width 1s ease' }} />}
                {sPct > 0 && <div style={{ width: `${sPct}%`, background: '#6366f1', transition: 'width 1s ease' }} />}
                {gPct > 0 && <div style={{ width: `${gPct}%`, background: '#f59e0b', transition: 'width 1s ease' }} />}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ color: '#10b981', fontWeight: 600 }}>E: {by_pillar.E.submitted}/{by_pillar.E.total} {by_pillar.E.submitted === by_pillar.E.total && by_pillar.E.total > 0 ? '✓' : '⚠'}</div>
                    <div style={{ color: '#6366f1', fontWeight: 600 }}>S: {by_pillar.S.submitted}/{by_pillar.S.total} {by_pillar.S.submitted === by_pillar.S.total && by_pillar.S.total > 0 ? '✓' : '⚠'}</div>
                    <div style={{ color: '#f59e0b', fontWeight: 600 }}>G: {by_pillar.G.submitted}/{by_pillar.G.total} {by_pillar.G.submitted === by_pillar.G.total && by_pillar.G.total > 0 ? '✓' : '⚠'}</div>
                </div>
                {pct < 100 && (
                    <button 
                        onClick={() => navigate('/checklist')}
                        style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        Go to Data Entry 
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                )}
            </div>
        </div>
    );
};
