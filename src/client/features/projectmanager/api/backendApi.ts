import type { ProjectDto, DashboardDto, GraphDto, QueryDto } from '../model/types.ts';

export const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init);
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
        const errorMessage =
            payload && typeof payload === 'object' && 'error' in payload
                ? String((payload as { error?: string }).error)
                : `Foresporsel feilet (${response.status})`;
        throw new Error(errorMessage);
    }

    return payload as T;
};

// ── Projects ──

export const fetchProjects = (): Promise<ProjectDto[]> =>
    requestJson<ProjectDto[]>('/api/backend/projects');

export const createProject = (name: string, description?: string): Promise<ProjectDto> =>
    requestJson<ProjectDto>('/api/backend/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
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

