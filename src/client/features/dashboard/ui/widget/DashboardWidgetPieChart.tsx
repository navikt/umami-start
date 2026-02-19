import { PieChart, ResponsiveContainer } from '@fluentui/react-charting';
import type { DashboardRow } from '../../utils/widgetUtils.ts';
import { extractJsonValue } from '../../utils/widgetUtils.ts';

interface DashboardWidgetPieChartProps {
    data: DashboardRow[];
}

const MAX_CATEGORIES = 12;
const PIE_COLORS = [
    '#4F6DDC',
    '#D8008F',
    '#2D9DA3',
    '#8A6FC2',
    '#B35E00',
    '#00907C',
    '#6B7280',
    '#B13F6B',
];
const LEGEND_SHAPES = ['rounded-none', 'rounded-full', '[clip-path:polygon(50%_0%,0%_100%,100%_100%)]', 'rotate-45 rounded-none'];

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

const DashboardWidgetPieChart = ({ data }: DashboardWidgetPieChartProps) => {
    const keys = Object.keys(data[0] ?? {});
    if (keys.length < 2) {
        return <div className="text-[var(--ax-text-subtle)]">Trenger minst to kolonner (kategori og verdi)</div>;
    }

    const labelKey = keys[0];
    const valueKey = keys[1];

    const slices = data.map((row, index) => {
        const rawLabel = extractJsonValue((row as Record<string, unknown>)[labelKey]);
        const rawValue = extractJsonValue((row as Record<string, unknown>)[valueKey]);
        return {
            x: String(rawLabel ?? 'Ukjent'),
            y: toNumber(rawValue),
            color: PIE_COLORS[index % PIE_COLORS.length],
        };
    });

    if (slices.every((slice) => slice.y === 0)) {
        return <div className="text-[var(--ax-text-subtle)]">Kunne ikke lage sektordiagram fra dataene</div>;
    }

    let displayData = slices;
    if (slices.length > MAX_CATEGORIES) {
        const top = slices.slice(0, MAX_CATEGORIES - 1);
        const rest = slices.slice(MAX_CATEGORIES - 1);
        const restSum = rest.reduce((sum, slice) => sum + slice.y, 0);
        displayData = [...top, { x: 'Andre', y: restSum, color: '#6B7280' }];
    }

    const total = displayData.reduce((sum, item) => sum + item.y, 0);

    return (
        <div className="w-full md:grid md:h-[350px] md:grid-cols-[minmax(0,1fr)_240px] md:gap-4">
            <style>{`
                .dashboard-pie-chart text[class*="pieLabel"],
                .dashboard-pie-chart g[class*="arc"] text {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `}</style>
            <div className="dashboard-pie-chart" style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                    <PieChart data={displayData} chartTitle="" />
                </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-1 md:mt-0 md:max-h-[350px] md:overflow-auto" role="list" aria-label="Sektordiagram forklaring">
                {displayData.map((item, index) => {
                    const pct = total > 0 ? ((item.y / total) * 100).toFixed(1) : '0.0';
                    return (
                        <div key={item.x} role="listitem" className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm text-[var(--ax-text-default)]">
                            <span className="flex min-w-0 items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className={`h-3 w-3 shrink-0 border border-[var(--ax-border-neutral-subtle)] ${LEGEND_SHAPES[index % LEGEND_SHAPES.length]}`}
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-xs text-[var(--ax-text-subtle)]">{index + 1}.</span>
                                <span className="break-words">{item.x}</span>
                            </span>
                            <span className="whitespace-nowrap text-[var(--ax-text-subtle)]">{pct}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DashboardWidgetPieChart;
