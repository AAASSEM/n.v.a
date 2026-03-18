import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const MagicLinkVerify: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { magicLinkLogin, user, fetchUser } = useAuthStore();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
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
        setStatus('error');
        setErrorMessage(err.response?.data?.detail || 'Failed to verify the magic link. It may be expired or already used.');
      }
    };

    verifyToken();
  }, [token, magicLinkLogin, fetchUser]);

  useEffect(() => {
    if (status === 'success' && user) {
      // Small delay for smooth UX transition
      const timer = setTimeout(() => {
        if (user.profile?.must_reset_password) {
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" opacity="0.4" />
                <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
                <path d="M12 12L12 21" opacity="0.6" />
                <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            ESG Compass
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
                    onClick={() => navigate('/login')}
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
