import { useAuthStore } from '../../stores/authStore';

export default function TrialExpiredScreen() {
    const { logout } = useAuthStore();

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--bg-base, #0a0b1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 0,
        }}>
            {/* Radial glow */}
            <div style={{
                position: 'absolute', top: '30%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 600, height: 600, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 24,
                padding: '56px 64px',
                maxWidth: 540,
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.1) inset',
            }}>
                {/* Icon */}
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 32px',
                }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>

                <h1 style={{
                    fontSize: 28, fontWeight: 800,
                    color: '#f0f2ff', marginBottom: 16, lineHeight: 1.25,
                }}>
                    Your Free Trial Has Ended
                </h1>

                <p style={{
                    fontSize: 15, color: '#8b90b8', lineHeight: 1.7,
                    marginBottom: 40,
                }}>
                    Your 90-day free trial of <strong style={{ color: '#a5b4fc' }}>ESGravity</strong> has expired.
                    All your data is safe and will be restored once your account is upgraded.
                    Please contact us to continue your sustainability journey.
                </p>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a
                        href="mailto:support@esgravity.com?subject=Trial%20Upgrade%20Request"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '12px 28px', borderRadius: 12,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff', fontWeight: 700, fontSize: 14,
                            textDecoration: 'none',
                            boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                            transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        Contact Us to Upgrade
                    </a>

                    <button
                        onClick={logout}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '12px 24px', borderRadius: 12,
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#8b90b8', fontWeight: 600, fontSize: 14,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#f0f2ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#8b90b8'; }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Log Out
                    </button>
                </div>

                <p style={{ marginTop: 32, fontSize: 12, color: '#475569' }}>
                    support@esgravity.com · Your data is preserved
                </p>
            </div>
        </div>
    );
}
