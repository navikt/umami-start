import { useEffect, useMemo, useState } from 'react';
import { Alert, BodyLong, Heading, Loader, Page, ReadMore, UNSAFE_Combobox } from '@navikt/ds-react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchDashboards,
  fetchGraphs,
  fetchProjects,
  fetchQueries,
} from '../api/oversiktApi.ts';
import type { DashboardDto, GraphDto, ProjectDto, QueryDto } from '../api/oversiktApi.ts';

type GraphWithQueries = {
  graph: GraphDto;
  queries: QueryDto[];
};

const graphTypeLabels: Record<string, string> = {
  LINE: 'Linjediagram',
  BAR: 'Stolpediagram',
  PIE: 'Sektordiagram',
  TABLE: 'Tabell',
};

const parseId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const Oversikt = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [dashboards, setDashboards] = useState<DashboardDto[]>([]);
  const [graphs, setGraphs] = useState<GraphWithQueries[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingDashboards, setLoadingDashboards] = useState(false);
  const [loadingGraphs, setLoadingGraphs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedDashboard = useMemo(
    () => dashboards.find((dashboard) => dashboard.id === selectedDashboardId) ?? null,
    [dashboards, selectedDashboardId],
  );

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        label: `${project.name} (#${project.id})`,
        value: String(project.id),
      })),
    [projects],
  );

  const dashboardOptions = useMemo(
    () =>
      dashboards.map((dashboard) => ({
        label: `${dashboard.name} (#${dashboard.id})`,
        value: String(dashboard.id),
      })),
    [dashboards],
  );

  const selectedProjectLabel = projectOptions.find((option) => option.value === String(selectedProjectId))?.label;
  const selectedDashboardLabel = dashboardOptions.find((option) => option.value === String(selectedDashboardId))?.label;

  useEffect(() => {
    const run = async () => {
      setLoadingProjects(true);
      setError(null);
      try {
        const projectItems = await fetchProjects();
        setProjects(projectItems);

        const fromUrl = parseId(searchParams.get('projectId'));
        const fromState = selectedProjectId;
        const preferredId = fromState ?? fromUrl;

        const nextProject =
          (preferredId ? projectItems.find((item) => item.id === preferredId) : null)
          ?? projectItems[0]
          ?? null;

        setSelectedProjectId(nextProject?.id ?? null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Klarte ikke laste prosjekter';
        setError(message);
      } finally {
        setLoadingProjects(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setDashboards([]);
      setSelectedDashboardId(null);
      setGraphs([]);
      return;
    }

    const run = async () => {
      setLoadingDashboards(true);
      setError(null);
      try {
        const dashboardItems = await fetchDashboards(selectedProjectId);
        setDashboards(dashboardItems);

        const fromUrlProjectId = parseId(searchParams.get('projectId'));
        const fromUrlDashboardId = parseId(searchParams.get('dashboardId'));
        const fromState = selectedDashboardId;

        const preferredDashboardId =
          fromState ?? (fromUrlProjectId === selectedProjectId ? fromUrlDashboardId : null);

        const nextDashboard =
          (preferredDashboardId ? dashboardItems.find((item) => item.id === preferredDashboardId) : null)
          ?? dashboardItems[0]
          ?? null;

        setSelectedDashboardId(nextDashboard?.id ?? null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Klarte ikke laste dashboards';
        setError(message);
      } finally {
        setLoadingDashboards(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedDashboardId) {
      setGraphs([]);
      return;
    }

    const run = async () => {
      setLoadingGraphs(true);
      setError(null);
      try {
        const graphItems = await fetchGraphs(selectedProjectId, selectedDashboardId);
        const graphWithQueries = await Promise.all(
          graphItems.map(async (graph) => ({
            graph,
            queries: await fetchQueries(selectedProjectId, selectedDashboardId, graph.id),
          })),
        );
        setGraphs(graphWithQueries);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Klarte ikke laste grafer';
        setError(message);
      } finally {
        setLoadingGraphs(false);
      }
    };

    void run();
  }, [selectedProjectId, selectedDashboardId]);

  useEffect(() => {
    const currentProjectId = searchParams.get('projectId');
    const currentDashboardId = searchParams.get('dashboardId');
    const nextProjectId = selectedProjectId ? String(selectedProjectId) : null;
    const nextDashboardId = selectedDashboardId ? String(selectedDashboardId) : null;

    if (currentProjectId === nextProjectId && currentDashboardId === nextDashboardId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (nextProjectId) {
      nextParams.set('projectId', nextProjectId);
    } else {
      nextParams.delete('projectId');
    }

    if (nextDashboardId) {
      nextParams.set('dashboardId', nextDashboardId);
    } else {
      nextParams.delete('dashboardId');
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedProjectId, selectedDashboardId, setSearchParams]);

  const handleProjectSelected = (option: string, isSelected: boolean) => {
    if (!isSelected) {
      setSelectedProjectId(null);
      setSelectedDashboardId(null);
      return;
    }
    const selected = projects.find((project) => String(project.id) === option);
    if (!selected) return;
    setSelectedProjectId(selected.id);
    setSelectedDashboardId(null);
  };

  const handleDashboardSelected = (option: string, isSelected: boolean) => {
    if (!isSelected) {
      setSelectedDashboardId(null);
      return;
    }
    const selected = dashboards.find((dashboard) => String(dashboard.id) === option);
    if (!selected) return;
    setSelectedDashboardId(selected.id);
  };

  const isLoading = loadingProjects || loadingDashboards || loadingGraphs;

  return (
    <Page.Block width="xl" gutters>
      <div className="py-8 space-y-6">
        <Heading level="1" size="large" spacing>Dashboard</Heading>

        <div className="flex flex-wrap items-start gap-4">
          <div className="w-full md:w-[22rem]">
            <UNSAFE_Combobox
              label="Prosjekt"
              options={projectOptions}
              selectedOptions={selectedProjectLabel ? [selectedProjectLabel] : []}
              onToggleSelected={handleProjectSelected}
              isMultiSelect={false}
              size="small"
              clearButton
              disabled={loadingProjects}
            />
          </div>
          <div className="w-full md:w-[22rem]">
            <UNSAFE_Combobox
              label="Dashboard"
              options={dashboardOptions}
              selectedOptions={selectedDashboardLabel ? [selectedDashboardLabel] : []}
              onToggleSelected={handleDashboardSelected}
              isMultiSelect={false}
              size="small"
              clearButton
              disabled={!selectedProject || loadingDashboards}
            />
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {isLoading && (
          <div className="flex items-center gap-2">
            <Loader size="small" />
            <BodyLong size="small">Laster data...</BodyLong>
          </div>
        )}

        {!isLoading && selectedDashboard && graphs.length === 0 && (
          <Alert variant="info">
            Ingen lagrede grafer funnet for valgt dashboard.
          </Alert>
        )}

        {!isLoading && graphs.length > 0 && (
          <div className="space-y-4">
            {graphs.map(({ graph, queries }) => {
              const graphTypeLabel = graph.graphType ? (graphTypeLabels[graph.graphType] || graph.graphType) : 'Ukjent';
              return (
                <section key={graph.id} className="border rounded-md p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Heading level="2" size="small">{graph.name}</Heading>
                    <BodyLong size="small" className="text-[var(--ax-text-subtle)]">
                      {graphTypeLabel} · {queries.length} sporringer
                    </BodyLong>
                  </div>

                  {queries.length === 0 && (
                    <BodyLong size="small">Ingen sporringer koblet til denne grafen.</BodyLong>
                  )}

                  {queries.map((query) => (
                    <ReadMore key={query.id} header={`${query.name} (#${query.id})`} size="small">
                      <pre className="whitespace-pre-wrap break-words text-xs mt-2">
                        {query.sqlText}
                      </pre>
                    </ReadMore>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Page.Block>
  );
};

export default Oversikt;
