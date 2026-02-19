import type { SavedChart } from '../../../../data/dashboard';
import type { GraphDto, QueryDto } from '../../../shared/types/backend';

export type { ProjectDto, DashboardDto, GraphDto, QueryDto } from '../../../shared/types/backend';

export type GraphWithQueries = {
    graph: GraphDto;
    queries: QueryDto[];
};

export type GraphType = 'LINE' | 'BAR' | 'PIE' | 'TABLE';

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

export type OversiktChart = SavedChart & {
    graphId: number;
    graphType: GraphType;
    queryId: number;
    queryName: string;
};

export type { SavedChart };
