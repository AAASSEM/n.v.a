import { useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useTranslation } from '../../i18n';
import DynamicChart from '../DynamicChart';

export default function PinnedDashboardItems() {
    const { t } = useTranslation();
    const dashboardItems = useChatStore((s) => s.dashboardItems);
    const fetchDashboardItems = useChatStore((s) => s.fetchDashboardItems);
    const removeDashboardItem = useChatStore((s) => s.removeDashboardItem);

    useEffect(() => {
        fetchDashboardItems();
    }, [fetchDashboardItems]);

    if (dashboardItems.length === 0) return null;

    return (
        <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                {t('aiChat.myDashboard', 'My Dashboard')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {dashboardItems.map((item) => (
                    <div key={item.id} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)', padding: 16, position: 'relative',
                    }}>
                        <button
                            onClick={() => removeDashboardItem(item.id)}
                            title={t('aiChat.unpin', 'Remove')}
                            style={{
                                position: 'absolute', top: 10, right: 10, background: 'none', border: 'none',
                                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
                            }}
                        >
                            ✕
                        </button>
                        <DynamicChart chart={item.chart} height={200} />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                            {t('aiChat.pinnedOn', 'Pinned on')} {new Date(item.created_at).toLocaleDateString()}
                            {' — '}{t('aiChat.snapshotNote', 'snapshot, not live data')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
