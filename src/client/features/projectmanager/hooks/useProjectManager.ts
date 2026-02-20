import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectDto } from '../model/types.ts';
import * as api from '../api/backendApi.ts';

type ProjectSummary = {
    project: ProjectDto;
    dashboardCount: number;
    chartCount: number;
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
            const chartCountList = await Promise.all(dashboards.map(async (dashboard) => {
                const graphs = await api.fetchGraphs(project.id, dashboard.id);
                return graphs.length;
            }));
            const chartCount = chartCountList.reduce((sum, count) => sum + count, 0);

            return {
                project,
                dashboardCount: dashboards.length,
                chartCount,
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
    };
};

export type { ProjectSummary };
