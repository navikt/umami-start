import type { SavedChart, GraphType } from '../model/types.ts';

export const parseId = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
};

export const mapGraphTypeToChart = (graphType?: string): SavedChart['type'] => {
    if (graphType === 'LINE') return 'line';
    if (graphType === 'BAR') return 'bar';
    if (graphType === 'PIE') return 'pie';
    if (graphType === 'TABLE') return 'table';
    return 'table';
};

export const normalizeGraphType = (graphType?: string): GraphType => {
    if (graphType === 'LINE' || graphType === 'BAR' || graphType === 'PIE' || graphType === 'TABLE') {
        return graphType;
    }
    return 'TABLE';
};
