import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useSiteStore } from '../../stores/siteStore';

export default function SiteSwitcher() {
    const user = useAuthStore((s) => s.user);
    const rawSites = useSiteStore((s) => s.sites);
    const currentSiteId = useSiteStore((s) => s.currentSiteId);
    const setCurrentSiteId = useSiteStore((s) => s.setCurrentSiteId);
    const queryClient = useQueryClient();

    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const sites = rawSites.filter((s) => s.is_active);

    if (!user?.profile?.company_id) return null;
    if (!sites.length) return null;

    const current = sites.find((s) => s.id === currentSiteId) || sites[0];
    const isPinned = user.profile.site_id != null;

    if (isPinned || sites.length < 2) {
        return (
            <div
                className="nav-user-pill"
                style={{ padding: '6px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
                title={current?.location || ''}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {current?.name || 'No site'}
                </span>
            </div>
        );
    }

    const handleChange = (nextId: number) => {
        if (nextId === currentSiteId) return;
        setCurrentSiteId(nextId);
        queryClient.invalidateQueries();
        setIsOpen(false);
    };

    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            <button
                className="nav-user-pill"
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    padding: '4px 10px 4px 12px', 
                    background: isOpen ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)', 
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'inherit' }}>
                        {current?.name || 'Select site'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </button>

            {isOpen && (
                <div className="nav-dropdown-menu animate-fade-in" style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 200,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    zIndex: 100,
                    padding: '6px'
                }}>
                    {sites.map((s) => (
                        <button 
                            key={s.id} 
                            className="nav-dropdown-item" 
                            onClick={() => handleChange(s.id)}
                            style={{ 
                                justifyContent: 'space-between',
                                background: currentSiteId === s.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                                color: currentSiteId === s.id ? '#818cf8' : 'var(--text-secondary)'
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.name}
                            </span>
                            {currentSiteId === s.id && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
