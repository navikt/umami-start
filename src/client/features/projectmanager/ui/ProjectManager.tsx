import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChartIcon, LineGraphIcon, PieChartIcon, SquareGridIcon, TableIcon } from '@navikt/aksel-icons';
import { MoreVertical, Plus } from 'lucide-react';
import { ActionMenu, Alert, BodyShort, Button, Heading, Link, Modal, Search, Table, TextField } from '@navikt/ds-react';
import DeleteDashboardDialog from '../../oversikt/ui/dialogs/DeleteDashboardDialog.tsx';
import EditDashboardDialog from '../../oversikt/ui/dialogs/EditDashboardDialog.tsx';
import { useProjectManager } from '../hooks/useProjectManager.ts';
import type { ProjectSummary } from '../hooks/useProjectManager.ts';
import type { DashboardDto, ProjectDto } from '../model/types.ts';
import ProjectManagerLayout from './ProjectManagerLayout.tsx';

type FileTableRow = {
    id: string;
    type: 'dashboard' | 'chart';
    name: string;
    dashboardId: number;
    dashboardName: string;
    graphType?: string;
    graphId?: number;
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
        deleteProject,
        editDashboard,
        deleteDashboard,
        deleteChart,
        editChart,
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
    const [editChartTarget, setEditChartTarget] = useState<{
        projectId: number;
        dashboardId: number;
        graphId: number;
        graphType: string;
        name: string;
    } | null>(null);
    const [editChartName, setEditChartName] = useState('');
    const [deleteChartTarget, setDeleteChartTarget] = useState<{
        projectId: number;
        dashboardId: number;
        graphId: number;
        name: string;
    } | null>(null);
    const [chartMutationError, setChartMutationError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
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

    const toggleCreateProject = () => {
        setIsCreateOpen((prev) => !prev);
        setTimeout(() => {
            projectNameInputRef.current?.focus();
        }, 0);
    };

    const getChartIcon = (graphType?: string) => {
        if (graphType === 'LINE') return <LineGraphIcon aria-hidden fontSize="1rem" />;
        if (graphType === 'BAR') return <BarChartIcon aria-hidden fontSize="1rem" />;
        if (graphType === 'PIE') return <PieChartIcon aria-hidden fontSize="1rem" />;
        return <TableIcon aria-hidden fontSize="1rem" />;
    };

    const openEditChart = (projectId: number, row: FileTableRow) => {
        if (!row.graphId) return;
        setChartMutationError(null);
        setEditChartTarget({
            projectId,
            dashboardId: row.dashboardId,
            graphId: row.graphId,
            graphType: row.graphType ?? 'TABLE',
            name: row.name,
        });
        setEditChartName(row.name);
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

    const handleSaveChart = async () => {
        if (!editChartTarget) return;
        if (!editChartName.trim()) {
            setChartMutationError('Grafnavn er påkrevd');
            return;
        }
        setChartMutationError(null);
        await editChart(editChartTarget.projectId, editChartTarget.dashboardId, editChartTarget.graphId, {
            name: editChartName.trim(),
            graphType: editChartTarget.graphType,
        });
        setEditChartTarget(null);
    };

    const handleDeleteChart = async () => {
        if (!deleteChartTarget) return;
        setChartMutationError(null);
        await deleteChart(deleteChartTarget.projectId, deleteChartTarget.dashboardId, deleteChartTarget.graphId);
        setDeleteChartTarget(null);
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

    return (
        <>
            <ProjectManagerLayout
                title="Prosjekter"
                description="Prosjekter, dashboards og grafer."
                sidebar={
                    <div className="space-y-2">
                        <form role="search" className="mb-3 flex items-end gap-2">
                            <div className="flex-1">
                                <Search
                                    label="Søk prosjekter"
                                    variant="simple"
                                    value={projectSearch}
                                    onChange={setProjectSearch}
                                    onClear={() => setProjectSearch('')}
                                    size="small"
                                />
                            </div>
                            <Button
                                type="button"
                                size="small"
                                variant="secondary"
                                icon={<Plus aria-hidden size={16} />}
                                aria-label={isCreateOpen ? 'Lukk nytt prosjekt' : 'Nytt prosjekt'}
                                onClick={toggleCreateProject}
                            />
                        </form>

                        {projectSummaries.length === 0 && (
                            <Alert variant="info" size="small">Ingen prosjekter funnet.</Alert>
                        )}
                        {projectSummaries.length > 0 && filteredProjectSummaries.length === 0 && (
                            <Alert variant="info" size="small">Ingen treff for sok.</Alert>
                        )}

                        {filteredProjectSummaries.map((summary) => {
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
                                        <div className="font-medium text-sm truncate">{summary.project.name}</div>
                                        <div className="text-xs text-[var(--ax-text-subtle)] mt-1">
                                            {summary.dashboardCount} dashboards | {summary.chartCount} grafer
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                }
            >
                <div className="space-y-4">
                    {error && <Alert variant="error">{error}</Alert>}
                    {message && <Alert variant="success">{message}</Alert>}

                    {isCreateOpen && (
                        <section className="p-4 border border-[var(--ax-border-neutral-subtle)] rounded-md bg-[var(--ax-bg-default)]">
                            <Heading level="3" size="xsmall" spacing>Nytt prosjekt</Heading>
                            <div className="flex flex-col md:flex-row md:items-end gap-3">
                                <div className="w-full md:w-[320px]">
                                    <TextField
                                        label="Prosjektnavn"
                                        size="small"
                                        ref={projectNameInputRef}
                                        value={newProjectName}
                                        onChange={(event) => setNewProjectName(event.target.value)}
                                    />
                                </div>
                                <div className="w-full md:w-[420px]">
                                    <TextField
                                        label="Beskrivelse (valgfri)"
                                        size="small"
                                        value={newProjectDescription}
                                        onChange={(event) => setNewProjectDescription(event.target.value)}
                                    />
                                </div>
                                <Button
                                    size="small"
                                    onClick={createProject}
                                    loading={loading}
                                >
                                    Opprett
                                </Button>
                            </div>
                        </section>
                    )}

                    {!selectedProject && (
                        <Alert variant="info" size="small">Velg et prosjekt for a se dashboards og grafer.</Alert>
                    )}

                    {selectedProject && (
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                                <Heading level="2" size="small">{selectedProject.project.name}</Heading>
                                {selectedProject.project.description && (
                                    <BodyShort size="small" className="text-[var(--ax-text-default)] opacity-80">
                                        {selectedProject.project.description}
                                    </BodyShort>
                                )}
                            </div>
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
                    )}

                    {selectedProject && fileRows.length === 0 && (
                        <Alert variant="info" size="small">Prosjektet inneholder ingen dashboards eller grafer ennå.</Alert>
                    )}

                    {selectedProject && fileRows.length > 0 && (
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
                                    return (
                                        <Table.Row key={row.id}>
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
                                            <Table.DataCell>{row.type === 'dashboard' ? 'Dashboard' : 'Graf'}</Table.DataCell>
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
                                                                        onClick={() => openEditChart(selectedProject.project.id, row)}
                                                                    >
                                                                        Rediger graf
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
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    )}
                </div>
            </ProjectManagerLayout>

            <Modal
                open={!!editTarget}
                onClose={() => {
                    setEditTarget(null);
                    setLocalError(null);
                }}
                header={{ heading: 'Rediger prosjekt' }}
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

            <Modal
                open={!!editChartTarget}
                onClose={() => {
                    setEditChartTarget(null);
                    setChartMutationError(null);
                }}
                header={{ heading: 'Rediger graf' }}
                width="small"
            >
                <Modal.Body>
                    <div className="space-y-4">
                        {chartMutationError && <Alert variant="error" size="small">{chartMutationError}</Alert>}
                        <TextField
                            label="Grafnavn"
                            size="small"
                            value={editChartName}
                            onChange={(event) => setEditChartName(event.target.value)}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={() => void handleSaveChart()} loading={loading}>
                        Lagre
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setEditChartTarget(null);
                            setChartMutationError(null);
                        }}
                        disabled={loading}
                    >
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>

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
                header={{ heading: 'Slett prosjekt' }}
                width="small"
            >
                <Modal.Body>
                    <div className="space-y-4">
                        {localError && <Alert variant="error" size="small">{localError}</Alert>}
                        <BodyShort>
                            Er du sikker på at du vil slette prosjektet <strong>{deleteTarget?.project.name}</strong>?
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
                            Slett prosjekt
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
