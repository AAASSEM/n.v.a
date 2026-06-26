import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const MagicLinkVerify: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { magicLinkLogin, user, fetchUser, logout } = useAuthStore();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const hasFetched = useRef(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('Invalid or missing authentication token.');
        return;
      }
      
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        await magicLinkLogin(token);
        await fetchUser();
        setStatus('success');
      } catch (err: any) {
        if (err?.message === 'PENDING_APPROVAL') {
          setStatus('pending');
        } else {
          setStatus('error');
          setErrorMessage(err.response?.data?.detail || err?.message || 'Failed to verify the magic link. It may be expired or already used.');
        }
      }
    };

    verifyToken();
  }, [token, magicLinkLogin, fetchUser]);

  useEffect(() => {
    if (status === 'success' && user) {
      // Small delay for smooth UX transition
      const timer = setTimeout(() => {
        if (user.is_developer) {
          navigate('/developer-admin', { replace: true });
        } else if (user.profile?.must_reset_password) {
          navigate('/setup-account', { replace: true });
        } else if (!user.profile?.company_id) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [status, user, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ padding: '40px 32px' }}>
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
            ESGravity
          </h2>
        </div>

        <div>
          {status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="spinner" style={{ width: 32, height: 32, marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Verifying security link...</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
                Please stay on this page while we authenticate your session.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
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
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Success!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 8 }}>Authentication complete. Launching platform...</p>
            </div>
          )}

          {status === 'pending' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72,
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
                boxShadow: '0 0 28px rgba(245,158,11,0.15)',
                animation: 'pulse 2s ease-in-out infinite',
              }}>
                <Clock size={32} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
                Email Verified — Pending Approval
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65, maxWidth: 320, margin: '0 auto 24px' }}>
                Your email has been confirmed. Your account is now in the <strong style={{ color: '#f59e0b' }}>review queue</strong> and will be activated once a developer admin approves your request.
              </p>
              <div style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 12,
                padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 24,
              }}>
                <Clock size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'left' }}>
                  You will receive an email with a login link once your account is approved.
                </span>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Back to Login
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: 56, height: 56, 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: '#ef4444', 
                borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                marginBottom: 16 
              }}>
                <AlertCircle size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Verification Failed</h3>
              <p style={{ color: '#f87171', fontSize: 13.5, marginTop: 8 }}>{errorMessage}</p>
              
              <div style={{ 
                marginTop: 32, 
                paddingTop: 24, 
                borderTop: '1px solid var(--border-subtle)', 
                width: '100%',
                textAlign: 'left'
              }}>
                <label className="form-label" style={{ marginBottom: 12 }}>Have a Backup Code?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Enter 6-digit code" 
                        maxLength={6}
                        style={{ textAlign: 'center', letterSpacing: '4px', fontWeight: 800, height: 44 }}
                        onChange={(e) => {
                            if (e.target.value.length === 6) {
                                magicLinkLogin(e.target.value).then(() => {
                                    fetchUser().then(() => setStatus('success'));
                                }).catch(err => setErrorMessage(err.message));
                            }
                        }}
                    />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>Check your email for the backup access code.</p>
              </div>

              <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 24 }}>
                <button
                    onClick={() => window.location.reload()}
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                >
                    Retry Link
                </button>
                <button
                    onClick={() => {
                        logout();
                        navigate('/login');
                    }}
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                >
                    Back to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MagicLinkVerify;
