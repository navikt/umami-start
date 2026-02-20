/**
 * Shared DTO types for the /api/backend REST endpoints
 * (projects, dashboards, graphs, queries).
 */

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
    width?: number;
    ordering?: number;
    updatedAt?: string;
};

export type GraphOrderingEntry = {
    id: number;
    ordering: number;
};

export type QueryDto = {
    id: number;
    graphId: number;
    name: string;
    sqlText: string;
    updatedAt?: string;
};

