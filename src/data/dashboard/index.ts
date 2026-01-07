import { standardDashboard } from './standard';
import { lokalkontorDashboard } from './lokalkontor';
import { DashboardConfig } from './types';

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
    'lokalkontor': ensureIds(lokalkontorDashboard),
    // Add other dashboards here, e.g.:
    // 'performance': performanceDashboard,
};

export const getDashboard = (id?: string | null): DashboardConfig => {
    if (!id || !dashboards[id]) {
        return dashboards['standard'];
    }
    return dashboards[id];
};
