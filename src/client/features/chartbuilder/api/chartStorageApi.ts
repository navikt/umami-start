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
  graphType: string;
};

type QueryDto = {
  id: number;
  graphId: number;
  name: string;
  sqlText: string;
};

type SaveChartParams = {
  projectName: string;
  dashboardName: string;
  graphName: string;
  queryName: string;
  graphType: string;
  sqlText: string;
};

type SaveChartResult = {
  project: ProjectDto;
  dashboard: DashboardDto;
  graph: GraphDto;
  query: QueryDto;
};

const COLUMN_TOO_LONG_RE = /too long for the column/i;

const toErrorMessage = (status: number, payload: unknown): string => {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    const details = (payload as { details?: unknown }).details;
    if (typeof details === 'string' && details.trim()) return details;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return `Request failed (${status})`;
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

const findByName = <T extends { name: string }>(items: T[], name: string): T | undefined => {
  const needle = name.trim().toLowerCase();
  return items.find(item => item.name.trim().toLowerCase() === needle);
};

const compactSqlForStorage = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

export async function fetchProjects(): Promise<ProjectDto[]> {
  return requestJson<ProjectDto[]>('/api/backend/projects');
}

export async function fetchDashboards(projectId: number): Promise<DashboardDto[]> {
  return requestJson<DashboardDto[]>(`/api/backend/projects/${projectId}/dashboards`);
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

export async function saveChartToBackend(params: SaveChartParams): Promise<SaveChartResult> {
  const projects = await fetchProjects();
  const existingProject = findByName(projects, params.projectName);

  const project = existingProject ?? await requestJson<ProjectDto>('/api/backend/projects', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      name: params.projectName.trim(),
      description: 'Opprettet fra Grafbyggeren',
    }),
  });

  const dashboards = await fetchDashboards(project.id);
  const existingDashboard = findByName(dashboards, params.dashboardName);

  const dashboard = existingDashboard ?? await requestJson<DashboardDto>(`/api/backend/projects/${project.id}/dashboards`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      name: params.dashboardName.trim(),
      description: 'Opprettet fra Grafbyggeren',
    }),
  });

  const graph = await requestJson<GraphDto>(`/api/backend/projects/${project.id}/dashboards/${dashboard.id}/graphs`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      name: params.graphName.trim(),
      graphType: params.graphType.trim(),
    }),
  });

  const sqlCandidates = Array.from(new Set([
    params.sqlText,
    compactSqlForStorage(params.sqlText),
  ])).filter(Boolean);

  let query: QueryDto | null = null;

  for (const sqlText of sqlCandidates) {
    try {
      query = await requestJson<QueryDto>(`/api/backend/projects/${project.id}/dashboards/${dashboard.id}/graphs/${graph.id}/queries`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: params.queryName.trim(),
          sqlText,
        }),
      });
      break;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to create query');
      if (!COLUMN_TOO_LONG_RE.test(error.message)) {
        throw error;
      }
    }
  }

  if (!query) {
    const originalLen = params.sqlText.length;
    const compactLen = compactSqlForStorage(params.sqlText).length;
    throw new Error(
      `Backend rejected query length (${originalLen} chars; compact ${compactLen}). ` +
      `Please shorten the query or increase backend column size for stored SQL.`,
    );
  }

  return {project, dashboard, graph, query};
}

export type { ProjectDto, DashboardDto, SaveChartParams, SaveChartResult };
