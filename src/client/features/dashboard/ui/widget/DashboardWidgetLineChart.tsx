import type { ILineChartDataPoint } from '@fluentui/react-charting';
import { LineChart, ResponsiveContainer } from '@fluentui/react-charting';
import { format } from 'date-fns';
import type { DashboardRow } from '../../utils/widgetUtils.ts';
import { extractJsonValue } from '../../utils/widgetUtils.ts';

interface DashboardWidgetLineChartProps {
    data: DashboardRow[];
    title: string;
}

const DashboardWidgetLineChart = ({ data, title }: DashboardWidgetLineChartProps) => {
    const points: ILineChartDataPoint[] = data.map((row) => {
        const keys = Object.keys(row);
        const rawX = (row as Record<string, unknown>)[keys[0]];
        const xVal = extractJsonValue(rawX);

        const rawY = (row as Record<string, unknown>)[keys[1]];
        const yVal = typeof rawY === 'number' ? rawY : parseFloat(String(rawY)) || 0;

        return {
            x: new Date(String(xVal)),
            y: yVal,
            legend: format(new Date(String(xVal)), 'dd.MM'),
            xAxisCalloutData: format(new Date(String(xVal)), 'dd.MM'),
            yAxisCalloutData: String(yVal),
        };
    });

    const lines = [{
        legend: title,
        data: points,
        color: '#0067c5',
    }];

    const firstX = points[0]?.x;
    const lastX = points[points.length - 1]?.x;
    const chartKey = `line-${points.length}-${firstX instanceof Date ? firstX.getTime() : firstX || 0}-${lastX instanceof Date ? lastX.getTime() : lastX || 0}`;

    return (
        <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer>
                <LineChart
                    key={chartKey}
                    data={{ lineChartData: lines }}
                    yAxisTickFormat={(d: number) => d.toLocaleString('nb-NO')}
                    margins={{ left: 60, right: 40, top: 20, bottom: 40 }}
                    styles={{
                        xAxis: { text: { fill: 'var(--ax-text-subtle)' } },
                        yAxis: { text: { fill: 'var(--ax-text-subtle)' } },
                    }}
                    legendProps={{
                        styles: {
                            text: { color: 'var(--ax-text-subtle)' },
                        },
                    }}
                />
            </ResponsiveContainer>
        </div>
    );
};

export default DashboardWidgetLineChart;
