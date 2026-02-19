export type ProjectDto = {
    id: number;
    name: string;
    description?: string;
    updatedAt?: string;
};

export type DashboardDto = {
    id: number;
    projectId: number;
    name: string;
    description?: string;
    updatedAt?: string;
};

export type GraphDto = {
    id: number;
    dashboardId: number;
    name: string;
    graphType?: string;
    updatedAt?: string;
};

export type QueryDto = {
    id: number;
    graphId: number;
    name: string;
    sqlText: string;
    updatedAt?: string;
};

