import sys
import re

with open('src/pages/Dashboard/components/StatDetailModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings to \n for matching
content = content.replace('\r\n', '\n')

# 1. Add contributing_elements to interface
if 'contributing_elements?:' not in content:
    content = re.sub(
        r'(grid_ef_source\?: string;\s*\n\s*breakdown\?: Array<\{[^\}]+\}>;\s*\n\s*)(\w+\?: string;\s*\n\s*\}\s*)',
        r'\g<1>contributing_elements?: Array<{ code: string; name: string; value: number; unit: string; }>;\n    \g<2>',
        content
    )

# 2. Add ElementBreakdownPanel
panel_code = """
function ElementBreakdownPanel({ 
    elements, 
    color, 
    primaryUnit 
}: { 
    elements: Array<{code: string; name: string; value: number; unit: string}>;
    color: string;
    primaryUnit: string;
}) {
    if (!elements || elements.length === 0) return null;

    const isPrimaryUnit = (u: string) => {
        const ul = (u || '').toLowerCase().trim();
        if (ul === 'boolean' || ul === 'count' || ul === 'l/min' || ul === 'text') return false;
        if (ul === '%' && !primaryUnit.includes('%')) return false;
        return true;
    };

    const primaryElements = elements.filter(e => isPrimaryUnit(e.unit));
    const secondaryElements = elements.filter(e => !isPrimaryUnit(e.unit));

    const totalPrimary = primaryElements.reduce((sum, e) => sum + e.value, 0);

    return (
        <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f0f2ff', marginBottom: 16 }}>Element Breakdown</h4>
            
            {primaryElements.length > 0 && (
                <div style={{ marginBottom: secondaryElements.length > 0 ? 24 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b90b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                        Primary Contributors ({primaryUnit})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {primaryElements.map((item, i) => {
                            const pct = totalPrimary > 0 ? (item.value / totalPrimary) * 100 : 0;
                            const opacities = [1, 0.8, 0.6, 0.4, 0.3, 0.2];
                            
                            return (
                                <div key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 160, fontSize: 13, color: '#f0f2ff' }}>
                                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ fontSize: 10, color: '#8b90b8', fontFamily: 'monospace' }}>{item.code}</div>
                                    </div>
                                    <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{ 
                                            height: '100%', 
                                            background: color, 
                                            opacity: opacities[i % opacities.length],
                                            width: `${pct}%`,
                                            transition: 'width 0.8s ease'
                                        }} />
                                    </div>
                                    <div style={{ width: 50, fontSize: 13, fontWeight: 600, color: '#f0f2ff', textAlign: 'right' }}>
                                        {Math.round(pct)}%
                                    </div>
                                    <div style={{ width: 100, fontSize: 13, fontWeight: 600, color: '#8b90b8', textAlign: 'right' }}>
                                        {item.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ 
                        marginTop: 16, paddingTop: 16, 
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#f0f2ff' }}>Total Included</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: color }}>
                            {totalPrimary.toLocaleString(undefined, { maximumFractionDigits: 1 })} {primaryUnit}
                        </span>
                    </div>
                </div>
            )}

            {secondaryElements.length > 0 && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b90b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                        Supplementary Metrics (Excluded from total)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {secondaryElements.map(item => (
                            <div key={item.code} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px' }}>
                                <div style={{ fontSize: 10, color: '#8b90b8', fontFamily: 'monospace', marginBottom: 2 }}>{item.code}</div>
                                <div style={{ fontSize: 13, color: '#f0f2ff', fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                                <div style={{ fontSize: 15, color: color, fontWeight: 800 }}>
                                    {item.unit.toLowerCase() === 'boolean' 
                                        ? (item.value > 0 ? 'Yes' : 'No') 
                                        : `${item.value.toLocaleString()} ${item.unit}`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StatDetailModal"""

if 'function ElementBreakdownPanel' not in content:
    content = content.replace("export default function StatDetailModal", panel_code)

# 3. Add renderElementBreakdownSection
section_func = """    const renderElementBreakdownSection = () => {
        if (stat.scope) return null; // GHG has its own breakdown
        if (!stat.contributing_elements || stat.contributing_elements.length === 0) return null;
        return <ElementBreakdownPanel elements={stat.contributing_elements} color={color} primaryUnit={unit.trim()} />;
    };

    const renderWaterBenchmark = () => {"""

if 'renderElementBreakdownSection = () =>' not in content:
    content = content.replace("    const renderWaterBenchmark = () => {", section_func)

# 4. Call renderElementBreakdownSection
call_patch = """                    )}
                    {renderElementBreakdownSection()}
                    {renderFuelBreakdown()}"""

if '{renderElementBreakdownSection()}' not in content:
    content = re.sub(r'                    \)\}\n\s*\{renderFuelBreakdown\(\)\}', call_patch, content)


with open('src/pages/Dashboard/components/StatDetailModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied properly")
