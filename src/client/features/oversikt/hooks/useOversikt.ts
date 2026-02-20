import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizeUrlToPath } from '../../../shared/lib/utils.ts';
import type { Website } from '../../dashboard/model/types.ts';
import type {
    ProjectDto, DashboardDto, GraphWithQueries, FilterState, MetricType,
    OversiktChart, OversiktSelectOption,
} from '../model/types.ts';
import { createDashboard, createProject, fetchProjects, fetchDashboards, fetchGraphs, fetchQueries, updateGraphOrdering } from '../api/oversiktApi.ts';
import {
    parseId,
    arraysEqual,
    mapGraphTypeToChart,
    normalizeGraphType,
    getLastOversiktProjectId,
    getLastOversiktDashboardId,
    saveLastOversiktProjectId,
    saveLastOversiktDashboardId,
} from '../utils/oversikt.ts';

export const useOversikt = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [projects, setProjects] = useState<ProjectDto[]>([]);
    const [dashboards, setDashboards] = useState<DashboardDto[]>([]);
    const [graphs, setGraphs] = useState<GraphWithQueries[]>([]);
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [activeWebsite, setActiveWebsite] = useState<Website | null>(null);

    const [tempPathOperator, setTempPathOperator] = useState('equals');
    const [tempUrlPaths, setTempUrlPaths] = useState<string[]>([]);
    const [tempDateRange, setTempDateRange] = useState('current_month');
    const [tempMetricType, setTempMetricType] = useState<MetricType>('visitors');
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

    // ── Derived ──

    const selectedProject = useMemo(
        () => projects.find((p) => p.id === selectedProjectId) ?? null,
        [projects, selectedProjectId],
    );
    const selectedDashboard = useMemo(
        () => dashboards.find((d) => d.id === selectedDashboardId) ?? null,
        [dashboards, selectedDashboardId],
    );

    const projectOptions = useMemo<OversiktSelectOption[]>(
        () => projects.map((p) => ({ label: p.name, value: String(p.id) })),
        [projects],
    );
    const dashboardOptions = useMemo<OversiktSelectOption[]>(
        () => dashboards.map((d) => ({ label: d.name, value: String(d.id) })),
        [dashboards],
    );

    const selectedProjectLabel = projectOptions.find((o) => o.value === String(selectedProjectId))?.label;
    const selectedDashboardLabel = dashboardOptions.find((o) => o.value === String(selectedDashboardId))?.label;
    const activeWebsiteId = activeWebsite?.id ?? '';

    const charts = useMemo<OversiktChart[]>(() => {
        return [...graphs]
            .sort((a, b) => (a.graph.ordering ?? 0) - (b.graph.ordering ?? 0))
            .filter((item) => item.queries.length > 0)
            .map((item) => {
                const primaryQuery = item.queries[0];
                return {
                    id: `graph-${item.graph.id}`,
                    title: item.graph.name,
                    type: mapGraphTypeToChart(item.graph.graphType),
                    sql: primaryQuery.sqlText,
                    width: 'half' as const,
                    graphId: item.graph.id,
                    graphType: normalizeGraphType(item.graph.graphType),
                    queryId: primaryQuery.id,
                    queryName: primaryQuery.name,
                };
            });
    }, [graphs]);

    const supportsStandardFilters = useMemo(() => {
        return charts.some((chart) => {
            const sql = chart.sql ?? '';
            return sql.includes('{{website_id}}') || sql.includes('{{url_sti}}') || sql.includes('{{created_at}}');
        });
    }, [charts]);

    const hasChanges =
        tempDateRange !== activeFilters.dateRange
        || !arraysEqual(tempUrlPaths, activeFilters.urlFilters)
        || tempPathOperator !== activeFilters.pathOperator
        || tempMetricType !== activeFilters.metricType
        || (selectedWebsite?.id ?? null) !== (activeWebsite?.id ?? null);

    const isLoading = loadingProjects || loadingDashboards || loadingGraphs;

    // ── Handlers ──

    const handleUpdate = useCallback(() => {
        setActiveFilters({
            pathOperator: tempPathOperator,
            urlFilters: tempUrlPaths,
            dateRange: tempDateRange,
            metricType: tempMetricType,
        });
        setActiveWebsite(selectedWebsite);
    }, [tempPathOperator, tempUrlPaths, tempDateRange, tempMetricType, selectedWebsite]);

    const handleProjectSelected = useCallback(
        async (option: string, isSelected: boolean) => {
            if (!isSelected) {
                setSelectedProjectId(null);
                setSelectedDashboardId(null);
                return;
            }

            try {
                setError(null);
                const selectedById = projects.find((p) => String(p.id) === option);
                const selectedByName = projects.find((p) => p.name.trim().toLowerCase() === option.trim().toLowerCase());
                const selected = selectedById ?? selectedByName;

                let projectToUse = selected;
                if (!projectToUse) {
                    const trimmedName = option.trim();
                    if (!trimmedName) return;
                    setLoadingProjects(true);
                    const createdProject = await createProject(trimmedName, 'Opprettet fra Oversikt');
                    projectToUse = createdProject;
                    setProjects((prev) => [...prev, createdProject]);
                }

                setSelectedProjectId(projectToUse.id);
                setSelectedDashboardId(null);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Klarte ikke velge eller opprette prosjekt');
            } finally {
                setLoadingProjects(false);
            }
        },
        [projects],
    );

    const handleDashboardSelected = useCallback(
        async (option: string, isSelected: boolean) => {
            if (!isSelected) {
                setSelectedDashboardId(null);
                return;
            }

            if (!selectedProjectId) {
                setError('Velg eller opprett prosjekt først');
                return;
            }

            try {
                setError(null);
                const selectedById = dashboards.find((d) => String(d.id) === option);
                const selectedByName = dashboards.find((d) => d.name.trim().toLowerCase() === option.trim().toLowerCase());
                const selected = selectedById ?? selectedByName;

                let dashboardToUse = selected;
                if (!dashboardToUse) {
                    const trimmedName = option.trim();
                    if (!trimmedName) return;
                    setLoadingDashboards(true);
                    const createdDashboard = await createDashboard(selectedProjectId, trimmedName, 'Opprettet fra Oversikt');
                    dashboardToUse = createdDashboard;
                    setDashboards((prev) => [...prev, createdDashboard]);
                }

                setSelectedDashboardId(dashboardToUse.id);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Klarte ikke velge eller opprette dashboard');
            } finally {
                setLoadingDashboards(false);
            }
        },
        [dashboards, selectedProjectId],
    );

    const handleUrlToggleSelected = useCallback(
        (option: string, isSelected: boolean) => {
            isSelectingRef.current = true;
            setComboInputValue('');

            if (isSelected) {
                let normalized = normalizeUrlToPath(option);
                if (normalized && !normalized.startsWith('/')) normalized = `/${normalized}`;
                setTempUrlPaths((prev) => {
                    if (!normalized || prev.includes(normalized)) return prev;
                    return [...prev, normalized];
                });
            } else {
                let normalized = normalizeUrlToPath(option);
                if (normalized && !normalized.startsWith('/')) normalized = `/${normalized}`;
                setTempUrlPaths((prev) => prev.filter((p) => p !== option && p !== normalized));
            }

            setTimeout(() => {
                isSelectingRef.current = false;
            }, 100);
        },
        [],
    );

    const handleComboChange = useCallback(
        (value: string) => {
            if (isSelectingRef.current) return;
            setComboInputValue(value);
        },
        [],
    );

    const handleReorderCharts = useCallback(
        async (fromIndex: number, toIndex: number) => {
            if (!selectedProjectId || !selectedDashboardId) return;
            if (fromIndex === toIndex) return;

            // Compute reordered list from current charts
            const reordered = [...charts];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);

            const ordering = reordered.map((chart, index) => ({
                id: chart.graphId,
                ordering: index,
            }));

            // Optimistically update local graph ordering
            setGraphs((prev) => {
                const orderMap = new Map(ordering.map((entry) => [entry.id, entry.ordering]));
                return prev.map((item) => ({
                    ...item,
                    graph: {
                        ...item.graph,
                        ordering: orderMap.get(item.graph.id) ?? item.graph.ordering,
                    },
                }));
            });

            try {
                await updateGraphOrdering(selectedProjectId, selectedDashboardId, ordering);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Kunne ikke oppdatere rekkefølge');
                // Revert by re-fetching
                await refreshGraphs();
            }
        },
        [selectedProjectId, selectedDashboardId, charts, refreshGraphs],
    );

    // ── Effects ──

    useEffect(() => {
        const run = async () => {
            setLoadingProjects(true);
            setError(null);
            try {
                const projectItems = await fetchProjects();
                setProjects(projectItems);

                const fromUrl = parseId(searchParams.get('projectId'));
                const fromStorage = fromUrl ? null : getLastOversiktProjectId();
                const fromState = selectedProjectId;
                const preferredId = fromState ?? fromUrl ?? fromStorage;

                const nextProject =
                    (preferredId ? projectItems.find((item) => item.id === preferredId) : null)
                    ?? projectItems[0]
                    ?? null;

                setSelectedProjectId(nextProject?.id ?? null);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Klarte ikke laste prosjekter');
            } finally {
                setLoadingProjects(false);
            }
        };

        void run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshDashboards = useCallback(async (projectId: number | null, preferredDashboardId?: number | null) => {
        if (!projectId) {
            setDashboards([]);
            setSelectedDashboardId(null);
            setGraphs([]);
            return;
        }

        setLoadingDashboards(true);
        setError(null);
        try {
            const dashboardItems = await fetchDashboards(projectId);
            setDashboards(dashboardItems);

            const fromUrlProjectId = parseId(searchParams.get('projectId'));
            const fromUrlDashboardId = parseId(searchParams.get('dashboardId'));
            const fromStorage = fromUrlDashboardId ? null : getLastOversiktDashboardId();
            const fromState = preferredDashboardId ?? selectedDashboardId;

            const resolvedPreferredDashboardId =
                fromState ?? (fromUrlProjectId === projectId ? fromUrlDashboardId : fromStorage);

            const nextDashboard =
                (resolvedPreferredDashboardId ? dashboardItems.find((item) => item.id === resolvedPreferredDashboardId) : null)
                ?? dashboardItems[0]
                ?? null;

            setSelectedDashboardId(nextDashboard?.id ?? null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Klarte ikke laste dashboards');
        } finally {
            setLoadingDashboards(false);
        }
    }, [searchParams, selectedDashboardId]);

    useEffect(() => {
        void refreshDashboards(selectedProjectId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProjectId]);

    const refreshGraphs = useCallback(async () => {
        if (!selectedProjectId || !selectedDashboardId) {
            setGraphs([]);
            return;
        }

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
            setError(err instanceof Error ? err.message : 'Klarte ikke laste grafer');
        } finally {
            setLoadingGraphs(false);
        }
    }, [selectedProjectId, selectedDashboardId]);

    useEffect(() => {
        void refreshGraphs();
    }, [refreshGraphs]);

    useEffect(() => {
        const currentProjectId = searchParams.get('projectId');
        const currentDashboardId = searchParams.get('dashboardId');
        const nextProjectId = selectedProjectId ? String(selectedProjectId) : null;
        const nextDashboardId = selectedDashboardId ? String(selectedDashboardId) : null;

        if (currentProjectId === nextProjectId && currentDashboardId === nextDashboardId) return;

        const nextParams = new URLSearchParams(searchParams);
        if (nextProjectId) nextParams.set('projectId', nextProjectId);
        else nextParams.delete('projectId');
        if (nextDashboardId) nextParams.set('dashboardId', nextDashboardId);
        else nextParams.delete('dashboardId');

        setSearchParams(nextParams, { replace: true });
    }, [searchParams, selectedProjectId, selectedDashboardId, setSearchParams]);

    useEffect(() => {
        if (!selectedWebsite) return;
        setActiveWebsite(selectedWebsite);
    }, [selectedWebsite]);

    useEffect(() => {
        saveLastOversiktProjectId(selectedProjectId);
    }, [selectedProjectId]);

    useEffect(() => {
        saveLastOversiktDashboardId(selectedDashboardId);
    }, [selectedDashboardId]);

    return {
        // Selections & options
        selectedProject,
        selectedDashboard,
        selectedProjectId,
        selectedDashboardId,
        setSelectedProjectId,
        setSelectedDashboardId,
        projects,
        projectOptions,
        dashboardOptions,
        selectedProjectLabel,
        selectedDashboardLabel,

        // Website
        selectedWebsite,
        setSelectedWebsite,
        activeWebsite,
        activeWebsiteId,

        // Temp filter fields
        tempPathOperator,
        setTempPathOperator,
        tempUrlPaths,
        tempDateRange,
        setTempDateRange,
        tempMetricType,
        setTempMetricType,
        comboInputValue,

        // Active filters
        activeFilters,

        // Derived
        charts,
        supportsStandardFilters,
        hasChanges,
        isLoading,
        loadingProjects,
        loadingDashboards,
        error,

        // Handlers
        handleUpdate,
        handleProjectSelected,
        handleDashboardSelected,
        handleUrlToggleSelected,
        handleComboChange,
        handleReorderCharts,
        refreshGraphs,
        refreshDashboards,
    };
};
