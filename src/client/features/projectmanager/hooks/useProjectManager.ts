import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectDto } from '../model/types.ts';
import * as api from '../api/backendApi.ts';
import { applyWebsiteIdOnly, replaceHardcodedWebsiteId } from '../../sql/utils/sqlProcessing.ts';

type ProjectSummary = {
    project: ProjectDto;
    dashboardCount: number;
    chartCount: number;
    dashboards: Array<{
        id: number;
        name: string;
        charts: Array<{
            id: number;
            name: string;
            graphType?: string;
        }>;
    }>;
};

export const useProjectManager = () => {
    const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');

    const run = useCallback(async <T>(task: () => Promise<T>): Promise<T | undefined> => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            return await task();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Ukjent feil');
            return undefined;
        } finally {
            setLoading(false);
        }
    }, []);

    const loadProjectSummaries = useCallback(async () => {
        const projectItems = await api.fetchProjects();

        const summaryItems = await Promise.all(projectItems.map(async (project) => {
            const dashboards = await api.fetchDashboards(project.id);
            const chartListByDashboard = await Promise.all(dashboards.map(async (dashboard) => {
                const graphs = await api.fetchGraphs(project.id, dashboard.id);
                return {
                    id: dashboard.id,
                    name: dashboard.name,
                    charts: graphs.map((graph) => ({
                        id: graph.id,
                        name: graph.name,
                        graphType: graph.graphType,
                    })),
                };
            }));
            const chartCount = chartListByDashboard.reduce((sum, dashboard) => sum + dashboard.charts.length, 0);

            return {
                project,
                dashboardCount: dashboards.length,
                chartCount,
                dashboards: chartListByDashboard,
            };
        }));

        setProjectSummaries(summaryItems);
    }, []);

    useEffect(() => {
        void run(async () => {
            await loadProjectSummaries();
        });
    }, [run, loadProjectSummaries]);

    const createProject = useCallback(
        () =>
            run(async () => {
                if (!newProjectName.trim()) throw new Error('Prosjektnavn er påkrevd');
                const createdProject = await api.createProject(newProjectName.trim(), newProjectDescription.trim() || undefined);
                setNewProjectName('');
                setNewProjectDescription('');
                await loadProjectSummaries();
                setMessage('Prosjekt opprettet');
                return createdProject.id;
            }),
        [run, newProjectName, newProjectDescription, loadProjectSummaries],
    );

    const editProject = useCallback(
        (projectId: number, name: string, description?: string) =>
            run(async () => {
                if (!name.trim()) throw new Error('Prosjektnavn er påkrevd');
                await api.updateProject(projectId, name.trim(), description?.trim() || undefined);
                await loadProjectSummaries();
                setMessage('Prosjekt oppdatert');
            }),
        [run, loadProjectSummaries],
    );

    const deleteProject = useCallback(
        (projectId: number) =>
            run(async () => {
                await api.deleteProject(projectId);
                await loadProjectSummaries();
                setMessage('Prosjekt slettet');
            }),
        [run, loadProjectSummaries],
    );

    const editDashboard = useCallback(
        (projectId: number, dashboardId: number, params: { name: string; projectId: number }) =>
            run(async () => {
                if (!params.name.trim()) throw new Error('Dashboardnavn er påkrevd');
                if (!params.projectId) throw new Error('Velg prosjekt');
                await api.updateDashboard(projectId, dashboardId, { name: params.name.trim(), projectId: params.projectId });
                await loadProjectSummaries();
                setMessage('Dashboard oppdatert');
            }),
        [run, loadProjectSummaries],
    );

    const createDashboard = useCallback(
        (projectId: number, name: string, description?: string) =>
            run(async () => {
                if (!projectId) throw new Error('Velg prosjekt');
                if (!name.trim()) throw new Error('Dashboardnavn er påkrevd');
                await api.createDashboard(projectId, name.trim(), description?.trim() || undefined);
                await loadProjectSummaries();
                setMessage('Dashboard opprettet');
            }),
        [run, loadProjectSummaries],
    );

    const deleteDashboard = useCallback(
        (projectId: number, dashboardId: number) =>
            run(async () => {
                await api.deleteDashboard(projectId, dashboardId);
                await loadProjectSummaries();
                setMessage('Dashboard slettet');
            }),
        [run, loadProjectSummaries],
    );

    const deleteChart = useCallback(
        (projectId: number, dashboardId: number, graphId: number) =>
            run(async () => {
                await api.deleteGraph(projectId, dashboardId, graphId);
                await loadProjectSummaries();
                setMessage('Graf slettet');
            }),
        [run, loadProjectSummaries],
    );

    const importChart = useCallback(
        (
            projectId: number,
            dashboardId: number,
            params: { name: string; graphType: string; width: number; sqlText: string },
        ): Promise<{ ok: true } | { ok: false; error: string }> =>
            (async () => {
                setLoading(true);
                setError(null);
                setMessage(null);
                try {
                    if (!params.name.trim()) {
                        return { ok: false, error: 'Grafnavn er påkrevd' };
                    }
                    if (!params.sqlText.trim()) {
                        return { ok: false, error: 'SQL-kode er påkrevd' };
                    }
                    const createdGraph = await api.createGraph(projectId, dashboardId, {
                        name: params.name.trim(),
                        graphType: params.graphType,
                        width: params.width,
                    });
                    await api.createQuery(
                        projectId,
                        dashboardId,
                        createdGraph.id,
                        `${params.name.trim()} - query`,
                        params.sqlText.trim(),
                    );
                    await loadProjectSummaries();
                    setMessage('Graf importert');
                    return { ok: true };
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : 'Ukjent feil';
                    setError(errorMessage);
                    return { ok: false, error: errorMessage };
                } finally {
                    setLoading(false);
                }
            })(),
        [loadProjectSummaries],
    );

    const rewriteSqlWebsiteId = useCallback((sql: string, targetWebsiteId?: string): string => {
        if (!targetWebsiteId) return sql;
        const withPlaceholderApplied = applyWebsiteIdOnly(sql, targetWebsiteId);
        return replaceHardcodedWebsiteId(withPlaceholderApplied, targetWebsiteId);
    }, []);

    const copyChart = useCallback(
        async (params: {
            sourceProjectId: number;
            sourceDashboardId: number;
            sourceGraphId: number;
            targetProjectId: number;
            targetDashboardId: number;
            chartName: string;
            websiteId?: string;
        }): Promise<{ ok: true } | { ok: false; error: string }> => {
            setLoading(true);
            setError(null);
            setMessage(null);
            try {
                const sourceGraphs = await api.fetchGraphs(params.sourceProjectId, params.sourceDashboardId);
                const sourceGraph = sourceGraphs.find((item) => item.id === params.sourceGraphId);
                if (!sourceGraph) {
                    return { ok: false, error: 'Fant ikke grafen som skal kopieres' };
                }

                const sourceQueries = await api.fetchQueries(
                    params.sourceProjectId,
                    params.sourceDashboardId,
                    params.sourceGraphId,
                );
                const sourceQuery = sourceQueries[0];
                if (!sourceQuery?.sqlText?.trim()) {
                    return { ok: false, error: 'Grafen mangler SQL og kan ikke kopieres' };
                }

                const targetName = params.chartName.trim();
                if (!targetName) {
                    return { ok: false, error: 'Grafnavn er påkrevd' };
                }

                const sqlForCopy = rewriteSqlWebsiteId(sourceQuery.sqlText.trim(), params.websiteId);
                const targetGraphs = await api.fetchGraphs(params.targetProjectId, params.targetDashboardId);
                const targetNameLower = targetName.toLowerCase();
                const isSameDashboard =
                    params.sourceProjectId === params.targetProjectId
                    && params.sourceDashboardId === params.targetDashboardId;
                const existingTarget = targetGraphs.find((graph) => {
                    if (isSameDashboard && graph.id === params.sourceGraphId) return false;
                    return graph.name.trim().toLowerCase() === targetNameLower;
                });

                const sourceGraphType = sourceGraph.graphType ?? 'TABLE';
                const sourceWidth = sourceGraph.width;
                const queryName = sourceQuery.name?.trim() || `${targetName} - query`;

                if (existingTarget) {
                    await api.updateGraph(
                        params.targetProjectId,
                        params.targetDashboardId,
                        existingTarget.id,
                        { name: targetName, graphType: sourceGraphType, width: sourceWidth },
                    );

                    const existingQueries = await api.fetchQueries(
                        params.targetProjectId,
                        params.targetDashboardId,
                        existingTarget.id,
                    );
                    const firstTargetQuery = existingQueries[0];
                    if (firstTargetQuery) {
                        await api.updateQuery(
                            params.targetProjectId,
                            params.targetDashboardId,
                            existingTarget.id,
                            firstTargetQuery.id,
                            queryName,
                            sqlForCopy,
                        );
                    } else {
                        await api.createQuery(
                            params.targetProjectId,
                            params.targetDashboardId,
                            existingTarget.id,
                            queryName,
                            sqlForCopy,
                        );
                    }
                } else {
                    const createdGraph = await api.createGraph(
                        params.targetProjectId,
                        params.targetDashboardId,
                        { name: targetName, graphType: sourceGraphType, width: sourceWidth },
                    );
                    await api.createQuery(
                        params.targetProjectId,
                        params.targetDashboardId,
                        createdGraph.id,
                        queryName,
                        sqlForCopy,
                    );
                }

                await loadProjectSummaries();
                setMessage('Graf kopiert');
                return { ok: true };
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Kunne ikke kopiere graf';
                setError(errorMessage);
                return { ok: false, error: errorMessage };
            } finally {
                setLoading(false);
            }
        },
        [loadProjectSummaries, rewriteSqlWebsiteId],
    );

    const editChart = useCallback(
        async (
            projectId: number,
            dashboardId: number,
            graphId: number,
            params: {
                name: string;
                graphType: string;
                width: number;
                sqlText: string;
                queryId: number;
                queryName: string;
                websiteId?: string;
                targetDashboardId?: number;
            },
        ): Promise<{ ok: true } | { ok: false; error: string }> => {
            setLoading(true);
            setError(null);
            setMessage(null);
            try {
                if (!params.name.trim()) {
                    return { ok: false, error: 'Grafnavn er påkrevd' };
                }
                if (!params.sqlText.trim()) {
                    return { ok: false, error: 'SQL-kode er påkrevd' };
                }
                const sqlForSave = rewriteSqlWebsiteId(params.sqlText, params.websiteId);
                const targetDashboardId = params.targetDashboardId;
                const shouldMove = targetDashboardId != null && targetDashboardId !== dashboardId;
                if (shouldMove) {
                    const createdGraph = await api.createGraph(projectId, targetDashboardId, {
                        name: params.name.trim(),
                        graphType: params.graphType,
                        width: params.width,
                    });
                    await api.createQuery(
                        projectId,
                        targetDashboardId,
                        createdGraph.id,
                        params.queryName,
                        sqlForSave,
                    );
                    await api.deleteGraph(projectId, dashboardId, graphId);
                } else {
                    await api.updateGraph(projectId, dashboardId, graphId, {
                        name: params.name.trim(),
                        graphType: params.graphType,
                        width: params.width,
                    });
                    await api.updateQuery(
                        projectId,
                        dashboardId,
                        graphId,
                        params.queryId,
                        params.queryName,
                        sqlForSave,
                    );
                }
                await loadProjectSummaries();
                setMessage('Graf oppdatert');
                return { ok: true };
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Kunne ikke oppdatere graf';
                setError(errorMessage);
                return { ok: false, error: errorMessage };
            } finally {
                setLoading(false);
            }
        },
        [loadProjectSummaries, rewriteSqlWebsiteId],
    );

    const projectSummaryById = useMemo(() => {
        return new Map(projectSummaries.map((item) => [item.project.id, item]));
    }, [projectSummaries]);

    return {
        projectSummaries,
        projectSummaryById,
        loading,
        error,
        message,
        newProjectName,
        setNewProjectName,
        newProjectDescription,
        setNewProjectDescription,
        createProject,
        editProject,
        deleteProject,
        editDashboard,
        createDashboard,
        deleteDashboard,
        deleteChart,
        editChart,
        importChart,
        copyChart,
    };
};

export type { ProjectSummary };
