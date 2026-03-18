import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, isLoading, error } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/dashboard';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login({ email, password });
            navigate(from, { replace: true });
        } catch {
            // Error handled by store
        }
    };

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
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" opacity="0.4" />
                                    <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
                                    <path d="M12 12L12 21" opacity="0.6" />
                                    <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
                            </svg>
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                            ESG Compass
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

                    <div>
                        <label className="form-label">Password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
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
                                Signing in...
                            </>
                        ) : 'Sign in'}
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
