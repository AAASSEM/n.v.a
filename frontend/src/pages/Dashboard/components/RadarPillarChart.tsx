import React, { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface RadarPillarChartProps {
    pillar: 'S' | 'G';
    elements: Array<{ code: string; name: string; unit: string; value: number | null }>;
}

const BOOLEAN_CODES = new Set([
    'HOSP-S-012', 'HOSP-G-013', 'HOSP-G-014', 'HOSP-G-035', 'HOSP-G-037',
    'HOSP-G-038', 'HOSP-G-039', 'HOSP-G-040', 'HOSP-G-041', 'HOSP-S-044',
    'HOSP-S-045', 'HOSP-S-046', 'HOSP-S-047', 'HOSP-S-058', 'HOSP-G-059',
    'HOSP-G-070', 'HOSP-G-079', 'HOSP-G-080'
]);

const MAX_VALUES: Record<string, number> = {
    'HOSP-S-024': 500,
    'HOSP-S-025': 100,
    'HOSP-S-026': 100,
    'HOSP-S-027': 50,
    'HOSP-S-028': 60,
    'HOSP-S-029': 5,
    'HOSP-S-030': 20,
    'HOSP-S-033': 30,
    'HOSP-S-034': 500000,
    'HOSP-S-076': 2000,
    'HOSP-S-077': 50,
    'HOSP-G-060': 20,
    'HOSP-G-061': 100,
    'HOSP-G-065': 10,
    'HOSP-G-071': 10,
    'HOSP-G-078': 100
};

export const RadarPillarChart: React.FC<RadarPillarChartProps> = ({ pillar, elements }) => {
    
    const chartData = useMemo(() => {
        let genericMax = 100;
        elements.forEach(e => {
            const isBool = BOOLEAN_CODES.has(e.code) || e.unit === 'boolean';
            if (!isBool && e.value !== null && !MAX_VALUES[e.code]) {
                if (e.value > genericMax) genericMax = e.value;
            }
        });

        const data = elements.map(e => {
            let normalized = 0;
            const isBool = BOOLEAN_CODES.has(e.code) || e.unit === 'boolean';
            
            if (e.value !== null) {
                if (isBool) {
                    normalized = e.value === 1 ? 100 : 0;
                } else {
                    const max = MAX_VALUES[e.code] || genericMax;
                    normalized = Math.min(100, (e.value / max) * 100);
                }
            }
            
            return {
                subject: e.name.length > 14 ? e.name.substring(0, 14) + '...' : e.name,
                fullSubject: e.name,
                code: e.code,
                value: normalized,
                rawValue: e.value,
                unit: e.unit,
                hasData: e.value !== null
            };
        });
        
        if (data.length > 10) {
            return data.filter(d => d.hasData);
        }
        return data;
    }, [elements]);

    const color = pillar === 'S' ? '#6366f1' : '#f59e0b';
    const fill = pillar === 'S' ? 'rgba(99,102,241,0.25)' : 'rgba(245,158,11,0.25)';

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{ background: '#1c1e30', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    <div style={{ color: '#f0f2ff', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{data.fullSubject}</div>
                    <div style={{ color: '#8b90b8', fontSize: 12 }}>
                        Raw Value: <span style={{ color: '#f0f2ff', fontWeight: 600 }}>{data.rawValue !== null ? data.rawValue.toLocaleString(undefined, { maximumFractionDigits: 1 }) : 'N/A'} {data.unit !== 'boolean' ? data.unit : ''}</span>
                    </div>
                    <div style={{ color: color, fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                        Score: {Math.round(data.value)}/100
                    </div>
                </div>
            );
        }
        return null;
    };

    if (chartData.length === 0) {
        return <div style={{ textAlign: 'center', padding: '40px', color: '#8b90b8' }}>No data to display in Radar view.</div>;
    }

    return (
        <div style={{ width: '100%', padding: '20px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ height: 400, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#8b90b8', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Score" dataKey="value" stroke={color} fill={fill} fillOpacity={1} strokeWidth={2} dot={{ r: 3, fill: color }} />
                        <RechartsTooltip content={<CustomTooltip />} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            
            <div style={{ marginTop: 24, padding: '0 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 16px' }}>
                {chartData.map(d => (
                    <div key={d.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#8b90b8' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.hasData ? color : 'rgba(255,255,255,0.1)' }} />
                        <span style={{ fontWeight: 600 }}>{d.code}</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.fullSubject}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
