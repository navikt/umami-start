import { useEffect, useMemo, useState } from 'react';
import { Alert, BodyLong, Button, Heading, Page, Select, Textarea, TextField } from '@navikt/ds-react';

type ProjectDto = { id: number; name: string; description?: string; updatedAt?: string };
type DashboardDto = { id: number; projectId: number; name: string; description?: string; updatedAt?: string };
type GraphDto = { id: number; dashboardId: number; name: string; graphType?: string; updatedAt?: string };
type QueryDto = { id: number; graphId: number; name: string; sqlText: string; updatedAt?: string };

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) as unknown : null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: string }).error)
        : `Request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  return payload as T;
};

const BackendCrudTest = () => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [dashboards, setDashboards] = useState<DashboardDto[]>([]);
  const [graphs, setGraphs] = useState<GraphDto[]>([]);
  const [queries, setQueries] = useState<QueryDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);
  const [selectedGraphId, setSelectedGraphId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [graphName, setGraphName] = useState('');
  const [graphType, setGraphType] = useState('LINE');
  const [queryName, setQueryName] = useState('');
  const [querySql, setQuerySql] = useState("SELECT 1 AS value");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedDashboard = useMemo(
    () => dashboards.find((d) => d.id === selectedDashboardId) ?? null,
    [dashboards, selectedDashboardId],
  );
  const selectedGraph = useMemo(
    () => graphs.find((g) => g.id === selectedGraphId) ?? null,
    [graphs, selectedGraphId],
  );

  const loadProjects = async () => {
    const items = await requestJson<ProjectDto[]>('/api/backend/projects');
    setProjects(items);
    if (!selectedProjectId && items.length > 0) {
      setSelectedProjectId(items[0].id);
    }
  };

  const loadDashboards = async (projectId: number) => {
    const items = await requestJson<DashboardDto[]>(`/api/backend/projects/${projectId}/dashboards`);
    setDashboards(items);
    setSelectedDashboardId(items[0]?.id ?? null);
  };

  const loadGraphs = async (projectId: number, dashboardId: number) => {
    const items = await requestJson<GraphDto[]>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs`);
    setGraphs(items);
    setSelectedGraphId(items[0]?.id ?? null);
  };

  const loadQueries = async (projectId: number, dashboardId: number, graphId: number) => {
    const items = await requestJson<QueryDto[]>(`/api/backend/projects/${projectId}/dashboards/${dashboardId}/graphs/${graphId}/queries`);
    setQueries(items);
  };

  const run = async (task: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await task();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void run(async () => {
      await loadProjects();
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setDashboards([]);
      setSelectedDashboardId(null);
      return;
    }

    void run(async () => {
      await loadDashboards(selectedProjectId);
    });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedDashboardId) {
      setGraphs([]);
      setSelectedGraphId(null);
      return;
    }

    void run(async () => {
      await loadGraphs(selectedProjectId, selectedDashboardId);
    });
  }, [selectedProjectId, selectedDashboardId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedDashboardId || !selectedGraphId) {
      setQueries([]);
      return;
    }

    void run(async () => {
      await loadQueries(selectedProjectId, selectedDashboardId, selectedGraphId);
    });
  }, [selectedProjectId, selectedDashboardId, selectedGraphId]);

  const createProject = () => run(async () => {
    if (!projectName.trim()) throw new Error('Project name is required');

    await requestJson<ProjectDto>('/api/backend/projects', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
      }),
    });
    setProjectName('');
    setProjectDescription('');
    await loadProjects();
    setMessage('Project created');
  });

  const createDashboard = () => run(async () => {
    if (!selectedProjectId) throw new Error('Select a project first');
    if (!dashboardName.trim()) throw new Error('Dashboard name is required');

    await requestJson<DashboardDto>(`/api/backend/projects/${selectedProjectId}/dashboards`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: dashboardName.trim(),
        description: dashboardDescription.trim() || undefined,
      }),
    });
    setDashboardName('');
    setDashboardDescription('');
    await loadDashboards(selectedProjectId);
    setMessage('Dashboard created');
  });

  const createGraph = () => run(async () => {
    if (!selectedProjectId || !selectedDashboardId) throw new Error('Select project and dashboard first');
    if (!graphName.trim()) throw new Error('Graph name is required');

    await requestJson<GraphDto>(`/api/backend/projects/${selectedProjectId}/dashboards/${selectedDashboardId}/graphs`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: graphName.trim(),
        graphType,
      }),
    });
    setGraphName('');
    await loadGraphs(selectedProjectId, selectedDashboardId);
    setMessage('Graph created');
  });

  const createQuery = () => run(async () => {
    if (!selectedProjectId || !selectedDashboardId || !selectedGraphId) {
      throw new Error('Select project, dashboard and graph first');
    }
    if (!queryName.trim()) throw new Error('Query name is required');
    if (!querySql.trim()) throw new Error('SQL is required');

    await requestJson<QueryDto>(`/api/backend/projects/${selectedProjectId}/dashboards/${selectedDashboardId}/graphs/${selectedGraphId}/queries`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: queryName.trim(),
        sqlText: querySql,
      }),
    });
    setQueryName('');
    await loadQueries(selectedProjectId, selectedDashboardId, selectedGraphId);
    setMessage('Query created');
  });

  return (
    <Page.Block width="xl" gutters>
      <div className="py-8 space-y-6">
        <Heading level="1" size="large">Backend CRUD test</Heading>
        <BodyLong size="small">
          Swagger confirms no team field is required. Flow is Project → Dashboard → Graph → Query.
        </BodyLong>

        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Projects</Heading>
            <Select
              label="Select project"
              size="small"
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} (#{p.id})</option>)}
            </Select>
            <TextField label="Name" size="small" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <TextField label="Description" size="small" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
            <Button size="small" onClick={createProject} loading={loading}>Create project</Button>
          </div>

          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Dashboards</Heading>
            <Select
              label="Select dashboard"
              size="small"
              value={selectedDashboardId ?? ''}
              onChange={(e) => setSelectedDashboardId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-</option>
              {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>)}
            </Select>
            <TextField label="Name" size="small" value={dashboardName} onChange={(e) => setDashboardName(e.target.value)} />
            <TextField label="Description" size="small" value={dashboardDescription} onChange={(e) => setDashboardDescription(e.target.value)} />
            <Button size="small" onClick={createDashboard} loading={loading}>Create dashboard</Button>
          </div>

          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Graphs</Heading>
            <Select
              label="Select graph"
              size="small"
              value={selectedGraphId ?? ''}
              onChange={(e) => setSelectedGraphId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-</option>
              {graphs.map((g) => <option key={g.id} value={g.id}>{g.name} (#{g.id})</option>)}
            </Select>
            <TextField label="Name" size="small" value={graphName} onChange={(e) => setGraphName(e.target.value)} />
            <Select label="Graph type" size="small" value={graphType} onChange={(e) => setGraphType(e.target.value)}>
              <option value="LINE">LINE</option>
              <option value="BAR">BAR</option>
              <option value="PIE">PIE</option>
              <option value="TABLE">TABLE</option>
            </Select>
            <Button size="small" onClick={createGraph} loading={loading}>Create graph</Button>
          </div>

          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Queries</Heading>
            <TextField label="Name" size="small" value={queryName} onChange={(e) => setQueryName(e.target.value)} />
            <Textarea label="SQL text" size="small" minRows={6} value={querySql} onChange={(e) => setQuerySql(e.target.value)} />
            <Button size="small" onClick={createQuery} loading={loading}>Create query</Button>
          </div>
        </div>

        <div className="space-y-2">
          <Heading level="2" size="small">Selected chain</Heading>
          <BodyLong size="small">
            Project: {selectedProject ? `${selectedProject.name} (#${selectedProject.id})` : '-'}
            <br />
            Dashboard: {selectedDashboard ? `${selectedDashboard.name} (#${selectedDashboard.id})` : '-'}
            <br />
            Graph: {selectedGraph ? `${selectedGraph.name} (#${selectedGraph.id})` : '-'}
            <br />
            Queries on graph: {queries.length}
          </BodyLong>
        </div>
      </div>
    </Page.Block>
  );
};

export default BackendCrudTest;
