import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { KeyRound } from 'lucide-react';
import { api } from '../../services/api';

const SetupAccount: React.FC = () => {
  const navigate = useNavigate();
  const { user, fetchUser } = useAuthStore();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Direct axios call to the backend to update user password
      await api.put(
        '/users/me/password', 
        { password }
      );
      
      // Refresh the user state so they no longer have must_reset_password=True
      await fetchUser();
      
      if (!user?.profile?.company_id) {
         navigate('/onboarding', { replace: true });
      } else {
         navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update your password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" opacity="0.4" />
              <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
              <path d="M12 12L12 21" opacity="0.6" />
              <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            Set up your account
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6 }}>
            Welcome {user?.first_name || ''}! Please create a secure password for your account to continue.
          </p>
        </div>

        <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
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
              <span>⚠</span> {error}
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
            <label className="form-label">Confirm Password</label>
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
                placeholder="Repeat your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          >
            {loading ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupAccount;
