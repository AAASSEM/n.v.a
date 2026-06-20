import React from 'react';
import { useTranslation } from '../../i18n';

type Pillar = 'ALL' | 'E' | 'S' | 'G';

interface PillarFilterProps {
    activePillar: Pillar;
    onChange: (pillar: Pillar) => void;
}

export default function PillarFilter({ activePillar, onChange }: PillarFilterProps) {
    const { t } = useTranslation();
    const pillars: { id: Pillar, label: string, color: string, icon?: React.ReactNode }[] = [
        { id: 'ALL', label: t('checklist.all'), color: 'var(--text-secondary)' },
        { 
            id: 'E', 
            label: t('dash.env'), 
            color: 'var(--color-env)',
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 0 9.5a7 7 0 0 1-8 8.5z" />
                    <path d="M19 2L11 10" />
                </svg>
            )
        },
        { 
            id: 'S', 
            label: t('dash.social'), 
            color: 'var(--color-soc)',
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            )
        },
        { 
            id: 'G', 
            label: t('dash.gov'), 
            color: 'var(--color-gov)',
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            )
        },
    ];

    return (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {pillars.map(p => {
                const isActive = activePillar === p.id;
                return (
                    <button
                        key={p.id}
                        onClick={() => onChange(p.id)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '100px',
                            background: isActive ? 'var(--bg-elevated)' : 'transparent',
                            border: `1px solid ${isActive ? p.color : 'var(--border-subtle)'}`,
                            color: isActive ? p.color : 'var(--text-primary)',
                            fontSize: '13px',
                            fontWeight: isActive ? 600 : 500,
                            cursor: 'pointer',
                            boxShadow: isActive ? `0 0 12px ${p.color}33` : 'none',
                            transition: 'all var(--transition-fast)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        {p.icon && (
                            <span style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                color: isActive ? p.color : 'var(--text-secondary)' 
                            }}>
                                {p.icon}
                            </span>
                        )}
                        {p.label}
                    </button>
                );
            })}
        </div>
    );
}
