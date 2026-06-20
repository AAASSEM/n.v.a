import AppLayout from '../layout/AppLayout';
import { useTranslation } from '../../i18n';

interface AccessDeniedProps {
    title?: string;
    message?: string;
    showLayout?: boolean;
}

export default function AccessDenied({ 
    title, 
    message,
    showLayout = false
}: AccessDeniedProps) {
    const { t } = useTranslation();
    const displayTitle = title || t('access.title');
    const displayMessage = message || t('access.message');
    const content = (
        <div className="animate-fade-in" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: showLayout ? 'calc(100vh - 120px)' : '400px',
            textAlign: 'center',
            padding: '40px 20px'
        }}>
            <div style={{
                width: 80,
                height: 80,
                borderRadius: '24px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)'
            }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            </div>
            <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 800, 
                color: 'var(--text-primary)', 
                marginBottom: 12,
                letterSpacing: '-0.5px'
            }}>
                {displayTitle}
            </h1>
            <p style={{ 
                fontSize: '15px', 
                color: 'var(--text-muted)', 
                maxWidth: '400px', 
                lineHeight: 1.6,
                marginBottom: 32
            }}>
                {displayMessage}
            </p>
            <button 
                className="btn btn-secondary"
                onClick={() => window.history.back()}
                style={{ borderRadius: '12px' }}
            >
                {t('access.goBack')}
            </button>
        </div>
    );

    if (showLayout) {
        return <AppLayout>{content}</AppLayout>;
    }

    return content;
}
