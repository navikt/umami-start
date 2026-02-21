import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectDto } from '../model/types.ts';
import * as api from '../api/backendApi.ts';

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
                await api.createProject(newProjectName.trim(), newProjectDescription.trim() || undefined);
                setNewProjectName('');
                setNewProjectDescription('');
                await loadProjectSummaries();
                setMessage('Prosjekt opprettet');
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

    const editChart = useCallback(
        (projectId: number, dashboardId: number, graphId: number, params: { name: string; graphType: string }) =>
            run(async () => {
                if (!params.name.trim()) throw new Error('Grafnavn er påkrevd');
                await api.updateGraph(projectId, dashboardId, graphId, { name: params.name.trim(), graphType: params.graphType });
                await loadProjectSummaries();
                setMessage('Graf oppdatert');
            }),
        [run, loadProjectSummaries],
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
        deleteDashboard,
        deleteChart,
        editChart,
    };
};

export type { ProjectSummary };
