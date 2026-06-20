
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { useSiteStore } from '../../../stores/siteStore';
import { useTranslation } from '../../../i18n';

export const ScoreRing = () => {
    const { t, lang, n } = useTranslation();
    const isRtl = lang === 'ar';
    const { user } = useAuthStore();
    const currentSiteId = useSiteStore(s => s.currentSiteId);

    const userRole = user?.profile?.role;
    const isAuthorized = userRole === 'super_user' || userRole === 'admin';

    const getArabicGrade = (g: string) => {
        if (!g) return '';
        return g
            .replace('A', 'أ')
            .replace('B', 'ب')
            .replace('C', 'ج')
            .replace('D', 'د')
            .replace('F', 'هـ');
    };

    const { data: scoreData, isLoading } = useQuery({
        queryKey: ['dashboard', 'score', currentSiteId],
        queryFn: async () => (await api.get('/dashboard/score')).data,
        enabled: isAuthorized,
    });

    if (!isAuthorized) {
        return null;
    }

    if (isLoading || !scoreData) {
        return <div className="skeleton" style={{ width: 140, height: 60, borderRadius: 16 }} />;
    }

    const { overall, grade, delta } = scoreData;
    
    // Calculate SVG circle properties
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (overall / 100) * circumference;
    
    const color = overall >= 80 ? '#10b981' : overall >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '8px 16px 8px 8px',
            backdropFilter: 'blur(20px)'
        }}>
            <div style={{ position: 'relative', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="50" height="50" style={{ transform: 'rotate(-90deg)' }}>
                    <circle 
                        cx="25" cy="25" r={radius} 
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" 
                    />
                    <circle 
                        cx="25" cy="25" r={radius} 
                        fill="none" stroke={color} strokeWidth="4" 
                        strokeDasharray={circumference} 
                        strokeDashoffset={strokeDashoffset} 
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                    />
                </svg>
                <div style={{ position: 'absolute', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {isRtl ? getArabicGrade(grade) : grade}
                </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('dash.scoreRing')}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#f0f2ff', lineHeight: 1 }}>
                        {n(overall)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? '#10b981' : '#f87171', display: 'flex', alignItems: 'center', gap: 4 }} title={t('dash.vsLastMonth')}>
                        {delta > 0 ? '+' : ''}{n(delta)} pts
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>{t('dash.vsLastMonth')}</span>
                    </span>
                </div>
            </div>
        </div>
    );
};
