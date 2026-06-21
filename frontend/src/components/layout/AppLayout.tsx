import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { canAccessPage } from '../../config/rbac';
import { useTranslation } from '../../i18n';
import SiteSwitcher from './SiteSwitcher';

interface NavItem {
    labelKey: string;
    path: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    {
        labelKey: 'nav.dashboard',
        path: '/dashboard',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
            </svg>
        ),
    },
    {
        labelKey: 'nav.sites',
        path: '/sites',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
            </svg>
        ),
    },

    {
        labelKey: 'nav.onboarding',
        path: '/onboarding',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
        ),
    },
    {
        labelKey: 'nav.checklist',
        path: '/checklist',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
        ),
    },
    {
        labelKey: 'nav.meters',
        path: '/meters',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10h18M7 15h1M11 15h1M15 15h1M19 15h1M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
            </svg>
        ),
    },
    {
        labelKey: 'nav.dataEntry',
        path: '/data-entry',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
        ),
    },
    {
        labelKey: 'nav.users',
        path: '/users',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
        ),
    },
    {
        labelKey: 'nav.reports',
        path: '/reports',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
        ),
    },
];

export default function AppLayout({ children, hideNav = false }: { children: React.ReactNode, hideNav?: boolean }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { t, lang, setLang } = useTranslation();
    const isRtl = lang === 'ar';
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const initials = user
        ? `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase()
        : '?';

    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.email || '';

    const filteredNavItems = NAV_ITEMS.filter(item => canAccessPage(user?.profile?.role, item.path));

    // Trial countdown
    const trialDaysLeft = (() => {
        if (!user?.trial_expires_at) return null;
        const diff = new Date(user.trial_expires_at).getTime() - Date.now();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    })();
    const showTrialBanner = trialDaysLeft !== null && trialDaysLeft >= 0 && trialDaysLeft <= 30;
    const trialUrgent = trialDaysLeft !== null && trialDaysLeft <= 7;

    return (
        <div className="app-layout">
            {/* Trial Countdown Banner */}
            {showTrialBanner && (
                <div style={{
                    background: trialUrgent
                        ? 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))'
                        : 'linear-gradient(90deg, rgba(251,191,36,0.12), rgba(251,191,36,0.06))',
                    borderBottom: `1px solid ${trialUrgent ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.2)'}`,
                    padding: '8px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    fontSize: 13, color: trialUrgent ? '#fca5a5' : '#fde68a',
                    fontWeight: 600,
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {trialDaysLeft === 0
                        ? 'Your free trial expires today!'
                        : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} remaining in your free trial.`}
                    <a href="mailto:support@esgravity.com?subject=Trial%20Upgrade%20Request"
                        style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 700, opacity: 0.9 }}>
                        Upgrade now →
                    </a>
                </div>
            )}
            {/* Navbar */}
            {!hideNav && (
                <nav className="nav-container-floating">
                <div className="app-navbar-inner" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                    {/* Logo Section */}
                    <div className="nav-logo-section">
                        <Link className="nav-logo" to="/" style={{ cursor: 'pointer', textDecoration: 'none', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                            <div className="nav-logo-badge">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                                    <path d="M12 2C6.5 2 2 6.5 2 12c0 3 1.3 5.7 3.5 7.5" opacity="0.6" />
                                    <path d="M12 6a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6 2.3 0 4.3-1.3 5.3-3.3" />
                                    <circle cx="12" cy="12" r="2.5" fill="white" stroke="none" />
                                    <path d="M18.5 11c0-2-1.5-3.5-3.5-3.5S11.5 9 11.5 11s1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5Z" fill="white" stroke="none" />
                                </svg>
                            </div>
                            <span className="nav-logo-text" style={{ fontSize: 18, letterSpacing: '-0.5px' }}>{t('nav.logoText')}</span>
                        </Link>
                    </div>

                    {/* Nav Section (Centered Container) */}
                    <div className="nav-main-pill">
                        <div className="nav-links" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                            {filteredNavItems.map(item => (
                                <button
                                    key={item.path}
                                    className={`nav-item-btn ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={() => navigate(item.path)}
                                >
                                    <div className="nav-item-icon">{item.icon}</div>
                                    <span className="nav-item-label">{t(item.labelKey)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* User Section */}
                    <div className="nav-user-section" style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                        <SiteSwitcher />
                        <div className="nav-user-pill" style={{ flexDirection: isRtl ? 'row-reverse' : 'row', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="nav-avatar">
                                {initials}
                            </div>
                            <div className="nav-user-info">
                                <span className="nav-username">{displayName}</span>
                            </div>
                            <div className="nav-user-menu-container" ref={menuRef} style={{ position: 'relative' }}>
                                <button
                                    className="nav-settings-action"
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    title="Menu"
                                    style={{ background: isMenuOpen ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: isMenuOpen ? 'var(--accent-green)' : 'currentColor' }}
                                    >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                                    </svg>
                                </button>

                                {isMenuOpen && (
                                    <div className="nav-dropdown-menu animate-fade-in" style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 8px)',
                                        right: isRtl ? 'auto' : 0,
                                        left: isRtl ? 0 : 'auto',
                                        width: 180,
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-md)',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                        zIndex: 100,
                                        padding: '6px'
                                    }}>
                                        {canAccessPage(user?.profile?.role, '/settings') && (
                                            <button className="nav-dropdown-item" onClick={() => { setIsMenuOpen(false); navigate('/settings'); }}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                                                {t('nav.settings')}
                                            </button>
                                        )}
                                        {canAccessPage(user?.profile?.role, '/help') && (
                                            <button className="nav-dropdown-item" onClick={() => { setIsMenuOpen(false); navigate('/help'); }}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                {t('nav.helpCenter')}
                                            </button>
                                        )}
                                        <button className="nav-dropdown-item" onClick={() => { setIsMenuOpen(false); setLang(lang === 'en' ? 'ar' : 'en'); }}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"/>
                                                <line x1="2" y1="12" x2="22" y2="12"/>
                                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                            </svg>
                                            {lang === 'en' ? 'العربية (AR)' : 'English (EN)'}
                                        </button>
                                        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
                                        <button className="nav-dropdown-item logout" onClick={logout}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                            {t('nav.signOut')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
            )}

            {/* Page Content */}
            <main className="app-main">
                {children}
            </main>
        </div>
    );
}
