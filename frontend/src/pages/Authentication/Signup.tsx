import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Signup() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }),
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
                        Check your email
                    </h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                        We've sent a magic link to <strong>{email}</strong>. 
                        Please click the link to verify your account and continue.
                    </p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                        Return to Sign In
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
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" opacity="0.4" />
                                    <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
                                    <path d="M12 12L12 21" opacity="0.6" />
                                    <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
                            </svg>
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                            Create Account
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
                            <label className="form-label">First Name</label>
                            <input required type="text" className="form-input" placeholder="John"
                                value={firstName} onChange={e => setFirstName(e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label">Last Name</label>
                            <input required type="text" className="form-input" placeholder="Doe"
                                value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="form-label">Email Address</label>
                        <input required type="email" autoComplete="email" className="form-input"
                            placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Password</label>
                        <input required type="password" autoComplete="new-password" className="form-input"
                            placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
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
                                Creating account...
                            </>
                        ) : 'Create Account'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--accent-green)', fontWeight: 600, textDecoration: 'none' }}>
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
