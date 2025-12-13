export interface SavedChart {
    id: string;
    title: string;
    type: 'line' | 'bar' | 'pie' | 'table' | 'title';
    sql?: string;
    width?: 'full' | 'half' | '100' | '75' | '50' | '25';
    description?: string;
    config?: any; // ChartConfig | null
    filters?: any[]; // Filter[]
    isStandardWidget?: boolean;
}

export interface DashboardConfig {
    title: string;
    description?: string;
    charts: SavedChart[];
}
