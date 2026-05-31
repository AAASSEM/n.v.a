import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function Login() {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { requestLoginLink, isLoading, error } = useAuthStore();


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await requestLoginLink(email);
            setIsSubmitted(true);
        } catch {
            // Error handled by store
        }
    };

    if (isSubmitted) {
        return (
            <div className="auth-page">
                <div className="auth-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
                    <div style={{
                        width: 64, height: 64,
                        borderRadius: 32,
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                        color: 'var(--accent-green)',
                        fontSize: 28,
                    }}>
                        ✓
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.3px' }}>
                        Check your email
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 28 }}>
                        We sent a secure magic link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. 
                        Click the link in the email to log in instantly.
                    </p>
                    <button 
                        onClick={() => setIsSubmitted(false)}
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        Back to sign in
                    </button>
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
                            ESGravity
                        </h1>
                    </div>
                </Link>

                {/* Error */}
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
                    <div>
                        <label className="form-label">Email Address</label>
                        <input
                            id="email-address"
                            type="email"
                            required
                            autoComplete="email"
                            className="form-input"
                            placeholder="you@company.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
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
                                Sending link...
                            </>
                        ) : 'Send Magic Link'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: 'var(--text-muted)' }}>
                    Don't have an account?{' '}
                    <Link to="/signup" style={{ color: 'var(--accent-green)', fontWeight: 600, textDecoration: 'none' }}>
                        Sign up here
                    </Link>
                </div>
            </div>
        </div>
    );
}
