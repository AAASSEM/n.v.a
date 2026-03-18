import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import AppLayout from '../../components/layout/AppLayout';
import { canPerformAction } from '../../config/rbac';

export default function SettingsView() {
    const { user, fetchUser } = useAuthStore();
    const queryClient = useQueryClient();
    
    const canAccessOrg = canPerformAction(user?.profile?.role, 'settings_org', 'read');
    
    // Default to profile if access to organization is restricted
    const [activeTab, setActiveTab] = useState<'profile' | 'organization' | 'security'>(
        canAccessOrg ? 'profile' : 'profile' 
    );

    const [profileData, setProfileData] = useState({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
    });

    const { data: company, isLoading: loadingCompany } = useQuery({
        queryKey: ['my_company'],
        queryFn: async () => (await api.get('/companies/me')).data,
        enabled: !!user?.profile?.company_id
    });

    const [orgData, setOrgData] = useState({
        name: '', registration_number: '', trade_license_number: '',
        emirate: '', sector: '', has_green_key: false
    });

    React.useEffect(() => {
        if (company) setOrgData({
            name: company.name || '', registration_number: company.registration_number || '',
            trade_license_number: company.trade_license_number || '', emirate: company.emirate || '',
            sector: company.sector || '', has_green_key: company.has_green_key || false
        });
    }, [company]);

    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [message, setMessage] = useState({ text: '', type: '' });

    const updateProfile = useMutation({
        mutationFn: async (data: typeof profileData) => await api.put('/users/me', data),
        onSuccess: () => { setMessage({ text: 'Profile updated successfully!', type: 'success' }); fetchUser(); },
        onError: () => setMessage({ text: 'Failed to update profile.', type: 'error' })
    });

    const updateOrg = useMutation({
        mutationFn: async (data: typeof orgData) => {
            if (!company?.id) return;
            return await api.put(`/companies/${company.id}`, data);
        },
        onSuccess: () => { setMessage({ text: 'Organization settings updated!', type: 'success' }); queryClient.invalidateQueries({ queryKey: ['my_company'] }); },
        onError: () => setMessage({ text: 'Failed to update company info.', type: 'error' })
    });

    const changePassword = useMutation({
        mutationFn: async (data: { password: string }) => await api.put('/users/me/password', data),
        onSuccess: () => { setMessage({ text: 'Password changed successfully!', type: 'success' }); setPwdData({ current: '', new: '', confirm: '' }); },
        onError: () => setMessage({ text: 'Password change failed.', type: 'error' })
    });

    const handleProfileSubmit = (e: React.FormEvent) => { e.preventDefault(); setMessage({ text: '', type: '' }); updateProfile.mutate(profileData); };
    const handleOrgSubmit = (e: React.FormEvent) => { e.preventDefault(); setMessage({ text: '', type: '' }); updateOrg.mutate(orgData); };
    const handlePwdSubmit = (e: React.FormEvent) => {
        e.preventDefault(); setMessage({ text: '', type: '' });
        if (pwdData.new !== pwdData.confirm) { setMessage({ text: "Passwords don't match.", type: 'error' }); return; }
        changePassword.mutate({ password: pwdData.new });
    };

    const tabs = [
        { id: 'profile', label: 'Personal Profile', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
        ...(canAccessOrg ? [{ id: 'organization', label: 'Organization', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7M4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17" /></svg> }] : []),
        { id: 'security', label: 'Security', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg> },
    ];

    const initials = `${(user?.first_name || '').charAt(0)}${(user?.last_name || '').charAt(0)}`.toUpperCase();
    const isAdmin = ['super_user', 'admin'].includes(user?.profile?.role || '');

    return (
        <AppLayout>
            <style>{`
                .sv-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #f0f2ff; }

                /* ── HEADER ── */
                .sv-header { margin-bottom: 24px; }
                .sv-title { font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 800; color: #f0f2ff; letter-spacing: -0.02em; margin-bottom: 4px; }
                .sv-subtitle { font-size: 13px; color: #6b7280; font-weight: 300; }

                /* ── ALERT ── */
                .sv-alert { padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; margin-bottom: 20px; }
                .sv-alert-success { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); color: #34d399; }
                .sv-alert-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #f87171; }

                /* ── TABS ── */
                .sv-tabs { display: flex; gap: 4px; padding: 4px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; width: fit-content; margin-bottom: 24px; }
                .sv-tab { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: #6b7280; transition: all 0.18s; white-space: nowrap; font-family: inherit; }
                .sv-tab:hover { color: #f0f2ff; background: rgba(255,255,255,0.05); }
                .sv-tab.active { background: rgba(255,255,255,0.1); color: #f0f2ff; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }

                /* ── LAYOUT ── */
                .sv-layout { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }
                @media (max-width: 900px) { .sv-layout { grid-template-columns: 1fr; } }

                /* ── CARD ── */
                .sv-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
                .sv-card-body { padding: 28px; }
                .sv-card-section-title { font-family: 'Inter', sans-serif; font-size: 17px; font-weight: 700; color: #f0f2ff; margin-bottom: 4px; letter-spacing: -0.01em; }
                .sv-card-section-sub { font-size: 12px; color: #6b7280; font-weight: 300; margin-bottom: 20px; }
                .sv-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0 0 24px; }

                /* ── FORM ELEMENTS ── */
                .sv-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
                .sv-field:last-child { margin-bottom: 0; }
                .sv-label { font-family: ui-monospace, monospace; font-size: 9.5px; font-weight: 500; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.12em; }
                .sv-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; padding: 11px 14px; font-size: 13.5px; color: #f0f2ff; font-family: inherit; outline: none; transition: all 0.18s; box-sizing: border-box; }
                .sv-input::placeholder { color: #4b5563; }
                .sv-input:focus { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.05); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
                .sv-input-hint { font-size: 11px; color: #4b5563; font-weight: 300; }
                .sv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
                @media (max-width: 600px) { .sv-row { grid-template-columns: 1fr; } }

                /* ── BUTTON ── */
                .sv-btn-primary { padding: 10px 22px; background: #6366f1; color: #fff; font-size: 13px; font-weight: 700; border: none; border-radius: 10px; cursor: pointer; transition: all 0.18s; font-family: inherit; }
                .sv-btn-primary:hover { background: #818cf8; transform: translateY(-1px); }
                .sv-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .sv-btn-footer { padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 24px; }

                /* ── TOGGLE ── */
                .sv-toggle-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; margin-bottom: 18px; }
                .sv-toggle-icon { padding: 10px; border-radius: 10px; flex-shrink: 0; }
                .sv-toggle-text { flex: 1; min-width: 0; }
                .sv-toggle-label { font-size: 13px; font-weight: 600; color: #f0f2ff; margin-bottom: 2px; }
                .sv-toggle-desc { font-size: 11px; color: #6b7280; font-weight: 300; }
                .sv-toggle-btn { position: relative; width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: background 0.2s; flex-shrink: 0; }
                .sv-toggle-thumb { position: absolute; top: 3px; width: 16px; height: 16px; background: white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: left 0.2s; }

                /* ── SECURITY TIP ── */
                .sv-tip { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.18); border-radius: 12px; margin-top: 24px; }
                .sv-tip-title { font-size: 12px; font-weight: 700; color: #f87171; margin-bottom: 4px; }
                .sv-tip-body { font-size: 11.5px; color: #6b7280; line-height: 1.6; font-weight: 300; }

                /* ── SIDEBAR ── */
                .sv-sidebar { display: flex; flex-direction: column; gap: 16px; }

                /* Profile card */
                .sv-profile-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; }
                .sv-avatar { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 800; color: white; border: 3px solid rgba(255,255,255,0.1); box-shadow: 0 8px 24px rgba(99,102,241,0.3); margin-bottom: 14px; flex-shrink: 0; }
                .sv-profile-name { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700; color: #f0f2ff; margin-bottom: 6px; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .sv-role-badge { display: inline-block; padding: 3px 10px; border-radius: 5px; font-family: ui-monospace, monospace; font-size: 9px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px; }
                .sv-role-admin { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; }
                .sv-role-user { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #6ee7b7; }
                .sv-profile-email { font-size: 11.5px; color: #6b7280; font-weight: 300; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                /* Status card */
                .sv-status-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
                .sv-status-head { padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
                .sv-status-head-label { font-family: ui-monospace, monospace; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b7280; }

                .sv-status-body { padding: 6px 0; }
                .sv-status-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; }
                .sv-status-row + .sv-status-row { border-top: 1px solid rgba(255,255,255,0.04); }
                .sv-status-key { font-size: 12px; color: #6b7280; font-weight: 300; }
                .sv-status-val { font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
                .sv-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

                /* Spinner */
                .sv-spinner { width: 28px; height: 28px; border: 2px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%; animation: sv-spin 0.7s linear infinite; }
                @keyframes sv-spin { to { transform: rotate(360deg); } }
                .sv-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px 0; }
                .sv-loading-text { font-size: 13px; color: #6b7280; font-weight: 300; }
            `}</style>

            <div className="sv-root">

                {/* ── Header ── */}
                <div className="sv-header">
                    <h1 className="sv-title">Settings</h1>
                    <p className="sv-subtitle">Manage your personal account and organization preferences.</p>
                </div>

                {/* ── Alert ── */}
                {message.text && (
                    <div className={`sv-alert ${message.type === 'success' ? 'sv-alert-success' : 'sv-alert-error'}`}>
                        {message.text}
                    </div>
                )}

                {/* ── Tabs ── */}
                <div className="sv-tabs">
                    {tabs.map(tab => (
                        <button key={tab.id} className={`sv-tab${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id as any)}>
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Content ── */}
                <div className="sv-layout">

                    {/* ── LEFT: Form ── */}
                    <div className="sv-card">
                        <div className="sv-card-body">

                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <form onSubmit={handleProfileSubmit}>
                                    <div className="sv-card-section-title">Personal Information</div>
                                    <div className="sv-card-section-sub">Update your name and email address.</div>
                                    <hr className="sv-divider" />

                                    <div className="sv-row">
                                        <div className="sv-field" style={{ marginBottom: 0 }}>
                                            <label className="sv-label">First Name</label>
                                            <input className="sv-input" type="text" value={profileData.first_name}
                                                onChange={e => setProfileData({ ...profileData, first_name: e.target.value })} required />
                                        </div>
                                        <div className="sv-field" style={{ marginBottom: 0 }}>
                                            <label className="sv-label">Last Name</label>
                                            <input className="sv-input" type="text" value={profileData.last_name}
                                                onChange={e => setProfileData({ ...profileData, last_name: e.target.value })} required />
                                        </div>
                                    </div>

                                    <div className="sv-field">
                                        <label className="sv-label">Email Address</label>
                                        <input className="sv-input" type="email" value={profileData.email}
                                            onChange={e => setProfileData({ ...profileData, email: e.target.value })} required />
                                        <span className="sv-input-hint">Used for secure login and reporting alerts.</span>
                                    </div>

                                    <div className="sv-btn-footer">
                                        <button type="submit" className="sv-btn-primary" disabled={updateProfile.isPending}>
                                            {updateProfile.isPending ? 'Saving...' : 'Update Personal Info'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* ORGANIZATION TAB */}
                            {activeTab === 'organization' && (
                                <form onSubmit={handleOrgSubmit}>
                                    <div className="sv-card-section-title">Organization Details</div>
                                    <div className="sv-card-section-sub">Update your legal entity and compliance information.</div>
                                    <hr className="sv-divider" />

                                    {loadingCompany ? (
                                        <div className="sv-loading">
                                            <div className="sv-spinner" />
                                            <span className="sv-loading-text">Loading entity data…</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="sv-field">
                                                <label className="sv-label">Legal Entity Name</label>
                                                <input className="sv-input" type="text" value={orgData.name}
                                                    onChange={e => setOrgData({ ...orgData, name: e.target.value })} required />
                                            </div>

                                            <div className="sv-row">
                                                <div className="sv-field" style={{ marginBottom: 0 }}>
                                                    <label className="sv-label">Registration No.</label>
                                                    <input className="sv-input" type="text" value={orgData.registration_number}
                                                        onChange={e => setOrgData({ ...orgData, registration_number: e.target.value })} />
                                                </div>
                                                <div className="sv-field" style={{ marginBottom: 0 }}>
                                                    <label className="sv-label">Trade License</label>
                                                    <input className="sv-input" type="text" value={orgData.trade_license_number}
                                                        onChange={e => setOrgData({ ...orgData, trade_license_number: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="sv-row">
                                                <div className="sv-field" style={{ marginBottom: 0 }}>
                                                    <label className="sv-label">Emirate / State</label>
                                                    <select className="sv-input" value={orgData.emirate} onChange={e => setOrgData({ ...orgData, emirate: e.target.value })}>
                                                        <option value="dubai">Dubai</option>
                                                        <option value="abu-dhabi">Abu Dhabi</option>
                                                        <option value="sharjah">Sharjah</option>
                                                        <option value="ajman">Ajman</option>
                                                        <option value="ras-al-khaimah">Ras Al Khaimah</option>
                                                        <option value="fujairah">Fujairah</option>
                                                        <option value="umm-al-quwain">Umm Al Quwain</option>
                                                    </select>
                                                </div>
                                                <div className="sv-field" style={{ marginBottom: 0 }}>
                                                    <label className="sv-label">Industry Sector</label>
                                                    <select className="sv-input" value={orgData.sector} onChange={e => setOrgData({ ...orgData, sector: e.target.value })}>
                                                        <option value="hospitality">Hospitality</option>
                                                        <option value="real-estate">Real Estate & Construction</option>
                                                        <option value="retail">Retail</option>
                                                        <option value="finance">Finance & Insurance</option>
                                                        <option value="healthcare">Healthcare</option>
                                                        <option value="technology">Technology</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Green Key Toggle */}
                                            <div className="sv-toggle-row" style={{ marginTop: 8 }}>
                                                <div className="sv-toggle-icon" style={{ background: orgData.has_green_key ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: orgData.has_green_key ? '#10b981' : '#6b7280' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                                    </svg>
                                                </div>
                                                <div className="sv-toggle-text">
                                                    <div className="sv-toggle-label">Green Key Certification</div>
                                                    <div className="sv-toggle-desc">Unlock specialized environmental data elements.</div>
                                                </div>
                                                <button type="button" className="sv-toggle-btn"
                                                    style={{ background: orgData.has_green_key ? '#10b981' : 'rgba(255,255,255,0.1)' }}
                                                    onClick={() => setOrgData({ ...orgData, has_green_key: !orgData.has_green_key })}>
                                                    <span className="sv-toggle-thumb" style={{ left: orgData.has_green_key ? '21px' : '3px' }} />
                                                </button>
                                            </div>

                                            <div className="sv-btn-footer">
                                                <button type="submit" className="sv-btn-primary" disabled={updateOrg.isPending}>
                                                    {updateOrg.isPending ? 'Saving...' : 'Save Organization Details'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </form>
                            )}

                            {/* SECURITY TAB */}
                            {activeTab === 'security' && (
                                <form onSubmit={handlePwdSubmit}>
                                    <div className="sv-card-section-title">Change Password</div>
                                    <div className="sv-card-section-sub">Keep your account secure with a strong password.</div>
                                    <hr className="sv-divider" />

                                    <div className="sv-field">
                                        <label className="sv-label">New Password</label>
                                        <input className="sv-input" type="password" placeholder="Min. 8 characters"
                                            value={pwdData.new} onChange={e => setPwdData({ ...pwdData, new: e.target.value })} required />
                                    </div>

                                    <div className="sv-field">
                                        <label className="sv-label">Confirm New Password</label>
                                        <input className="sv-input" type="password" placeholder="Re-type your password"
                                            value={pwdData.confirm} onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })} required />
                                    </div>

                                    <div className="sv-btn-footer">
                                        <button type="submit" className="sv-btn-primary" disabled={changePassword.isPending}>
                                            {changePassword.isPending ? 'Updating...' : 'Reset Access Credentials'}
                                        </button>
                                    </div>

                                    <div className="sv-tip">
                                        <div style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="sv-tip-title">Security Tip</div>
                                            <div className="sv-tip-body">Use a unique password with uppercase letters, numbers, and special characters. Never share your ESG Compass credentials.</div>
                                        </div>
                                    </div>
                                </form>
                            )}

                        </div>
                    </div>

                    {/* ── RIGHT: Sidebar ── */}
                    <div className="sv-sidebar">

                        {/* Profile Card */}
                        <div className="sv-profile-card">
                            <div className="sv-avatar">{initials}</div>
                            <div className="sv-profile-name">{user?.first_name} {user?.last_name}</div>
                            <span className={`sv-role-badge ${isAdmin ? 'sv-role-admin' : 'sv-role-user'}`}>
                                {user?.profile?.role || 'User'}
                            </span>
                            <div className="sv-profile-email">{user?.email}</div>
                        </div>

                        {/* Platform Status */}
                        <div className="sv-status-card">
                            <div className="sv-status-head">
                                <span className="sv-status-head-label">Platform Status</span>
                            </div>
                            <div className="sv-status-body">
                                <div className="sv-status-row">
                                    <span className="sv-status-key">Identity Mode</span>
                                    <span className="sv-status-val" style={{ color: '#34d399' }}>
                                        <span className="sv-dot" style={{ background: '#34d399' }} />
                                        Verified
                                    </span>
                                </div>
                                <div className="sv-status-row">
                                    <span className="sv-status-key">Last Session</span>
                                    <span className="sv-status-val" style={{ color: '#f0f2ff' }}>Active Now</span>
                                </div>
                                <div className="sv-status-row">
                                    <span className="sv-status-key">MFA Status</span>
                                    <span className="sv-status-val" style={{ color: '#fb923c' }}>
                                        <span className="sv-dot" style={{ background: '#fb923c' }} />
                                        Disabled
                                    </span>
                                </div>
                                <div className="sv-status-row">
                                    <span className="sv-status-key">Account Type</span>
                                    <span className="sv-status-val" style={{ color: '#a5b4fc' }}>
                                        {isAdmin ? 'Super User' : 'Standard'}
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </AppLayout>
    );
}