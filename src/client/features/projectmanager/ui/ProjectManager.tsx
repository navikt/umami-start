import { useRef, useState } from 'react';
import { Alert, BodyShort, Button, Heading, Link, Modal, Page, Table, TextField } from '@navikt/ds-react';
import { PageHeader } from '../../../shared/ui/theme/PageHeader/PageHeader.tsx';
import { useProjectManager } from '../hooks/useProjectManager.ts';
import type { ProjectSummary } from '../hooks/useProjectManager.ts';

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
    } = useProjectManager();

    const [editTarget, setEditTarget] = useState<ProjectSummary | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const projectNameInputRef = useRef<HTMLInputElement | null>(null);
    const totalProjects = projectSummaries.length;
    const totalDashboards = projectSummaries.reduce((sum, item) => sum + item.dashboardCount, 0);
    const totalCharts = projectSummaries.reduce((sum, item) => sum + item.chartCount, 0);

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

    return (
        <>
            <PageHeader
                title="Prosjekter"
                description="Administrer prosjekter."
            />

            <Page.Block width="xl" gutters className="pb-12">
                <div className="space-y-6">
                    {error && <Alert variant="error">{error}</Alert>}
                    {message && <Alert variant="success">{message}</Alert>}

                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <article className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Prosjekter totalt</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)]">{totalProjects}</div>
                        </article>
                        <article className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Dashboards totalt</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)]">{totalDashboards}</div>
                        </article>
                        <article className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Grafer totalt</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)]">{totalCharts}</div>
                        </article>
                    </section>

                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <Heading level="2" size="small">Prosjektliste</Heading>
                            <Button
                                size="small"
                                onClick={() => {
                                    setIsCreateOpen((prev) => !prev);
                                    setTimeout(() => {
                                        projectNameInputRef.current?.focus();
                                    }, 0);
                                }}
                            >
                                {isCreateOpen ? 'Lukk' : 'Legg til nytt prosjekt'}
                            </Button>
                        </div>

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
                                        Opprett prosjekt
                                    </Button>
                                </div>
                            </section>
                        )}

                        {projectSummaries.length === 0 && (
                            <Alert variant="info" size="small">Ingen prosjekter funnet.</Alert>
                        )}
                        {projectSummaries.length > 0 && (
                            <Table size="small">
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell />
                                        <Table.HeaderCell scope="col">Prosjekt</Table.HeaderCell>
                                        <Table.HeaderCell scope="col">Dashboards</Table.HeaderCell>
                                        <Table.HeaderCell scope="col">Grafer</Table.HeaderCell>
                                        <Table.HeaderCell scope="col">Handlinger</Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {projectSummaries.map((summary) => {
                                        return (
                                            <Table.ExpandableRow
                                                key={summary.project.id}
                                                content={
                                                    <div className="space-y-3">
                                                        {summary.dashboards.length === 0 && (
                                                            <BodyShort size="small">Ingen dashboards.</BodyShort>
                                                        )}
                                                        {summary.dashboards.map((dashboard) => (
                                                            <div key={dashboard.id} className="p-3 rounded border border-[var(--ax-border-neutral-subtle)]">
                                                                <div className="font-semibold mb-1">
                                                                    <Link href={`/oversikt?projectId=${summary.project.id}&dashboardId=${dashboard.id}`}>
                                                                        {dashboard.name}
                                                                    </Link>
                                                                </div>
                                                                {dashboard.charts.length === 0 ? (
                                                                    <BodyShort size="small">Ingen grafer.</BodyShort>
                                                                ) : (
                                                                    <ul className="list-disc pl-5 space-y-1">
                                                                        {dashboard.charts.map((chart) => (
                                                                            <li key={chart.id}>{chart.name}</li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                }
                                                togglePlacement="left"
                                            >
                                                <Table.HeaderCell scope="row">{summary.project.name}</Table.HeaderCell>
                                                <Table.DataCell>{summary.dashboardCount}</Table.DataCell>
                                                <Table.DataCell>{summary.chartCount}</Table.DataCell>
                                                <Table.DataCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="xsmall"
                                                            variant="secondary"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openEdit(summary);
                                                            }}
                                                        >
                                                            Rediger
                                                        </Button>
                                                        <Button
                                                            size="xsmall"
                                                            variant="secondary"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openDelete(summary);
                                                            }}
                                                        >
                                                            Slett
                                                        </Button>
                                                    </div>
                                                </Table.DataCell>
                                            </Table.ExpandableRow>
                                        );
                                    })}
                                </Table.Body>
                            </Table>
                        )}
                    </section>
                </div>
            </Page.Block>

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
