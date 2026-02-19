import type { ProjectDto, DashboardDto, GraphDto, QueryDto, GraphType } from '../model/types.ts';

const toErrorMessage = (status: number, payload: unknown): string => {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    const details = (payload as { details?: unknown }).details;
    if (typeof details === 'string' && details.trim()) return details;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return `Foresporsel feilet (${status})`;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(toErrorMessage(response.status, payload));
  }

  return payload as T;
}

export async function fetchProjects(): Promise<ProjectDto[]> {
  return requestJson<ProjectDto[]>('/api/backend/projects');
}

export async function createProject(name: string, description?: string): Promise<ProjectDto> {
  return requestJson<ProjectDto>('/api/backend/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      description: description?.trim() || undefined,
    }),
  });
}

export async function fetchDashboards(projectId: number): Promise<DashboardDto[]> {
  return requestJson<DashboardDto[]>(`/api/backend/projects/${projectId}/dashboards`);
}

export async function createDashboard(projectId: number, name: string, description?: string): Promise<DashboardDto> {
  return requestJson<DashboardDto>(`/api/backend/projects/${projectId}/dashboards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      description: description?.trim() || undefined,
    }),
  });
}

export async function fetchGraphs(projectId: number, dashboardId: number): Promise<GraphDto[]> {
  return requestJson<GraphDto[]>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs`);
}

export async function fetchQueries(projectId: number, dashboardId: number, graphId: number): Promise<QueryDto[]> {
  return requestJson<QueryDto[]>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}/queries`);
}

export async function updateGraph(
  projectId: number,
  dashboardId: number,
  graphId: number,
  params: { name: string; graphType: GraphType },
): Promise<GraphDto> {
  return requestJson<GraphDto>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function updateQuery(
  projectId: number,
  dashboardId: number,
  graphId: number,
  queryId: number,
  params: { name: string; sqlText: string },
): Promise<QueryDto> {
  return requestJson<QueryDto>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}/queries/${queryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function deleteGraph(
  projectId: number,
  dashboardId: number,
  graphId: number,
): Promise<void> {
  await requestJson<unknown>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}`, {
    method: 'DELETE',
  });
}
