import type { ProjectDto, DashboardDto, GraphDto, GraphOrderingEntry, QueryDto } from '../model/types.ts';
import { requestJson } from '../../../shared/lib/apiClient.ts';

// ── Projects ──

export const fetchProjects = (): Promise<ProjectDto[]> =>
    requestJson<ProjectDto[]>('/api/backend/projects');

export const createProject = (name: string, description?: string): Promise<ProjectDto> =>
    requestJson<ProjectDto>('/api/backend/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    });

export const updateProject = (
    projectId: number,
    name: string,
    description?: string,
): Promise<ProjectDto> =>
    requestJson<ProjectDto>(`/api/backend/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    });

export const deleteProject = (projectId: number): Promise<void> =>
    requestJson<void>(`/api/backend/projects/${projectId}`, {
        method: 'DELETE',
    });

// ── Dashboards ──

export const fetchDashboards = (projectId: number): Promise<DashboardDto[]> =>
    requestJson<DashboardDto[]>(`/api/backend/projects/${projectId}/dashboards`);

export const createDashboard = (
    projectId: number,
    name: string,
    description?: string,
): Promise<DashboardDto> =>
    requestJson<DashboardDto>(`/api/backend/projects/${projectId}/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    });

// ── Graphs ──

export const fetchGraphs = (projectId: number, dashboardId: number): Promise<GraphDto[]> =>
    requestJson<GraphDto[]>(
        `/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs`,
    );

export const createGraph = (
    projectId: number,
    dashboardId: number,
    name: string,
    graphType: string,
): Promise<GraphDto> =>
    requestJson<GraphDto>(
        `/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, graphType }),
        },
    );

export const updateGraphOrdering = (
    projectId: number,
    dashboardId: number,
    ordering: GraphOrderingEntry[],
): Promise<void> =>
    requestJson<void>(
        `/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/ordering`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ordering),
        },
    );

// ── Queries ──

export const fetchQueries = (
    projectId: number,
    dashboardId: number,
    graphId: number,
): Promise<QueryDto[]> =>
    requestJson<QueryDto[]>(
        `/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}/queries`,
    );

export const createQuery = (
    projectId: number,
    dashboardId: number,
    graphId: number,
    name: string,
    sqlText: string,
): Promise<QueryDto> =>
    requestJson<QueryDto>(
        `/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}/queries`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, sqlText }),
        },
    );
