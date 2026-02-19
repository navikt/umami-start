type ProjectDto = {
  id: number;
  name: string;
  description?: string;
};

type DashboardDto = {
  id: number;
  projectId: number;
  name: string;
  description?: string;
};

type GraphDto = {
  id: number;
  dashboardId: number;
  name: string;
  graphType?: string;
};

type QueryDto = {
  id: number;
  graphId: number;
  name: string;
  sqlText: string;
};

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

export async function fetchDashboards(projectId: number): Promise<DashboardDto[]> {
  return requestJson<DashboardDto[]>(`/api/backend/projects/${projectId}/dashboards`);
}

export async function fetchGraphs(projectId: number, dashboardId: number): Promise<GraphDto[]> {
  return requestJson<GraphDto[]>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs`);
}

export async function fetchQueries(projectId: number, dashboardId: number, graphId: number): Promise<QueryDto[]> {
  return requestJson<QueryDto[]>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}/queries`);
}

export type { ProjectDto, DashboardDto, GraphDto, QueryDto };
