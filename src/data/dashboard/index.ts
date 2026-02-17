import { standardDashboard } from './standard';
import { fylkeskontorDashboard } from './fylkeskontor';
import { hjelpemiddelsentralDashboard } from './hjelpemiddelsentral';
import type { DashboardConfig } from './types';

export * from './types';

const ensureIds = (config: DashboardConfig): DashboardConfig => ({
    ...config,
    charts: config.charts.map((chart, index) => ({
        ...chart,
        id: chart.id || `auto-id-${index}-${chart.type}`
    }))
});

export const dashboards: Record<string, DashboardConfig> = {
    'standard': ensureIds(standardDashboard),
    'fylkeskontor': ensureIds(fylkeskontorDashboard),
    'hjelpemiddelsentral': ensureIds(hjelpemiddelsentralDashboard),
};

export const getDashboard = (id?: string | null): DashboardConfig => {
    if (!id || !dashboards[id]) {
        return dashboards['standard'];
    }
    return dashboards[id];
};
