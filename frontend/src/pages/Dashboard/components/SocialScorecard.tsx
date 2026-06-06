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
    history?: { code: string; value: number | null; year: number; month: number }[];
}

const BOOLEAN_CODES = new Set([
    'HOSP-S-012', 'HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037',
    'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041', 'HOSP-S-044',
    'HOSP-S-045', 'HOSP-S-046', 'HOSP-S-047', 'HOSP-S-058', 'HOSP-G-059',
    'HOSP-G-070', 'HOSP-G-079', 'HOSP-G-080'
]);

const GROUPS = [
    {
        name: 'Workforce',
        codes: ['HOSP-S-024', 'HOSP-S-025', 'HOSP-S-026', 'HOSP-S-027', 'HOSP-S-033']
    },
    {
        name: 'Training & Development',
        codes: ['HOSP-S-028', 'HOSP-S-076', 'HOSP-S-044', 'HOSP-S-045']
    },
    {
        name: 'Health & Safety',
        codes: ['HOSP-S-029', 'HOSP-S-030']
    },
    {
        name: 'Community',
        codes: ['HOSP-S-034', 'HOSP-S-058', 'HOSP-S-077', 'HOSP-S-046', 'HOSP-S-047']
    },
    {
        name: 'Guest Experience',
        codes: ['HOSP-S-012']
    }
];

export const SocialScorecard: React.FC<Props> = ({ elements, history = [] }) => {
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

    const renderGroup = (group: typeof GROUPS[0]) => {
        const groupElements = group.codes.map(c => elementsByCode.get(c)).filter(Boolean) as ElementData[];
        if (groupElements.length === 0) return null;

        const maxNumericValue = Math.max(
            ...groupElements
                .filter(e => !BOOLEAN_CODES.has(e.code) && e.unit !== 'boolean' && e.value !== null)
                .map(e => e.value as number),
            1 // Avoid division by zero
        );

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
                fill: `rgba(99, 102, 241, ${opacities[i % opacities.length]})`
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
                            const fill = `rgba(99, 102, 241, ${opacities[i % opacities.length]})`;
                            return (
                                <div key={el.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: fill }} />
                                        <div style={{ fontSize: 13, color: '#f0f2ff' }}>{el.name}</div>
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
                            return (
                                <div key={el.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontSize: 13, color: '#f0f2ff' }}>{el.name}</div>
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

    // Mini Heat Map
    const renderHeatMap = () => {
        if (elements.length === 0) return null;
        
        // Find latest year/month
        let latestY = 0;
        let latestM = 0;
        const sourceData = history.length > 0 ? history : elements;
        sourceData.forEach(e => {
            if (e.year > latestY || (e.year === latestY && e.month > latestM)) {
                latestY = e.year;
                latestM = e.month;
            }
        });

        if (latestY === 0) return null;

        // Generate last 12 months array
        const last12Months = [];
        let curY = latestY;
        let curM = latestM;
        for (let i = 0; i < 12; i++) {
            last12Months.unshift({ year: curY, month: curM });
            curM--;
            if (curM === 0) {
                curM = 12;
                curY--;
            }
        }

        const maxValues = new Map();
        elements.forEach(e => {
            if (!BOOLEAN_CODES.has(e.code) && e.unit !== 'boolean' && e.value !== null) {
                maxValues.set(e.code, Math.max(maxValues.get(e.code) || 1, e.value));
            }
        });

        const hasAnyData = elements.some(e => e.value !== null);
        if (!hasAnyData) return null;

        return (
            <div style={{ marginTop: 32, padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff', marginBottom: 4 }}>Monthly Reporting Activity</h4>
                <div style={{ fontSize: 12, color: '#8b90b8', marginBottom: 20 }}>Intensity = relative value. Blank = no data submitted.</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {elements.filter(e => e.value !== null).slice(0, 12).map(el => {
                        const shortName = el.name.length > 18 ? el.name.substring(0, 15) + '...' : el.name;
                        const isBoolean = BOOLEAN_CODES.has(el.code) || el.unit === 'boolean';
                        
                        return (
                            <div key={el.code} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 140, fontSize: 11, color: '#8b90b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={el.name}>
                                    {shortName}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {last12Months.map((ym, idx) => {
                                        // Match historical mapping using history array or fallback to element
                                        let hasDataForCell = false;
                                        let cellValue: number | null = null;
                                        
                                        if (history.length > 0) {
                                            const histEntry = history.find(h => h.code === el.code && h.year === ym.year && h.month === ym.month);
                                            hasDataForCell = histEntry !== undefined && histEntry.value !== null;
                                            if (hasDataForCell) cellValue = histEntry!.value;
                                        } else {
                                            hasDataForCell = el.year === ym.year && el.month === ym.month && el.value !== null;
                                            if (hasDataForCell) cellValue = el.value;
                                        }
                                        
                                        let opacity = 0.04; // Empty
                                        let bg = 'rgba(255,255,255,';
                                        
                                        if (hasDataForCell) {
                                            if (isBoolean) {
                                                opacity = cellValue === 1 ? 0.9 : 0.3;
                                            } else {
                                                const max = maxValues.get(el.code) || 1;
                                                opacity = Math.max(0.1, Math.min(0.9, (cellValue! / max)));
                                            }
                                            bg = 'rgba(99, 102, 241,';
                                        }

                                        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                        const tooltip = hasDataForCell ? `${el.name} (${monthNames[ym.month-1]} ${ym.year}): ${cellValue} ${el.unit !== 'boolean' ? el.unit : ''}` : 'No data';

                                        return (
                                            <div 
                                                key={idx} 
                                                title={tooltip}
                                                style={{ 
                                                    width: 16, height: 16, borderRadius: 2, 
                                                    background: `${bg}${opacity})`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }} 
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (elements.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#8b90b8' }}>
                <p>No Social data submitted yet.</p>
                <button onClick={() => navigate('/data-entry')} style={{ marginTop: 12, padding: '8px 16px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    Go to Data Entry →
                </button>
            </div>
        );
    }

    return (
        <div>
            {GROUPS.map(renderGroup)}
            {renderHeatMap()}
        </div>
    );
};
