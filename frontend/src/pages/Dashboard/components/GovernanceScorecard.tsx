import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface ElementData {
    code: string;
    name: string;
    unit: string;
    value: number | null;
    year: number;
    month: number;
}

interface Props {
    elements: ElementData[];
}

const BOOLEAN_CODES = new Set([
    'HOSP-S-012', 'HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037',
    'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041', 'HOSP-S-044',
    'HOSP-S-045', 'HOSP-S-046', 'HOSP-S-047', 'HOSP-S-058', 'HOSP-G-059',
    'HOSP-G-070', 'HOSP-G-079', 'HOSP-G-080'
]);

const GROUPS = [
    {
        name: 'Policies & Ethics',
        codes: ['HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037', 'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041']
    },
    {
        name: 'Climate & Carbon',
        codes: ['HOSP-G-059', 'HOSP-G-061', 'HOSP-G-070', 'HOSP-G-071']
    },
    {
        name: 'Operations',
        codes: ['HOSP-G-060', 'HOSP-G-065', 'HOSP-G-079', 'HOSP-G-080']
    },
    {
        name: 'Sustainable Purchasing',
        codes: ['HOSP-G-078']
    }
];

export const GovernanceScorecard: React.FC<Props> = ({ elements }) => {
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const elementsByCode = new Map(elements.map(e => [e.code, e]));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{ background: '#1c1e30', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    <div style={{ color: '#f0f2ff', fontSize: 12, fontWeight: 700 }}>{data.name}</div>
                    <div style={{ color: '#8b90b8', fontSize: 11, marginTop: 4 }}>
                        Value: <span style={{ color: data.fill, fontWeight: 600 }}>{data.rawValue !== null ? data.rawValue : 'N/A'} {data.unit}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Top Ring
    const renderCompletionRing = () => {
        const booleanElements = elements.filter(e => BOOLEAN_CODES.has(e.code) || e.unit === 'boolean');
        if (booleanElements.length === 0) return null;

        const totalBool = booleanElements.length;
        const completeBool = booleanElements.filter(e => e.value === 1).length;
        const pct = totalBool > 0 ? Math.round((completeBool / totalBool) * 100) : 0;
        
        const circumference = 2 * Math.PI * 36;
        const offset = circumference - (pct / 100) * circumference;

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 16, padding: '18px 24px' }}>
                <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
                    <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle cx="44" cy="44" r="36" fill="none" stroke="#f59e0b" strokeWidth="8"
                        strokeDasharray={circumference} strokeDashoffset={mounted ? offset : circumference}
                        strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px', transition: 'stroke-dashoffset 1s ease' }}
                    />
                    <text x="44" y="50" textAnchor="middle" fill="#f59e0b" fontSize="18" fontWeight="800">{pct}%</text>
                </svg>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f0f2ff' }}>Governance Policies in Place</div>
                    <div style={{ fontSize: 13, color: '#8b90b8', marginTop: 4 }}>You have implemented {completeBool} out of {totalBool} tracked policies.</div>
                </div>
            </div>
        );
    };

    const renderGroup = (group: typeof GROUPS[0]) => {
        const groupElements = group.codes.map(c => elementsByCode.get(c)).filter(Boolean) as ElementData[];
        if (groupElements.length === 0) return null;

        const maxNumericValue = Math.max(
            ...groupElements
                .filter(e => !BOOLEAN_CODES.has(e.code) && e.unit !== 'boolean' && e.value !== null)
                .map(e => e.value as number),
            1
        );

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        const numericElements = groupElements.filter(e => !BOOLEAN_CODES.has(e.code) && e.unit !== 'boolean');
        const booleanElements = groupElements.filter(e => BOOLEAN_CODES.has(e.code) || e.unit === 'boolean');

        const opacities = [1, 0.8, 0.6, 0.4, 0.2];
        const chartData = numericElements.map((el, i) => {
            const pct = el.value !== null ? (el.value / maxNumericValue) * 100 : 0;
            return {
                name: el.name,
                value: Math.max(pct, 2), // min visual size
                rawValue: el.value,
                unit: el.unit,
                fill: `rgba(245, 158, 11, ${opacities[i % opacities.length]})`
            };
        });

        return (
            <div key={group.name} style={{ marginBottom: 24, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#f0f2ff', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
                    {group.name}
                </h4>
                
                <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                    {chartData.length > 0 && (
                        <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart 
                                    cx="50%" cy="50%" 
                                    innerRadius="30%" outerRadius="100%" 
                                    barSize={8} 
                                    data={chartData}
                                    startAngle={90} endAngle={-270}
                                >
                                    <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" cornerRadius={10} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    
                    <div style={{ flex: 1, minWidth: 250, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {numericElements.map((el, i) => {
                            const hasValue = el.value !== null;
                            const fill = `rgba(245, 158, 11, ${opacities[i % opacities.length]})`;
                            const lastUpdated = hasValue && el.month && el.year ? `${monthNames[el.month-1]} ${el.year}` : 'Never';
                            return (
                                <div key={el.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: fill }} />
                                        <div>
                                            <div style={{ fontSize: 13, color: '#f0f2ff' }}>{el.name}</div>
                                            <div style={{ fontSize: 11, color: '#8b90b8', marginTop: 2 }}>Submitted: {lastUpdated}</div>
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                        {!hasValue ? (
                                            <span style={{ fontSize: 13, color: '#8b90b8' }}>No data</span>
                                        ) : (
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2ff' }}>
                                                {el.value?.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: 11, color: '#8b90b8', fontWeight: 500 }}>{el.unit}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {booleanElements.length > 0 && numericElements.length > 0 && (
                            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        )}
                        
                        {booleanElements.map(el => {
                            const hasValue = el.value !== null;
                            const lastUpdated = hasValue && el.month && el.year ? `${monthNames[el.month-1]} ${el.year}` : 'Never';
                            return (
                                <div key={el.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: 13, color: '#f0f2ff' }}>{el.name}</div>
                                        <div style={{ fontSize: 11, color: '#8b90b8', marginTop: 2 }}>Submitted: {lastUpdated}</div>
                                    </div>
                                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                        {!hasValue ? (
                                            <span style={{ fontSize: 13, color: '#8b90b8' }}>No data</span>
                                        ) : el.value === 1 ? (
                                            <span style={{ display: 'inline-block', padding: '2px 8px', background: 'rgba(16,185,129,0.12)', color: '#10b981', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>✓ YES</span>
                                        ) : (
                                            <span style={{ display: 'inline-block', padding: '2px 8px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>✗ NO</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    if (elements.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#8b90b8' }}>
                <p>No Governance data submitted yet.</p>
                <button onClick={() => navigate('/data-entry')} style={{ marginTop: 12, padding: '8px 16px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    Go to Data Entry →
                </button>
            </div>
        );
    }

    return (
        <div>
            {renderCompletionRing()}
            {GROUPS.map(renderGroup)}
        </div>
    );
};
