import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import type { ChartSpec } from '../types/aiChat';

// Matches the tooltip styling already used across Dashboard.tsx, so AI-generated
// charts look native rather than bolted on.
const CustomTooltipStyle = {
    contentStyle: { backgroundColor: '#1c1e30', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', color: '#f0f2ff', fontSize: 13 },
    itemStyle: { color: '#f0f2ff' },
    labelStyle: { color: '#8b90b8', fontWeight: 600 },
    cursor: { fill: 'rgba(255,255,255,0.04)' },
};

const BAR_COLOR = '#6366f1';
const HIGHLIGHT_COLOR = '#22c55e';

const FULL_MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// The model sometimes writes full month names into chart labels ("January") instead
// of abbreviating them — normalize at render time rather than depending on prompt
// compliance. Only touches labels that are exactly a full month name, so comparison
// labels like "August 2026" are left alone.
function formatAxisLabel(label: string): string {
    const idx = FULL_MONTH_NAMES.findIndex((m) => m.toLowerCase() === label.trim().toLowerCase());
    return idx === -1 ? label : label.trim().slice(0, 3);
}

interface DynamicChartProps {
    chart: ChartSpec;
    height?: number;
}

export default function DynamicChart({ chart, height = 260 }: DynamicChartProps) {
    if (chart.chart_type === 'single_value') {
        const point = chart.series[0]?.points[0];
        return (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#8b90b8', marginBottom: 6 }}>{chart.title}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#f0f2ff' }}>
                    {point?.value != null ? point.value.toLocaleString() : '—'}
                    <span style={{ fontSize: 14, color: '#8b90b8', marginLeft: 6 }}>{chart.unit}</span>
                </div>
                {point?.label && <div style={{ fontSize: 12, color: '#8b90b8', marginTop: 4 }}>{point.label}</div>}
            </div>
        );
    }

    if (chart.chart_type === 'metric_grid') {
        const points = chart.series[0]?.points || [];
        return (
            <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2ff', marginBottom: 12 }}>{chart.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                    {points.map((p, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 12, padding: '12px 14px',
                        }}>
                            <div style={{ fontSize: 11, color: '#8b90b8', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f2ff' }}>
                                {p.value != null ? p.value.toLocaleString() : '—'}
                                {p.unit && <span style={{ fontSize: 11, fontWeight: 600, color: '#8b90b8', marginLeft: 4 }}>{p.unit}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // "bar", "comparison_bar" and (for now) "line" all render from the same flattened
    // point list — a single series is the common case for the current fake-brain
    // questions; multi-series comparison rendering can extend this once needed.
    const series = chart.series[0];
    const data = (series?.points || []).map((p) => ({ label: p.label, value: p.value }));

    return (
        <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2ff', marginBottom: 4 }}>{chart.title}</div>
            <div style={{ width: '100%', height }}>
                <ResponsiveContainer width="100%" height="100%">
                    {chart.chart_type === 'line' ? (
                        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="label" stroke="#8b90b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatAxisLabel} />
                            <YAxis stroke="#8b90b8" fontSize={12} tickLine={false} axisLine={false} unit={` ${chart.unit}`} />
                            <Tooltip {...CustomTooltipStyle} />
                            <Line
                                type="monotone" dataKey="value" stroke={BAR_COLOR} strokeWidth={2}
                                dot={(props: any) => {
                                    const isHighlight = props.payload?.label === chart.highlight_label;
                                    return (
                                        <circle
                                            key={props.key ?? props.index}
                                            cx={props.cx} cy={props.cy}
                                            r={isHighlight ? 5 : 3}
                                            fill={isHighlight ? HIGHLIGHT_COLOR : BAR_COLOR}
                                            stroke="none"
                                        />
                                    );
                                }}
                            />
                        </LineChart>
                    ) : (
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barSize={20}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="label" stroke="#8b90b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatAxisLabel} />
                            <YAxis stroke="#8b90b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip {...CustomTooltipStyle} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {data.map((d, i) => (
                                    <Cell key={i} fill={d.label === chart.highlight_label ? HIGHLIGHT_COLOR : BAR_COLOR} />
                                ))}
                            </Bar>
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
