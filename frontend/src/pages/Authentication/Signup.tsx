import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../config';
import DemoModal from '../../components/ui/DemoModal';
import { useTranslation } from '../../i18n';

export default function Signup() {
    const { t } = useTranslation();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showDemoModal, setShowDemoModal] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Registration failed');
            }
            setIsSuccess(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="auth-page">
                <div className="auth-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
                    <div style={{
                        width: 64, height: 64,
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
                        {t('signup.checkEmail')}
                    </h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                        {t('signup.magicLinkSent')} <strong>{email}</strong>. 
                        {t('signup.clickToVerify')}
                    </p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                        {t('signup.returnToSignIn')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <Link to="/" style={{ textDecoration: 'none', display: 'block', marginBottom: 32, cursor: 'pointer' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 52, height: 52,
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, var(--accent-green) 0%, #00a86b 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                            boxShadow: 'var(--shadow-glow-green)',
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2C6.5 2 2 6.5 2 12c0 3 1.3 5.7 3.5 7.5" opacity="0.6" />
    <path d="M12 6a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6 2.3 0 4.3-1.3 5.3-3.3" />
    <circle cx="12" cy="12" r="2.5" fill="white" stroke="none" />
    <path d="M18.5 11c0-2-1.5-3.5-3.5-3.5S11.5 9 11.5 11s1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5Z" fill="white" stroke="none" />
</svg>
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                            {t('signup.title')}
                        </h1>
                    </div>
                </Link>

                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 13.5,
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <span>⚠</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label className="form-label">{t('signup.firstName')}</label>
                            <input required type="text" className="form-input" placeholder="John"
                                value={firstName} onChange={e => setFirstName(e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label">{t('signup.lastName')}</label>
                            <input required type="text" className="form-input" placeholder="Doe"
                                value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="form-label">{t('signup.emailLabel')}</label>
                        <input required type="email" autoComplete="email" className="form-input"
                            placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>



                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={isLoading}
                        style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                    >
                        {isLoading ? (
                            <>
                                <div className="spinner spinner-sm" />
                                {t('signup.creating')}
                            </>
                        ) : t('signup.createBtn')}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowDemoModal(true)}
                        className="btn btn-secondary btn-lg"
                        style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                    >
                        {t('signup.viewDemo')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: 'var(--text-muted)' }}>
                    {t('signup.hasAccount')}{' '}
                    <Link to="/login" style={{ color: 'var(--accent-green)', fontWeight: 600, textDecoration: 'none' }}>
                        {t('signup.signIn')}
                    </Link>
                </div>
            </div>
            <DemoModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />
        </div>
    );
}
