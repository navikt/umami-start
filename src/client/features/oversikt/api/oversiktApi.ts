import type { ProjectDto, DashboardDto, GraphDto, QueryDto } from '../model/types.ts';
import { requestJson } from '../../../shared/lib/apiClient.ts';

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
