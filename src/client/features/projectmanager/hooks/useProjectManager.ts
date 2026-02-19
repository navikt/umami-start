import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ProjectDto, DashboardDto, GraphDto, QueryDto } from '../model/types.ts';
import * as api from '../api/backendApi.ts';

export const useProjectManager = () => {
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

    // Form fields
    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [dashboardName, setDashboardName] = useState('');
    const [dashboardDescription, setDashboardDescription] = useState('');
    const [graphName, setGraphName] = useState('');
    const [graphType, setGraphType] = useState('LINE');
    const [queryName, setQueryName] = useState('');
    const [querySql, setQuerySql] = useState('SELECT 1 AS value');

    // Derived selections
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

    // ── Helpers ──

    const run = useCallback(async (task: () => Promise<void>) => {
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
    }, []);

    // ── Loaders ──

    const loadProjects = useCallback(async () => {
        const items = await api.fetchProjects();
        setProjects(items);
        setSelectedProjectId((prev) => prev ?? items[0]?.id ?? null);
    }, []);

    const loadDashboards = useCallback(async (projectId: number) => {
        const items = await api.fetchDashboards(projectId);
        setDashboards(items);
        setSelectedDashboardId(items[0]?.id ?? null);
    }, []);

    const loadGraphs = useCallback(async (projectId: number, dashboardId: number) => {
        const items = await api.fetchGraphs(projectId, dashboardId);
        setGraphs(items);
        setSelectedGraphId(items[0]?.id ?? null);
    }, []);

    const loadQueries = useCallback(async (projectId: number, dashboardId: number, graphId: number) => {
        const items = await api.fetchQueries(projectId, dashboardId, graphId);
        setQueries(items);
    }, []);

    // ── Effects ──

    useEffect(() => {
        void run(async () => {
            await loadProjects();
        });
    }, [run, loadProjects]);

    useEffect(() => {
        if (!selectedProjectId) {
            setDashboards([]);
            setSelectedDashboardId(null);
            return;
        }
        void run(async () => {
            await loadDashboards(selectedProjectId);
        });
    }, [selectedProjectId, run, loadDashboards]);

    useEffect(() => {
        if (!selectedProjectId || !selectedDashboardId) {
            setGraphs([]);
            setSelectedGraphId(null);
            return;
        }
        void run(async () => {
            await loadGraphs(selectedProjectId, selectedDashboardId);
        });
    }, [selectedProjectId, selectedDashboardId, run, loadGraphs]);

    useEffect(() => {
        if (!selectedProjectId || !selectedDashboardId || !selectedGraphId) {
            setQueries([]);
            return;
        }
        void run(async () => {
            await loadQueries(selectedProjectId, selectedDashboardId, selectedGraphId);
        });
    }, [selectedProjectId, selectedDashboardId, selectedGraphId, run, loadQueries]);

    // ── Create actions ──

    const createProject = useCallback(
        () =>
            run(async () => {
                if (!projectName.trim()) throw new Error('Prosjektnavn er påkrevd');
                await api.createProject(projectName.trim(), projectDescription.trim() || undefined);
                setProjectName('');
                setProjectDescription('');
                await loadProjects();
                setMessage('Prosjekt opprettet');
            }),
        [run, projectName, projectDescription, loadProjects],
    );

    const createDashboard = useCallback(
        () =>
            run(async () => {
                if (!selectedProjectId) throw new Error('Velg et prosjekt først');
                if (!dashboardName.trim()) throw new Error('Dashboard-navn er påkrevd');
                await api.createDashboard(selectedProjectId, dashboardName.trim(), dashboardDescription.trim() || undefined);
                setDashboardName('');
                setDashboardDescription('');
                await loadDashboards(selectedProjectId);
                setMessage('Dashboard opprettet');
            }),
        [run, selectedProjectId, dashboardName, dashboardDescription, loadDashboards],
    );

    const createGraph = useCallback(
        () =>
            run(async () => {
                if (!selectedProjectId || !selectedDashboardId) throw new Error('Velg prosjekt og dashboard først');
                if (!graphName.trim()) throw new Error('Grafnavn er påkrevd');
                await api.createGraph(selectedProjectId, selectedDashboardId, graphName.trim(), graphType);
                setGraphName('');
                await loadGraphs(selectedProjectId, selectedDashboardId);
                setMessage('Graf opprettet');
            }),
        [run, selectedProjectId, selectedDashboardId, graphName, graphType, loadGraphs],
    );

    const createQuery = useCallback(
        () =>
            run(async () => {
                if (!selectedProjectId || !selectedDashboardId || !selectedGraphId) {
                    throw new Error('Velg prosjekt, dashboard og graf først');
                }
                if (!queryName.trim()) throw new Error('Sporringsnavn er påkrevd');
                if (!querySql.trim()) throw new Error('SQL er påkrevd');
                await api.createQuery(selectedProjectId, selectedDashboardId, selectedGraphId, queryName.trim(), querySql);
                setQueryName('');
                await loadQueries(selectedProjectId, selectedDashboardId, selectedGraphId);
                setMessage('Sporring opprettet');
            }),
        [run, selectedProjectId, selectedDashboardId, selectedGraphId, queryName, querySql, loadQueries],
    );

    return {
        // Lists
        projects,
        dashboards,
        graphs,
        queries,

        // Selections
        selectedProjectId,
        setSelectedProjectId,
        selectedDashboardId,
        setSelectedDashboardId,
        selectedGraphId,
        setSelectedGraphId,
        selectedProject,
        selectedDashboard,
        selectedGraph,

        // Status
        loading,
        error,
        message,

        // Form fields
        projectName,
        setProjectName,
        projectDescription,
        setProjectDescription,
        dashboardName,
        setDashboardName,
        dashboardDescription,
        setDashboardDescription,
        graphName,
        setGraphName,
        graphType,
        setGraphType,
        queryName,
        setQueryName,
        querySql,
        setQuerySql,

        // Actions
        createProject,
        createDashboard,
        createGraph,
        createQuery,
    };
};

