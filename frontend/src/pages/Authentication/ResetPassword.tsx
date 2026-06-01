import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const ResetPassword: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { resetPassword, isLoading, error: authError } = useAuthStore();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!token) {
            setError('Invalid or missing security token.');
            setStatus('error');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        try {
            await resetPassword(token, password);
            setStatus('success');
            setTimeout(() => {
                navigate('/dashboard', { replace: true });
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to reset password. The link may have expired or is invalid.');
            setStatus('error');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        Reset Password
                    </h2>
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                        Create a new secure password for your ESGravity account.
                    </p>
                </div>

                {status === 'success' ? (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: 56, height: 56,
                            background: 'var(--accent-green-dim)',
                            color: 'var(--accent-green)',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 16,
                            boxShadow: '0 0 20px rgba(0, 208, 132, 0.1)'
                        }}>
                            <ShieldCheck size={28} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Password Reset Successful!</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 8 }}>Logging in and redirecting to dashboard...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {(error || authError) && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#f87171',
                                padding: '12px 14px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 13.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                                <AlertCircle size={18} />
                                <span>{error || authError}</span>
                            </div>
                        )}

                        <div>
                            <label className="form-label">New Password</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 12, left: 12, color: 'var(--text-muted)' }}>
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="form-input"
                                    style={{ paddingLeft: 40 }}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Confirm New Password</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 12, left: 12, color: 'var(--text-muted)' }}>
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="form-input"
                                    style={{ paddingLeft: 40 }}
                                    placeholder="Repeat new password"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                        >
                            {isLoading ? (
                                <>
                                    <div className="spinner spinner-sm" />
                                    Saving...
                                </>
                            ) : 'Update Password'}
                        </button>
                    </form>
                )}

                {status !== 'success' && (
                    <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13.5, color: 'var(--text-muted)' }}>
                        <Link to="/login" style={{ color: 'var(--accent-green)', fontWeight: 600, textDecoration: 'none' }}>
                            Back to Sign In
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
