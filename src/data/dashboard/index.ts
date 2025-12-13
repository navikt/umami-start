import { standardDashboard } from './standard';
import { DashboardConfig } from './types';

export * from './types';

export const dashboards: Record<string, DashboardConfig> = {
    'standard': standardDashboard,
    // Add other dashboards here, e.g.:
    // 'performance': performanceDashboard,
};

export const getDashboard = (id?: string | null): DashboardConfig => {
    if (!id || !dashboards[id]) {
        return dashboards['standard'];
    }
    return dashboards[id];
};
