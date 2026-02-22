import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { BarChartIcon, LineGraphIcon, PieChartIcon, SquareGridIcon, TableIcon } from '@navikt/aksel-icons';
import { MoreVertical, Plus } from 'lucide-react';
import { ActionMenu, Alert, BodyShort, Button, Heading, Link, Loader, Modal, Search, Table, TextField, Tooltip } from '@navikt/ds-react';
import DeleteDashboardDialog from '../../oversikt/ui/dialogs/DeleteDashboardDialog.tsx';
import CopyChartDialog from '../../oversikt/ui/dialogs/CopyChartDialog.tsx';
import EditChartDialog from '../../oversikt/ui/dialogs/EditChartDialog.tsx';
import EditDashboardDialog from '../../oversikt/ui/dialogs/EditDashboardDialog.tsx';
import ImportChartDialog from '../../oversikt/ui/dialogs/ImportChartDialog.tsx';
import * as api from '../api/backendApi.ts';
import { useProjectManager } from '../hooks/useProjectManager.ts';
import type { ProjectSummary } from '../hooks/useProjectManager.ts';
import type { DashboardDto, ProjectDto } from '../model/types.ts';
import ProjectManagerLayout from './ProjectManagerLayout.tsx';
import { extractWebsiteId } from '../../sql/utils/sqlProcessing.ts';
import type { GraphType, OversiktChart } from '../../oversikt/model/types.ts';

type FileTableRow = {
    id: string;
    type: 'dashboard' | 'chart';
    name: string;
    dashboardId: number;
    dashboardName: string;
    graphType?: string;
    graphId?: number;
};

type ImportGraphType = 'LINE' | 'BAR' | 'PIE' | 'TABLE';
type ProjectManagerEditChartTarget = {
    projectId: number;
    dashboardId: number;
    chart: OversiktChart;
    defaultWebsiteId?: string;
};

const LAST_PROJECT_STORAGE_KEY = 'projectmanager:lastSelectedProjectId';

const ProjectManager = () => {
    const {
        projectSummaries,
        loading,
        error,
        message,
        newProjectName,
        setNewProjectName,
        newProjectDescription,
        setNewProjectDescription,
        createProject,
        editProject,
        createDashboard,
        importChart,
        deleteProject,
        editDashboard,
        deleteDashboard,
        deleteChart,
        editChart,
        copyChart,
    } = useProjectManager();

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const fromQuery = new URLSearchParams(window.location.search).get('projectId');
        if (fromQuery) {
            const parsedQuery = Number(fromQuery);
            if (Number.isFinite(parsedQuery)) return parsedQuery;
        }
        const raw = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    });
    const [editTarget, setEditTarget] = useState<ProjectSummary | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [editDashboardTarget, setEditDashboardTarget] = useState<DashboardDto | null>(null);
    const [deleteDashboardTarget, setDeleteDashboardTarget] = useState<DashboardDto | null>(null);
    const [dashboardMutationError, setDashboardMutationError] = useState<string | null>(null);
    const [editChartTarget, setEditChartTarget] = useState<ProjectManagerEditChartTarget | null>(null);
    const [deleteChartTarget, setDeleteChartTarget] = useState<{
        projectId: number;
        dashboardId: number;
        graphId: number;
        name: string;
    } | null>(null);
    const [chartMutationError, setChartMutationError] = useState<string | null>(null);
    const [copyChartTarget, setCopyChartTarget] = useState<{
        projectId: number;
        dashboardId: number;
        graphId: number;
        name: string;
        sourceWebsiteId?: string;
    } | null>(null);
    const [copyChartError, setCopyChartError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const [isCreateDashboardOpen, setIsCreateDashboardOpen] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState('');
    const [newDashboardDescription, setNewDashboardDescription] = useState('');
    const [createDashboardError, setCreateDashboardError] = useState<string | null>(null);
    const [isImportChartOpen, setIsImportChartOpen] = useState(false);
    const [importChartError, setImportChartError] = useState<string | null>(null);
    const [importChartDefaultDashboardId, setImportChartDefaultDashboardId] = useState<number | null>(null);
    const [showErrorAlert, setShowErrorAlert] = useState(true);
    const [showMessageAlert, setShowMessageAlert] = useState(true);
    const [showNoProjectsAlert, setShowNoProjectsAlert] = useState(true);
    const [showNoSearchResultsAlert, setShowNoSearchResultsAlert] = useState(true);
    const [showNoSelectedProjectAlert, setShowNoSelectedProjectAlert] = useState(true);
    const projectNameInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (projectSummaries.length === 0) {
            return;
        }
        if (!selectedProjectId || !projectSummaries.some((item) => item.project.id === selectedProjectId)) {
            setSelectedProjectId(projectSummaries[0].project.id);
        }
    }, [projectSummaries, selectedProjectId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (projectSummaries.length === 0) return;
        if (!selectedProjectId) {
            window.localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, String(selectedProjectId));
    }, [selectedProjectId, projectSummaries.length]);

    const selectedProject = useMemo(
        () => projectSummaries.find((item) => item.project.id === selectedProjectId) ?? null,
        [projectSummaries, selectedProjectId],
    );

    const filteredProjectSummaries = useMemo(() => {
        const query = projectSearch.trim().toLowerCase();
        if (!query) return projectSummaries;
        return projectSummaries.filter((summary) => {
            const name = summary.project.name.toLowerCase();
            const description = (summary.project.description ?? '').toLowerCase();
            return name.includes(query) || description.includes(query);
        });
    }, [projectSummaries, projectSearch]);

    const fileRows = useMemo<FileTableRow[]>(() => {
        if (!selectedProject) return [];

        return selectedProject.dashboards.flatMap((dashboard) => {
            const dashboardRow: FileTableRow = {
                id: `dashboard-${dashboard.id}`,
                type: 'dashboard',
                name: dashboard.name,
                dashboardId: dashboard.id,
                dashboardName: dashboard.name,
            };

            const chartRows: FileTableRow[] = dashboard.charts.map((chart) => ({
                id: `chart-${chart.id}`,
                type: 'chart',
                name: chart.name,
                dashboardId: dashboard.id,
                dashboardName: dashboard.name,
                graphType: chart.graphType,
                graphId: chart.id,
            }));

            return [dashboardRow, ...chartRows];
        });
    }, [selectedProject]);

    useEffect(() => {
        if (error) setShowErrorAlert(true);
    }, [error]);

    useEffect(() => {
        if (message) setShowMessageAlert(true);
    }, [message]);

    useEffect(() => {
        setShowNoProjectsAlert(true);
    }, [projectSummaries.length]);

    useEffect(() => {
        setShowNoSearchResultsAlert(true);
    }, [projectSearch, filteredProjectSummaries.length, projectSummaries.length]);

    useEffect(() => {
        setShowNoSelectedProjectAlert(true);
    }, [selectedProjectId, projectSummaries.length]);

    const openEdit = (summary: ProjectSummary) => {
        setLocalError(null);
        setEditTarget(summary);
        setEditName(summary.project.name);
        setEditDescription(summary.project.description ?? '');
    };

    const openDelete = (summary: ProjectSummary) => {
        setLocalError(null);
        setDeleteTarget(summary);
    };

    const handleEditSave = async () => {
        if (!editTarget) return;
        if (!editName.trim()) {
            setLocalError('Prosjektnavn er påkrevd');
            return;
        }
        setLocalError(null);
        await editProject(editTarget.project.id, editName, editDescription);
        setEditTarget(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        if (deleteTarget.dashboardCount > 0 || deleteTarget.chartCount > 0) {
            setLocalError('Prosjekt med dashboards eller grafer kan ikke slettes');
            return;
        }
        setLocalError(null);
        await deleteProject(deleteTarget.project.id);
        setDeleteTarget(null);
    };

    const openEditDashboard = (projectId: number, dashboardId: number, name: string) => {
        setDashboardMutationError(null);
        setEditDashboardTarget({ id: dashboardId, projectId, name });
    };

    const openDeleteDashboard = (projectId: number, dashboardId: number, name: string) => {
        setDashboardMutationError(null);
        setDeleteDashboardTarget({ id: dashboardId, projectId, name });
    };

    const openCreateDashboard = () => {
        setCreateDashboardError(null);
        setNewDashboardName('');
        setNewDashboardDescription('');
        setIsCreateDashboardOpen(true);
    };

    const handleSaveDashboard = async (params: { name: string; projectId: number }) => {
        if (!editDashboardTarget) return;
        await editDashboard(editDashboardTarget.projectId, editDashboardTarget.id, params);
        setEditDashboardTarget(null);
    };

    const handleDeleteDashboard = async () => {
        if (!deleteDashboardTarget) return;
        if (selectedDashboardHasCharts) {
            setDashboardMutationError('Dashboard med grafer kan ikke slettes');
            return;
        }
        await deleteDashboard(deleteDashboardTarget.projectId, deleteDashboardTarget.id);
        setDeleteDashboardTarget(null);
    };

    const handleCreateDashboard = async () => {
        if (!selectedProject) return;
        if (!newDashboardName.trim()) {
            setCreateDashboardError('Dashboardnavn er påkrevd');
            return;
        }
        setCreateDashboardError(null);
        await createDashboard(
            selectedProject.project.id,
            newDashboardName,
            newDashboardDescription || undefined,
        );
        setIsCreateDashboardOpen(false);
        setNewDashboardName('');
        setNewDashboardDescription('');
    };

    const openImportChart = (defaultDashboardId?: number) => {
        setImportChartError(null);
        setImportChartDefaultDashboardId(defaultDashboardId ?? null);
        setIsImportChartOpen(true);
    };

    const handleImportChart = async (params: {
        dashboardId?: number;
        name: string;
        graphType: ImportGraphType;
        width: string;
        sqlText: string;
    }) => {
        if (!selectedProject) return;
        if (!params.dashboardId) {
            setImportChartError('Velg dashboard');
            return;
        }

        const parsedWidth = Number(params.width);
        if (!Number.isFinite(parsedWidth)) {
            setImportChartError('Bredde må være et tall mellom 1 og 100');
            return;
        }
        const normalizedWidth = Math.max(1, Math.min(100, Math.round(parsedWidth)));

        setImportChartError(null);
        const result = await importChart(selectedProject.project.id, params.dashboardId, {
            name: params.name,
            graphType: params.graphType,
            width: normalizedWidth,
            sqlText: params.sqlText,
        });
        if (!result.ok) {
            setImportChartError(result.error);
            return;
        }
        setIsImportChartOpen(false);
    };

    const toggleCreateProject = () => {
        setIsCreateOpen((prev) => !prev);
        setTimeout(() => {
            projectNameInputRef.current?.focus();
        }, 0);
    };

    const handleCreateProject = async () => {
        const createdProjectId = await createProject();
        if (createdProjectId == null) return;
        setSelectedProjectId(createdProjectId);
        setIsCreateOpen(false);
    };

    const getChartIcon = (graphType?: string) => {
        if (graphType === 'LINE') return <LineGraphIcon aria-hidden fontSize="1rem" />;
        if (graphType === 'BAR') return <BarChartIcon aria-hidden fontSize="1rem" />;
        if (graphType === 'PIE') return <PieChartIcon aria-hidden fontSize="1rem" />;
        return <TableIcon aria-hidden fontSize="1rem" />;
    };

    const getChartTypeLabel = (graphType?: string) => {
        if (graphType === 'LINE') return 'Linjediagram';
        if (graphType === 'BAR') return 'Stolpediagram';
        if (graphType === 'PIE') return 'Sektordiagram';
        if (graphType === 'TABLE') return 'Tabell';
        return 'Graf';
    };

    const normalizeGraphType = (graphType?: string): GraphType => {
        if (graphType === 'LINE' || graphType === 'BAR' || graphType === 'PIE' || graphType === 'TABLE') return graphType;
        return 'TABLE';
    };

    const openEditChart = async (projectId: number, row: FileTableRow) => {
        if (!row.graphId) return;
        setChartMutationError(null);
        try {
            const [queryItems, graphItems] = await Promise.all([
                api.fetchQueries(projectId, row.dashboardId, row.graphId),
                api.fetchGraphs(projectId, row.dashboardId),
            ]);
            const query = queryItems[0];
            if (!query) {
                setChartMutationError('Grafen mangler SQL/query og kan ikke redigeres. Dette skjer ofte hvis import feilet under lagring.');
                return;
            }
            const graph = graphItems.find((item) => item.id === row.graphId);
            const chart: OversiktChart = {
                id: `projectmanager-${row.graphId}`,
                title: row.name,
                type: 'table',
                sql: query.sqlText,
                width: graph?.width ? String(graph.width) : '50',
                graphId: row.graphId,
                graphType: normalizeGraphType(row.graphType ?? graph?.graphType),
                queryId: query.id,
                queryName: query.name,
            };
            setEditChartTarget({
                projectId,
                dashboardId: row.dashboardId,
                chart,
                defaultWebsiteId: extractWebsiteId(query.sqlText),
            });
        } catch (err: unknown) {
            setChartMutationError(err instanceof Error ? err.message : 'Kunne ikke hente grafdata');
        }
    };

    const openDeleteChart = (projectId: number, row: FileTableRow) => {
        if (!row.graphId) return;
        setChartMutationError(null);
        setDeleteChartTarget({
            projectId,
            dashboardId: row.dashboardId,
            graphId: row.graphId,
            name: row.name,
        });
    };

    const openCopyChart = async (projectId: number, row: FileTableRow) => {
        if (!row.graphId) return;
        setCopyChartError(null);
        let sourceWebsiteId: string | undefined;
        try {
            const sourceQueries = await api.fetchQueries(projectId, row.dashboardId, row.graphId);
            const sourceSql = sourceQueries[0]?.sqlText;
            sourceWebsiteId = sourceSql ? extractWebsiteId(sourceSql) : undefined;
        } catch {
            sourceWebsiteId = undefined;
        }

        setCopyChartTarget({
            projectId,
            dashboardId: row.dashboardId,
            graphId: row.graphId,
            name: row.name,
            sourceWebsiteId,
        });
    };

    const handleSaveChart = async (params: {
        name: string;
        graphType: GraphType;
        sqlText: string;
        width: number;
        websiteId?: string;
        dashboardId?: number;
    }) => {
        if (!editChartTarget) return;
        setChartMutationError(null);
        const result = await editChart(editChartTarget.projectId, editChartTarget.dashboardId, editChartTarget.chart.graphId, {
            name: params.name,
            graphType: params.graphType,
            width: params.width,
            sqlText: params.sqlText,
            queryId: editChartTarget.chart.queryId,
            queryName: editChartTarget.chart.queryName,
            websiteId: params.websiteId,
            targetDashboardId: params.dashboardId,
        });
        if (!result.ok) {
            setChartMutationError(result.error);
            return;
        }
        setEditChartTarget(null);
    };

    const handleDeleteChart = async () => {
        if (!deleteChartTarget) return;
        setChartMutationError(null);
        await deleteChart(deleteChartTarget.projectId, deleteChartTarget.dashboardId, deleteChartTarget.graphId);
        setDeleteChartTarget(null);
    };

    const handleCopyChart = async (params: {
        projectId: number;
        projectName: string;
        dashboardId: number;
        dashboardName: string;
        chartName: string;
        websiteId?: string;
    }) => {
        if (!copyChartTarget) return;
        setCopyChartError(null);
        const result = await copyChart({
            sourceProjectId: copyChartTarget.projectId,
            sourceDashboardId: copyChartTarget.dashboardId,
            sourceGraphId: copyChartTarget.graphId,
            targetProjectId: params.projectId,
            targetDashboardId: params.dashboardId,
            chartName: params.chartName,
            websiteId: params.websiteId,
        });
        if (!result.ok) {
            setCopyChartError(result.error);
            return;
        }
        setCopyChartTarget(null);
    };

    const projectOptions: ProjectDto[] = useMemo(
        () => projectSummaries.map((summary) => summary.project),
        [projectSummaries],
    );

    const selectedDashboardHasCharts = useMemo(() => {
        if (!deleteDashboardTarget) return false;
        const project = projectSummaries.find((item) => item.project.id === deleteDashboardTarget.projectId);
        if (!project) return false;
        const dashboard = project.dashboards.find((item) => item.id === deleteDashboardTarget.id);
        return (dashboard?.charts.length ?? 0) > 0;
    }, [projectSummaries, deleteDashboardTarget]);

    const selectedProjectDashboardOptions = useMemo(() => {
        if (!selectedProject) return [];
        return selectedProject.dashboards.map((dashboard) => ({
            id: dashboard.id,
            name: dashboard.name,
        }));
    }, [selectedProject]);

    const dashboardChartCountById = useMemo(() => {
        if (!selectedProject) return new Map<number, number>();
        return new Map(selectedProject.dashboards.map((dashboard) => [dashboard.id, dashboard.charts.length]));
    }, [selectedProject]);

    const isInitialLoading = loading && projectSummaries.length === 0 && !error;

    return (
        <>
            <ProjectManagerLayout
                title="Arbeidsområder"
                description="Samling av dashboards og grafer."
                sidebar={
                    <div className="space-y-2">
                        <form role="search" className="mb-3 flex items-end gap-2">
                            <div className="flex-1">
                                <Search
                                    label="Søk arbeidsområder"
                                    variant="simple"
                                    value={projectSearch}
                                    onChange={setProjectSearch}
                                    onClear={() => setProjectSearch('')}
                                    size="small"
                                />
                            </div>
                            <Tooltip content={isCreateOpen ? 'Lukk nytt arbeidsområde' : 'Nytt arbeidsområde'} describesChild>
                                <Button
                                    type="button"
                                    size="small"
                                    variant="secondary"
                                    icon={<Plus aria-hidden size={16} />}
                                    aria-label={isCreateOpen ? 'Lukk nytt arbeidsområde' : 'Nytt arbeidsområde'}
                                    onClick={toggleCreateProject}
                                />
                            </Tooltip>
                        </form>

                        {isInitialLoading && (
                            <div className="py-4 flex justify-center">
                                <Loader size="medium" title="Laster arbeidsområder" />
                            </div>
                        )}
                        {!isInitialLoading && projectSummaries.length === 0 && showNoProjectsAlert && (
                            <Alert variant="info" size="small" closeButton onClose={() => setShowNoProjectsAlert(false)}>
                                Ingen arbeidsområder funnet.
                            </Alert>
                        )}
                        {!isInitialLoading && projectSummaries.length > 0 && filteredProjectSummaries.length === 0 && showNoSearchResultsAlert && (
                            <Alert variant="info" size="small" closeButton onClose={() => setShowNoSearchResultsAlert(false)}>
                                Ingen treff for sok.
                            </Alert>
                        )}

                        {!isInitialLoading && filteredProjectSummaries.map((summary) => {
                            const isActive = summary.project.id === selectedProjectId;
                            return (
                                <div
                                    key={summary.project.id}
                                    className={`w-full text-left px-3 py-2 rounded-md border transition ${isActive
                                        ? 'bg-[var(--ax-bg-accent-moderate)] border-[var(--ax-border-accent)]'
                                        : 'bg-[var(--ax-bg-default)] border-[var(--ax-border-neutral-subtle)] hover:bg-[var(--ax-bg-neutral-moderate)]'
                                        }`}
                                >
                                    <button
                                        type="button"
                                        className="w-full text-left px-0.5"
                                        onClick={() => setSelectedProjectId(summary.project.id)}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-medium text-sm truncate">{summary.project.name}</div>
                                            <div className="flex items-center gap-3 text-xs text-[var(--ax-text-subtle)] shrink-0">
                                                <span
                                                    className="inline-flex items-center gap-1"
                                                    title={`${summary.dashboardCount} dashboards`}
                                                >
                                                    <SquareGridIcon aria-hidden fontSize="0.9rem" />
                                                    {summary.dashboardCount}
                                                    <span className="sr-only"> dashboards</span>
                                                </span>
                                                <span
                                                    className="inline-flex items-center gap-1"
                                                    title={`${summary.chartCount} grafer`}
                                                >
                                                    <BarChartIcon aria-hidden fontSize="0.9rem" />
                                                    {summary.chartCount}
                                                    <span className="sr-only"> grafer</span>
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            );
                        })}

                        {!isInitialLoading && (
                            <div className="pt-2">
                            <Button
                                type="button"
                                size="small"
                                variant="secondary"
                                icon={<Plus aria-hidden size={16} />}
                                onClick={toggleCreateProject}
                            >
                                Nytt arbeidsområde
                            </Button>
                            </div>
                        )}
                    </div>
                }
            >
                <div className="space-y-4">
                    {error && showErrorAlert && (
                        <Alert variant="error" closeButton onClose={() => setShowErrorAlert(false)}>
                            {error}
                        </Alert>
                    )}
                    {message && showMessageAlert && (
                        <Alert variant="success" closeButton onClose={() => setShowMessageAlert(false)}>
                            {message}
                        </Alert>
                    )}
                    {chartMutationError && !editChartTarget && !deleteChartTarget && (
                        <Alert variant="error" closeButton onClose={() => setChartMutationError(null)}>
                            {chartMutationError}
                        </Alert>
                    )}

                    {isInitialLoading && (
                        <div className="py-8 flex justify-center">
                            <Loader size="xlarge" title="Laster arbeidsområder og dashboards" />
                        </div>
                    )}

                    {!isInitialLoading && !selectedProject && showNoSelectedProjectAlert && (
                        <Alert variant="info" size="small" closeButton onClose={() => setShowNoSelectedProjectAlert(false)}>
                            Velg et arbeidsområde for a se dashboards og grafer.
                        </Alert>
                    )}

                    {!isInitialLoading && selectedProject && (
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                                <Heading level="2" size="small">{selectedProject.project.name}</Heading>
                                {selectedProject.project.description && (
                                    <BodyShort size="small" className="text-[var(--ax-text-default)] opacity-80">
                                        {selectedProject.project.description}
                                    </BodyShort>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <ActionMenu>
                                    <Tooltip content="Legg til dashboard eller graf" describesChild>
                                        <ActionMenu.Trigger>
                                            <Button type="button" size="xsmall" variant="secondary">
                                                + legg til
                                            </Button>
                                        </ActionMenu.Trigger>
                                    </Tooltip>
                                    <ActionMenu.Content align="end">
                                        <ActionMenu.Item onClick={openCreateDashboard}>
                                            Legg til dashboard
                                        </ActionMenu.Item>
                                        <ActionMenu.Item
                                            onClick={openImportChart}
                                            disabled={selectedProjectDashboardOptions.length === 0}
                                        >
                                            Importer graf
                                        </ActionMenu.Item>
                                        <ActionMenu.Item as="a" href="/grafbygger">
                                            Legg til graf
                                        </ActionMenu.Item>
                                    </ActionMenu.Content>
                                </ActionMenu>
                                <ActionMenu>
                                    <ActionMenu.Trigger>
                                        <Button
                                            variant="tertiary"
                                            size="xsmall"
                                            icon={<MoreVertical aria-hidden />}
                                            aria-label={`Flere valg for ${selectedProject.project.name}`}
                                        />
                                    </ActionMenu.Trigger>
                                    <ActionMenu.Content align="end">
                                        <ActionMenu.Item onClick={() => openEdit(selectedProject)}>
                                            Rediger
                                        </ActionMenu.Item>
                                        <ActionMenu.Item onClick={() => openDelete(selectedProject)}>
                                            Slett
                                        </ActionMenu.Item>
                                    </ActionMenu.Content>
                                </ActionMenu>
                            </div>
                        </div>
                    )}

                    {!isInitialLoading && selectedProject && fileRows.length === 0 && (
                        <div className="rounded-md border border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-neutral-soft)] px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-[var(--ax-text-default)]">Prosjektet er tomt</span>
                                <Button size="xsmall" variant="secondary" onClick={openCreateDashboard}>
                                    Opprett første dashboard
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isInitialLoading && selectedProject && fileRows.length > 0 && (
                        <Table size="small">
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell scope="col">Navn</Table.HeaderCell>
                                    <Table.HeaderCell scope="col">Type</Table.HeaderCell>
                                    <Table.HeaderCell scope="col" className="w-0">
                                        <span className="sr-only">Handlinger</span>
                                    </Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {fileRows.map((row) => {
                                    const isChartRow = row.type === 'chart';
                                    const overviewHref = `/oversikt?projectId=${selectedProject.project.id}&dashboardId=${row.dashboardId}`;
                                    const isEmptyDashboardRow = row.type === 'dashboard' && (dashboardChartCountById.get(row.dashboardId) ?? 0) === 0;
                                    return (
                                        <Fragment key={row.id}>
                                            <Table.Row>
                                                <Table.HeaderCell scope="row">
                                                    <span className={`inline-flex items-center gap-2 min-w-0 ${isChartRow ? 'pl-6' : ''}`}>
                                                        <span className="text-[var(--ax-text-subtle)]">
                                                            {row.type === 'dashboard' ? (
                                                                <SquareGridIcon aria-hidden fontSize="1rem" />
                                                            ) : (
                                                                getChartIcon(row.graphType)
                                                            )}
                                                        </span>
                                                        <Link href={overviewHref}>{row.name}</Link>
                                                    </span>
                                                </Table.HeaderCell>
                                                <Table.DataCell>
                                                    {row.type === 'dashboard' ? 'Dashboard' : getChartTypeLabel(row.graphType)}
                                                </Table.DataCell>
                                                <Table.DataCell>
                                                    <div className="flex justify-end">
                                                        {row.type === 'chart' ? (
                                                            <ActionMenu>
                                                                <ActionMenu.Trigger>
                                                                    <Button
                                                                        variant="tertiary"
                                                                        size="xsmall"
                                                                        icon={<MoreVertical aria-hidden />}
                                                                        aria-label={`Flere valg for ${row.name}`}
                                                                    />
                                                                </ActionMenu.Trigger>
                                                                <ActionMenu.Content align="end">
                                                                    <ActionMenu.Item as="a" href={overviewHref}>
                                                                        Åpne i dashboard
                                                                    </ActionMenu.Item>
                                                                    {selectedProject && (
                                                                        <ActionMenu.Item
                                                                            onClick={() => void openEditChart(selectedProject.project.id, row)}
                                                                        >
                                                                            Rediger graf
                                                                        </ActionMenu.Item>
                                                                    )}
                                                                    {selectedProject && (
                                                                        <ActionMenu.Item
                                                                            onClick={() => void openCopyChart(selectedProject.project.id, row)}
                                                                        >
                                                                            Kopier graf
                                                                        </ActionMenu.Item>
                                                                    )}
                                                                    {selectedProject && (
                                                                        <ActionMenu.Item
                                                                            onClick={() => openDeleteChart(selectedProject.project.id, row)}
                                                                        >
                                                                            Slett graf
                                                                        </ActionMenu.Item>
                                                                    )}
                                                                </ActionMenu.Content>
                                                            </ActionMenu>
                                                        ) : (
                                                            <ActionMenu>
                                                                <ActionMenu.Trigger>
                                                                    <Button
                                                                        variant="tertiary"
                                                                        size="xsmall"
                                                                        icon={<MoreVertical aria-hidden />}
                                                                        aria-label={`Flere valg for ${row.name}`}
                                                                    />
                                                                </ActionMenu.Trigger>
                                                                <ActionMenu.Content align="end">
                                                                    {selectedProject && (
                                                                        <ActionMenu.Item
                                                                            onClick={() => openEditDashboard(selectedProject.project.id, row.dashboardId, row.name)}
                                                                        >
                                                                            Rediger dashboard
                                                                        </ActionMenu.Item>
                                                                    )}
                                                                    {selectedProject && (
                                                                        <ActionMenu.Item
                                                                            onClick={() => openDeleteDashboard(selectedProject.project.id, row.dashboardId, row.name)}
                                                                        >
                                                                            Slett dashboard
                                                                        </ActionMenu.Item>
                                                                    )}
                                                                </ActionMenu.Content>
                                                            </ActionMenu>
                                                        )}
                                                    </div>
                                                </Table.DataCell>
                                            </Table.Row>
                                            {isEmptyDashboardRow && (
                                                <Table.Row>
                                                    <Table.HeaderCell scope="row">
                                                        <div className="inline-flex items-center gap-2 pl-6">
                                                            <span className="text-[var(--ax-text-subtle)]">
                                                                <Plus aria-hidden size={14} />
                                                            </span>
                                                            <ActionMenu>
                                                                <ActionMenu.Trigger>
                                                                    <Button size="xsmall" variant="tertiary">
                                                                        Legg til
                                                                    </Button>
                                                                </ActionMenu.Trigger>
                                                                <ActionMenu.Content align="start">
                                                                    <ActionMenu.Item onClick={() => openImportChart(row.dashboardId)}>
                                                                        Importer graf
                                                                    </ActionMenu.Item>
                                                                    <ActionMenu.Item as="a" href="/grafbygger">
                                                                        Legg til graf
                                                                    </ActionMenu.Item>
                                                                </ActionMenu.Content>
                                                            </ActionMenu>
                                                        </div>
                                                    </Table.HeaderCell>
                                                    <Table.DataCell />
                                                    <Table.DataCell />
                                                </Table.Row>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    )}
                </div>
            </ProjectManagerLayout>

            <Modal
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                header={{ heading: 'Nytt arbeidsområde' }}
                width="small"
            >
                <Modal.Body>
                    <div className="space-y-3">
                        <TextField
                            label="Prosjektnavn"
                            size="small"
                            ref={projectNameInputRef}
                            value={newProjectName}
                            onChange={(event) => setNewProjectName(event.target.value)}
                        />
                        <TextField
                            label="Beskrivelse (valgfri)"
                            size="small"
                            value={newProjectDescription}
                            onChange={(event) => setNewProjectDescription(event.target.value)}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button size="small" onClick={() => void handleCreateProject()} loading={loading}>
                        Opprett
                    </Button>
                    <Button size="small" variant="secondary" onClick={() => setIsCreateOpen(false)}>
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal
                open={!!editTarget}
                onClose={() => {
                    setEditTarget(null);
                    setLocalError(null);
                }}
                header={{ heading: 'Rediger arbeidsområde' }}
                width="small"
            >
                <Modal.Body>
                    <div className="space-y-4">
                        {localError && <Alert variant="error" size="small">{localError}</Alert>}
                        <TextField
                            label="Prosjektnavn"
                            size="small"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                        />
                        <TextField
                            label="Beskrivelse (valgfri)"
                            size="small"
                            value={editDescription}
                            onChange={(event) => setEditDescription(event.target.value)}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={() => void handleEditSave()} loading={loading}>
                        Lagre
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setEditTarget(null);
                            setLocalError(null);
                        }}
                        disabled={loading}
                    >
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>

            <EditDashboardDialog
                key={editDashboardTarget ? `edit-dashboard-${editDashboardTarget.id}-${editDashboardTarget.projectId}` : 'edit-dashboard-dialog'}
                open={!!editDashboardTarget}
                dashboard={editDashboardTarget}
                projects={projectOptions}
                loading={loading}
                error={dashboardMutationError}
                onClose={() => {
                    setEditDashboardTarget(null);
                    setDashboardMutationError(null);
                }}
                onSave={handleSaveDashboard}
            />

            <Modal
                open={isCreateDashboardOpen}
                onClose={() => {
                    setIsCreateDashboardOpen(false);
                    setCreateDashboardError(null);
                }}
                header={{ heading: 'Nytt dashboard' }}
                width="small"
            >
                <Modal.Body>
                    <div className="space-y-4">
                        {createDashboardError && <Alert variant="error" size="small">{createDashboardError}</Alert>}
                        <TextField
                            label="Dashboardnavn"
                            size="small"
                            value={newDashboardName}
                            onChange={(event) => setNewDashboardName(event.target.value)}
                        />
                        <TextField
                            label="Beskrivelse (valgfri)"
                            size="small"
                            value={newDashboardDescription}
                            onChange={(event) => setNewDashboardDescription(event.target.value)}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={() => void handleCreateDashboard()} loading={loading}>
                        Opprett
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setIsCreateDashboardOpen(false);
                            setCreateDashboardError(null);
                        }}
                        disabled={loading}
                    >
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>

            {isImportChartOpen && (
                <ImportChartDialog
                    open={isImportChartOpen}
                    loading={loading}
                    error={importChartError}
                    dashboardOptions={selectedProjectDashboardOptions}
                    defaultDashboardId={importChartDefaultDashboardId ?? selectedProjectDashboardOptions[0]?.id ?? null}
                    onClose={() => {
                        setIsImportChartOpen(false);
                        setImportChartError(null);
                        setImportChartDefaultDashboardId(null);
                    }}
                    onImport={handleImportChart}
                />
            )}

            <CopyChartDialog
                open={!!copyChartTarget}
                chart={copyChartTarget ? { title: copyChartTarget.name } : null}
                projects={projectOptions}
                selectedProjectId={selectedProjectId}
                selectedDashboardId={copyChartTarget?.dashboardId ?? null}
                sourceWebsiteId={copyChartTarget?.sourceWebsiteId}
                loading={loading}
                error={copyChartError}
                onClose={() => {
                    setCopyChartTarget(null);
                    setCopyChartError(null);
                }}
                loadDashboards={api.fetchDashboards}
                onCopy={handleCopyChart}
            />

            <DeleteDashboardDialog
                open={!!deleteDashboardTarget}
                dashboard={deleteDashboardTarget}
                hasCharts={selectedDashboardHasCharts}
                loading={loading}
                error={dashboardMutationError}
                onClose={() => {
                    setDeleteDashboardTarget(null);
                    setDashboardMutationError(null);
                }}
                onConfirm={handleDeleteDashboard}
            />

            <EditChartDialog
                key={editChartTarget ? `edit-chart-${editChartTarget.chart.graphId}` : 'edit-chart-dialog'}
                open={!!editChartTarget}
                chart={editChartTarget?.chart ?? null}
                defaultWebsiteId={editChartTarget?.defaultWebsiteId}
                dashboardOptions={selectedProjectDashboardOptions}
                defaultDashboardId={editChartTarget?.dashboardId ?? null}
                loading={loading}
                error={chartMutationError}
                onClose={() => {
                    setEditChartTarget(null);
                    setChartMutationError(null);
                }}
                onSave={handleSaveChart}
            />

            <Modal
                open={!!deleteChartTarget}
                onClose={() => {
                    setDeleteChartTarget(null);
                    setChartMutationError(null);
                }}
                header={{ heading: 'Slett graf' }}
                width="small"
            >
                <Modal.Body>
                    <div className="space-y-4">
                        {chartMutationError && <Alert variant="error" size="small">{chartMutationError}</Alert>}
                        <BodyShort>
                            Er du sikker på at du vil slette grafen <strong>{deleteChartTarget?.name}</strong>?
                        </BodyShort>
                        <BodyShort size="small" className="text-[var(--ax-text-subtle)]">
                            Denne handlingen kan ikke angres.
                        </BodyShort>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="danger" onClick={() => void handleDeleteChart()} loading={loading}>
                        Slett graf
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setDeleteChartTarget(null);
                            setChartMutationError(null);
                        }}
                        disabled={loading}
                    >
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal
                open={!!deleteTarget}
                onClose={() => {
                    setDeleteTarget(null);
                    setLocalError(null);
                }}
                header={{ heading: 'Slett arbeidsområde' }}
                width="small"
            >
                <Modal.Body>
                    <div className="space-y-4">
                        {localError && <Alert variant="error" size="small">{localError}</Alert>}
                        <BodyShort>
                            Er du sikker på at du vil slette arbeidsområdet <strong>{deleteTarget?.project.name}</strong>?
                        </BodyShort>
                        {(deleteTarget?.dashboardCount ?? 0) > 0 || (deleteTarget?.chartCount ?? 0) > 0 ? (
                            <Alert variant="warning" size="small">
                                Prosjekt med dashboards eller grafer kan ikke slettes.
                            </Alert>
                        ) : (
                            <BodyShort size="small" className="text-[var(--ax-text-subtle)]">
                                Denne handlingen kan ikke angres.
                            </BodyShort>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    {(deleteTarget?.dashboardCount ?? 0) === 0 && (deleteTarget?.chartCount ?? 0) === 0 && (
                        <Button variant="danger" onClick={() => void handleDeleteConfirm()} loading={loading}>
                            Slett arbeidsområde
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setDeleteTarget(null);
                            setLocalError(null);
                        }}
                        disabled={loading}
                    >
                        Lukk
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default ProjectManager;
