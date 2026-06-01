import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setMessage(null);

        try {
            const res = await api.post('/auth/forgot-password', { email });
            setMessage(res.data.detail || 'If the email is registered, you will receive a password reset link shortly.');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
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
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2C6.5 2 2 6.5 2 12c0 3 1.3 5.7 3.5 7.5" opacity="0.6" />
    <path d="M12 6a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6 2.3 0 4.3-1.3 5.3-3.3" />
    <circle cx="12" cy="12" r="2.5" fill="white" stroke="none" />
    <path d="M18.5 11c0-2-1.5-3.5-3.5-3.5S11.5 9 11.5 11s1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5Z" fill="white" stroke="none" />
</svg>
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                            Forgot Password
                        </h1>
                        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                    </div>
                </Link>

                {message && (
                    <div style={{
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        color: 'var(--accent-green)',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 13.5,
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <span>✓</span> {message}
                    </div>
                )}

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

                {!message && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="form-label">Email Address</label>
                            <input
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
                                    Sending...
                                </>
                            ) : 'Send Reset Link'}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: 'var(--text-muted)' }}>
                    Remember your password?{' '}
                    <Link to="/login" style={{ color: 'var(--accent-green)', fontWeight: 600, textDecoration: 'none' }}>
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
