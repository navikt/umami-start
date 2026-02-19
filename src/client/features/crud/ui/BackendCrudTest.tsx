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
        : `Foresporsel feilet (${response.status})`;
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
      setError(err instanceof Error ? err.message : 'Ukjent feil');
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
    if (!projectName.trim()) throw new Error('Prosjektnavn er påkrevd');

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
    setMessage('Prosjekt opprettet');
  });

  const createDashboard = () => run(async () => {
    if (!selectedProjectId) throw new Error('Velg et prosjekt først');
    if (!dashboardName.trim()) throw new Error('Dashboard-navn er påkrevd');

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
    setMessage('Dashboard opprettet');
  });

  const createGraph = () => run(async () => {
    if (!selectedProjectId || !selectedDashboardId) throw new Error('Velg prosjekt og dashboard først');
    if (!graphName.trim()) throw new Error('Grafnavn er påkrevd');

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
    setMessage('Graf opprettet');
  });

  const createQuery = () => run(async () => {
    if (!selectedProjectId || !selectedDashboardId || !selectedGraphId) {
      throw new Error('Velg prosjekt, dashboard og graf først');
    }
    if (!queryName.trim()) throw new Error('Sporringsnavn er påkrevd');
    if (!querySql.trim()) throw new Error('SQL er påkrevd');

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
    setMessage('Sporring opprettet');
  });

  return (
    <Page.Block width="xl" gutters>
      <div className="py-8 space-y-6">
        <Heading level="1" size="large">Backend CRUD test</Heading>


        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Prosjekter</Heading>
            <Select
              label="Velg prosjekt"
              size="small"
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} (#{p.id})</option>)}
            </Select>
            <TextField label="Navn" size="small" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <TextField label="Beskrivelse" size="small" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
            <Button size="small" onClick={createProject} loading={loading}>Opprett prosjekt</Button>
          </div>

          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Dashboards</Heading>
            <Select
              label="Velg dashboard"
              size="small"
              value={selectedDashboardId ?? ''}
              onChange={(e) => setSelectedDashboardId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-</option>
              {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>)}
            </Select>
            <TextField label="Navn" size="small" value={dashboardName} onChange={(e) => setDashboardName(e.target.value)} />
            <TextField label="Beskrivelse" size="small" value={dashboardDescription} onChange={(e) => setDashboardDescription(e.target.value)} />
            <Button size="small" onClick={createDashboard} loading={loading}>Opprett dashboard</Button>
          </div>

          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Grafer</Heading>
            <Select
              label="Velg graf"
              size="small"
              value={selectedGraphId ?? ''}
              onChange={(e) => setSelectedGraphId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-</option>
              {graphs.map((g) => <option key={g.id} value={g.id}>{g.name} (#{g.id})</option>)}
            </Select>
            <TextField label="Navn" size="small" value={graphName} onChange={(e) => setGraphName(e.target.value)} />
            <Select label="Graftype" size="small" value={graphType} onChange={(e) => setGraphType(e.target.value)}>
              <option value="LINE">Linjediagram</option>
              <option value="BAR">Stolpediagram</option>
              <option value="PIE">Sektordiagram</option>
              <option value="TABLE">Tabell</option>
            </Select>
            <Button size="small" onClick={createGraph} loading={loading}>Opprett graf</Button>
          </div>

          <div className="space-y-3 p-4 border rounded-md">
            <Heading level="2" size="small">Sporringer</Heading>
            <TextField label="Navn" size="small" value={queryName} onChange={(e) => setQueryName(e.target.value)} />
            <Textarea label="SQL-tekst" size="small" minRows={6} value={querySql} onChange={(e) => setQuerySql(e.target.value)} />
            <Button size="small" onClick={createQuery} loading={loading}>Opprett sporring</Button>
          </div>
        </div>

        <div className="space-y-2">
          <Heading level="2" size="small">Valgt kjede</Heading>
          <BodyLong size="small">
            Prosjekt: {selectedProject ? `${selectedProject.name} (#${selectedProject.id})` : '-'}
            <br />
            Dashboard: {selectedDashboard ? `${selectedDashboard.name} (#${selectedDashboard.id})` : '-'}
            <br />
            Graf: {selectedGraph ? `${selectedGraph.name} (#${selectedGraph.id})` : '-'}
            <br />
            Sporringer på graf: {queries.length}
          </BodyLong>
        </div>
      </div>
    </Page.Block>
  );
};

export default BackendCrudTest;
