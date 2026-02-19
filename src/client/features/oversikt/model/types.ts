import type { SavedChart } from '../../../../data/dashboard/types.ts';

export type ProjectDto = {
    id: number;
    name: string;
    description?: string;
};

export type DashboardDto = {
    id: number;
    projectId: number;
    name: string;
    description?: string;
};

export type GraphDto = {
    id: number;
    dashboardId: number;
    name: string;
    graphType?: string;
};

export type QueryDto = {
    id: number;
    graphId: number;
    name: string;
    sqlText: string;
};

export type GraphWithQueries = {
    graph: GraphDto;
    queries: QueryDto[];
};

export type MetricType = 'visitors' | 'pageviews' | 'proportion' | 'visits';

export type FilterState = {
    urlFilters: string[];
    dateRange: string;
    pathOperator: string;
    metricType: MetricType;
    customStartDate?: Date;
    customEndDate?: Date;
};

export type OversiktSelectOption = {
    label: string;
    value: string;
};

export type { SavedChart };

