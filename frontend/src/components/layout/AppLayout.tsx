import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { canAccessPage } from '../../config/rbac';

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    {
        label: 'Dashboard',
        path: '/dashboard',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
            </svg>
        ),
    },
    {
        label: 'Onboarding',
        path: '/onboarding',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
        ),
    },
    {
        label: 'Checklist',
        path: '/checklist',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
        ),
    },
    {
        label: 'Data Entry',
        path: '/data-entry',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
        ),
    },
    {
        label: 'Meters',
        path: '/meters',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10h18M7 15h1M11 15h1M15 15h1M19 15h1M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
            </svg>
        ),
    },
    {
        label: 'Users',
        path: '/users',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
        ),
    },
    {
        label: 'Reports',
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

    const initials = user
        ? `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase()
        : '?';

    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.email || '';

    const filteredNavItems = NAV_ITEMS.filter(item => canAccessPage(user?.profile?.role, item.path));

    return (
        <div className="app-layout">
            {/* Navbar */}
            {!hideNav && (
                <nav className="nav-container-floating">
                <div className="app-navbar-inner">
                    {/* Logo Section */}
                    <div className="nav-logo-section">
                        <Link className="nav-logo" to="/" style={{ cursor: 'pointer', textDecoration: 'none' }}>
                            <div className="nav-logo-badge">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" opacity="0.4" />
                                    <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
                                    <path d="M12 12L12 21" opacity="0.6" />
                                    <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
                                </svg>
                            </div>
                            <span className="nav-logo-text" style={{ fontSize: 18, letterSpacing: '-0.5px' }}>ESG <span style={{ color: 'var(--accent-green)' }}>Compass</span></span>
                        </Link>
                    </div>

                    {/* Nav Section (Centered Container) */}
                    <div className="nav-main-pill">
                        <div className="nav-links">
                            {filteredNavItems.map(item => (
                                <button
                                    key={item.path}
                                    className={`nav-item-btn ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={() => navigate(item.path)}
                                >
                                    <div className="nav-item-icon">{item.icon}</div>
                                    <span className="nav-item-label">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* User Section */}
                    <div className="nav-user-section">
                        <div className="nav-user-pill">
                            <div className="nav-avatar">
                                {initials}
                            </div>
                            <div className="nav-user-info">
                                <span className="nav-username">{displayName}</span>
                            </div>
                            {canAccessPage(user?.profile?.role, '/settings') && (
                                <button
                                    className="nav-settings-action"
                                    onClick={() => navigate('/settings')}
                                    title="Settings"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                                    </svg>
                                </button>
                            )}
                            {canAccessPage(user?.profile?.role, '/help') && (
                                <button
                                    className="nav-help-action"
                                    onClick={() => navigate('/help')}
                                    title="Help Center"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                                    </svg>
                                </button>
                            )}
                            <button
                                className="nav-logout-action"
                                onClick={logout}
                                title="Sign out"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
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
