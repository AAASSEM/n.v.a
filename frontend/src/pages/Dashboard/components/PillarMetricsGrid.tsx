import React from 'react';

const BOOLEAN_CODES = new Set([
    'HOSP-S-012', 'HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037',
    'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041', 'HOSP-S-044',
    'HOSP-S-045', 'HOSP-S-046', 'HOSP-S-047', 'HOSP-S-058', 'HOSP-G-059',
    'HOSP-G-070', 'HOSP-G-079', 'HOSP-G-080'
]);

interface ElementCardData {
    code: string;
    name: string;
    value: number | null;
    unit: string;
}

interface Props {
    pillar: 'S' | 'G';
    elements: ElementCardData[];
}

export const PillarMetricsGrid: React.FC<Props> = ({ pillar, elements }) => {
    const color = pillar === 'S' ? '#3b82f6' : '#8b5cf6';
    const colorLight = pillar === 'S' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)';

    // Segregate into Quantitative and Policies
    const policies: ElementCardData[] = [];
    const quantitative: ElementCardData[] = [];

    elements.forEach(el => {
        if (BOOLEAN_CODES.has(el.code) || el.unit.toLowerCase() === 'boolean' || el.unit.toLowerCase() === 'yes/no') {
            policies.push(el);
        } else {
            quantitative.push(el);
        }
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, animation: 'fadeIn 0.5s ease' }}>
            
            {/* ── Quantitative Metrics ───────────────────────────────────── */}
            {quantitative.length > 0 && (
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f2ff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                        Quantitative Metrics
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                        {quantitative.map(el => (
                            <div key={el.code} style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 16, padding: 20,
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                cursor: 'default'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = `0 8px 24px ${color}15`;
                                e.currentTarget.style.border = `1px solid ${color}40`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)';
                            }}>
                                <div style={{ fontSize: 13, color: '#8b90b8', marginBottom: 12, lineHeight: 1.4, minHeight: 36 }}>{el.name}</div>
                                {el.value !== null ? (
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: '#f0f2ff' }}>
                                            {el.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: color }}>
                                            {el.unit}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 14, color: '#475569', fontStyle: 'italic', fontWeight: 600 }}>Pending Data</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Policies & Governance ──────────────────────────────────── */}
            {policies.length > 0 && (
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f2ff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Policies & Disclosures
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                        {policies.map(el => {
                            const isYes = el.value === 1;
                            const isNo = el.value === 0;
                            const isPending = el.value === null;
                            
                            let badgeBg = 'rgba(255,255,255,0.04)';
                            let badgeColor = '#64748b';
                            let icon = <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />;
                            let text = 'Pending';
                            
                            if (isYes) {
                                badgeBg = 'rgba(16,185,129,0.1)';
                                badgeColor = '#10b981';
                                icon = <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
                                text = 'Implemented';
                            } else if (isNo) {
                                badgeBg = 'rgba(244,63,94,0.1)';
                                badgeColor = '#f43f5e';
                                icon = <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>;
                                text = 'Not Implemented';
                            }

                            return (
                                <div key={el.code} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: 12, padding: '12px 16px',
                                    transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                >
                                    <div style={{ fontSize: 13, color: '#f0f2ff', lineHeight: 1.4, flex: 1 }}>{el.name}</div>
                                    <div style={{ 
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: badgeBg, color: badgeColor,
                                        padding: '4px 10px', borderRadius: 100,
                                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                                        whiteSpace: 'nowrap'
                                    }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24">
                                            {icon}
                                        </svg>
                                        {text}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
