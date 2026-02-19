import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Label, Loader, Select, UNSAFE_Combobox } from '@navikt/ds-react';
import { useSearchParams } from 'react-router-dom';
import type { SavedChart } from '../../../../data/dashboard/types.ts';
import type { Website } from '../../dashboard/model/types.ts';
import DashboardLayout from '../../dashboard/ui/DashboardLayout.tsx';
import DashboardWebsitePicker from '../../dashboard/ui/DashboardWebsitePicker.tsx';
import { DashboardWidget } from '../../dashboard/ui/DashboardWidget.tsx';
import { normalizeUrlToPath } from '../../../shared/lib/utils.ts';
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

type FilterState = {
  urlFilters: string[];
  dateRange: string;
  pathOperator: string;
  metricType: 'visitors' | 'pageviews' | 'proportion' | 'visits';
  customStartDate?: Date;
  customEndDate?: Date;
};

const parseId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const mapGraphTypeToChart = (graphType?: string): SavedChart['type'] => {
  if (graphType === 'LINE') return 'line';
  if (graphType === 'BAR') return 'bar';
  if (graphType === 'PIE') return 'pie';
  if (graphType === 'TABLE') return 'table';
  return 'table';
};

const Oversikt = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [dashboards, setDashboards] = useState<DashboardDto[]>([]);
  const [graphs, setGraphs] = useState<GraphWithQueries[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [activeWebsite, setActiveWebsite] = useState<Website | null>(null);

  const [tempPathOperator, setTempPathOperator] = useState('equals');
  const [tempUrlPaths, setTempUrlPaths] = useState<string[]>([]);
  const [tempDateRange, setTempDateRange] = useState('current_month');
  const [tempMetricType, setTempMetricType] = useState<'visitors' | 'pageviews' | 'proportion' | 'visits'>('visitors');
  const [comboInputValue, setComboInputValue] = useState('');
  const isSelectingRef = useRef(false);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);

  const [activeFilters, setActiveFilters] = useState<FilterState>({
    pathOperator: 'equals',
    urlFilters: [],
    dateRange: 'current_month',
    metricType: 'visitors',
  });

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
        label: project.name,
        value: String(project.id),
      })),
    [projects],
  );

  const dashboardOptions = useMemo(
    () =>
      dashboards.map((dashboard) => ({
        label: dashboard.name,
        value: String(dashboard.id),
      })),
    [dashboards],
  );

  const selectedProjectLabel = projectOptions.find((option) => option.value === String(selectedProjectId))?.label;
  const selectedDashboardLabel = dashboardOptions.find((option) => option.value === String(selectedDashboardId))?.label;
  const activeWebsiteId = activeWebsite?.id ?? '';

  const charts = useMemo<SavedChart[]>(() => {
    return graphs
      .filter((item) => item.queries.length > 0)
      .map((item) => ({
        id: `graph-${item.graph.id}`,
        title: item.graph.name,
        type: mapGraphTypeToChart(item.graph.graphType),
        sql: item.queries[0].sqlText,
        width: 'half',
      }));
  }, [graphs]);

  const supportsStandardFilters = useMemo(() => {
    return charts.some((chart) => {
      const sql = chart.sql ?? '';
      return (
        sql.includes('{{website_id}}')
        || sql.includes('{{url_sti}}')
        || sql.includes('{{created_at}}')
      );
    });
  }, [charts]);

  const hasChanges =
    tempDateRange !== activeFilters.dateRange
    || !arraysEqual(tempUrlPaths, activeFilters.urlFilters)
    || tempPathOperator !== activeFilters.pathOperator
    || tempMetricType !== activeFilters.metricType
    || (selectedWebsite?.id ?? null) !== (activeWebsite?.id ?? null);

  const handleUpdate = () => {
    setActiveFilters({
      pathOperator: tempPathOperator,
      urlFilters: tempUrlPaths,
      dateRange: tempDateRange,
      metricType: tempMetricType,
    });
    setActiveWebsite(selectedWebsite);
  };

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

  useEffect(() => {
    if (!selectedWebsite) return;
    setActiveWebsite(selectedWebsite);
  }, [selectedWebsite]);

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

  const filters = (
    <>
      <div className="w-full md:w-[20rem]">
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

      <div className="w-full md:w-[20rem]">
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

      {supportsStandardFilters && (
        <>
          <div className="w-full md:w-[18rem]">
            <DashboardWebsitePicker
              selectedWebsite={selectedWebsite}
              onWebsiteChange={setSelectedWebsite}
              variant="minimal"
              size="small"
              disableUrlUpdate
            />
          </div>

          <div className="w-full md:w-[20rem]">
            <div className="flex items-center gap-2 mb-1">
              <Label size="small" htmlFor="oversikt-url-filter">URL-sti</Label>
              <select
                className="text-sm bg-[var(--ax-bg-default)] border border-[var(--ax-border-neutral-subtle)] rounded text-[var(--ax-text-accent)] font-medium cursor-pointer focus:outline-none py-1 px-2"
                value={tempPathOperator}
                onChange={(e) => setTempPathOperator(e.target.value)}
              >
                <option value="equals">er lik</option>
                <option value="starts-with">starter med</option>
              </select>
            </div>
            <UNSAFE_Combobox
              id="oversikt-url-filter"
              label="URL-stier"
              hideLabel
              size="small"
              isMultiSelect
              allowNewValues
              options={tempUrlPaths.map((path) => ({ label: path, value: path }))}
              selectedOptions={tempUrlPaths}
              onToggleSelected={(option: string, isSelected: boolean) => {
                isSelectingRef.current = true;
                setComboInputValue('');

                if (isSelected) {
                  let normalized = normalizeUrlToPath(option);
                  if (normalized && !normalized.startsWith('/')) normalized = `/${normalized}`;
                  setTempUrlPaths((previous) => {
                    if (!normalized || previous.includes(normalized)) return previous;
                    return [...previous, normalized];
                  });
                } else {
                  let normalized = normalizeUrlToPath(option);
                  if (normalized && !normalized.startsWith('/')) normalized = `/${normalized}`;
                  setTempUrlPaths((previous) => previous.filter((path) => path !== option && path !== normalized));
                }

                setTimeout(() => {
                  isSelectingRef.current = false;
                }, 100);
              }}
              value={comboInputValue}
              onChange={(value) => {
                if (isSelectingRef.current) return;
                setComboInputValue(value);
              }}
              clearButton
            />
          </div>

          <div className="w-full sm:w-auto min-w-[180px]">
            <Select
              label="Datoperiode"
              size="small"
              value={tempDateRange}
              onChange={(e) => setTempDateRange(e.target.value)}
            >
              <option value="current_month">Denne måneden</option>
              <option value="last_month">Forrige måned</option>
              <option value="last_30_days">Siste 30 dager</option>
            </Select>
          </div>

          <div className="w-full sm:w-auto min-w-[150px]">
            <Select
              label="Visning"
              size="small"
              value={tempMetricType}
              onChange={(e) => setTempMetricType(e.target.value as 'visitors' | 'pageviews' | 'proportion' | 'visits')}
            >
              <option value="visitors">Unike besøkende</option>
              <option value="visits">Økter / besøk</option>
              <option value="pageviews">Sidevisninger</option>
              <option value="proportion">Andel (%)</option>
            </Select>
          </div>

          <div className="flex items-end pb-[2px]">
            <Button size="small" onClick={handleUpdate} disabled={!hasChanges}>
              Oppdater
            </Button>
          </div>
        </>
      )}
    </>
  );

  return (
    <DashboardLayout
      title={selectedDashboard ? `Dashboard: ${selectedDashboard.name}` : 'Dashboard'}
      filters={filters}
    >
      {error && <Alert variant="error">{error}</Alert>}

      {isLoading && (
        <div className="flex justify-center p-8">
          <Loader />
        </div>
      )}

      {!isLoading && !selectedDashboard && (
        <div className="w-fit">
          <Alert variant="info" size="small">
            Velg prosjekt og dashboard for å vise grafer.
          </Alert>
        </div>
      )}

      {!isLoading && supportsStandardFilters && selectedDashboard && !activeWebsiteId && (
        <div className="w-fit">
          <Alert variant="info" size="small">
            Velg nettside eller app for å vise grafdata.
          </Alert>
        </div>
      )}

      {!isLoading && selectedDashboard && (!supportsStandardFilters || activeWebsiteId) && charts.length === 0 && (
        <div className="w-fit">
          <Alert variant="info" size="small">
            Ingen lagrede grafer med SQL funnet for valgt dashboard.
          </Alert>
        </div>
      )}

      {!isLoading && selectedDashboard && (!supportsStandardFilters || activeWebsiteId) && charts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-20 gap-6">
          {charts.map((chart) => (
            <DashboardWidget
              key={chart.id}
              chart={chart}
              websiteId={activeWebsiteId}
              filters={activeFilters}
              selectedWebsite={activeWebsite ? { ...activeWebsite } : undefined}
              dashboardTitle={selectedDashboard.name}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Oversikt;
