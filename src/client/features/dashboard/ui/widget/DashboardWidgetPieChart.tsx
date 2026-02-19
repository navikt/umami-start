import { PieChart, ResponsiveContainer } from '@fluentui/react-charting';
import type { DashboardRow } from '../../utils/widgetUtils.ts';
import { extractJsonValue } from '../../utils/widgetUtils.ts';

interface DashboardWidgetPieChartProps {
    data: DashboardRow[];
}

const MAX_CATEGORIES = 12;

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

    const slices = data.map((row) => {
        const rawLabel = extractJsonValue((row as Record<string, unknown>)[labelKey]);
        const rawValue = extractJsonValue((row as Record<string, unknown>)[valueKey]);
        return {
            x: String(rawLabel ?? 'Ukjent'),
            y: toNumber(rawValue),
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
        displayData = [...top, { x: 'Andre', y: restSum }];
    }

    return (
        <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer>
                <PieChart data={displayData} chartTitle="" />
            </ResponsiveContainer>
        </div>
    );
};

export default DashboardWidgetPieChart;
