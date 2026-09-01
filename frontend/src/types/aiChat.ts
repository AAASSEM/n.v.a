export interface ChartPoint {
    label: string;
    value: number | null;
    // Only used by chart_type "metric_grid" — each point can carry its own unit,
    // since a period snapshot mixes incompatible units (kWh, m3, kg, %, ...) that
    // can't share one bar chart's y-axis.
    unit?: string | null;
}

export interface ChartSeries {
    name: string;
    points: ChartPoint[];
}

export interface ChartSpec {
    chart_type: 'line' | 'bar' | 'single_value' | 'comparison_bar' | 'metric_grid';
    title: string;
    unit: string;
    x_label: string;
    y_label: string;
    series: ChartSeries[];
    highlight_label: string | null;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    // Present on assistant messages that produced a chart — lets a past answer's chart
    // be restored to the main dashboard view by clicking it again later.
    chart?: ChartSpec | null;
    sourceQuestion?: string;
    isFallback?: boolean;
}

export interface AIDashboardItem {
    id: number;
    title: string;
    chart: ChartSpec;
    source_question: string | null;
    created_at: string;
}

export interface Period {
    year: number;
    month: number;
}

// Proposed dashboard-view changes from the AI — always a PROPOSAL, never applied
// automatically. Every field is optional; only fields the question actually implied
// should be set (validated again server-side regardless).
export interface ViewDirectives {
    pillar?: 'E' | 'S' | 'G' | null;
    framework?: string | null;
    from_period?: Period | null;
    to_period?: Period | null;
    selected_year?: number | null;
    chart_mode?: 'indexed' | 'actual' | 'logarithmic' | null;
    compare_mode?: boolean | null;
    compare_a?: Period | null;
    compare_b?: Period | null;
    site_id?: number | null;
}

export interface QuotaInfo {
    used: number;
    limit: number;
}
