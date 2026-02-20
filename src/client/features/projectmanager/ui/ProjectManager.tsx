import { useState } from 'react';
import { Alert, BodyShort, Button, Heading, Modal, Page, TextField } from '@navikt/ds-react';
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

                    <section className="p-4 border border-[var(--ax-border-neutral-subtle)] rounded-md bg-[var(--ax-bg-default)]">
                        <Heading level="2" size="small" spacing>Nytt prosjekt</Heading>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                            <TextField
                                label="Prosjektnavn"
                                size="small"
                                value={newProjectName}
                                onChange={(event) => setNewProjectName(event.target.value)}
                            />
                            <TextField
                                label="Beskrivelse (valgfri)"
                                size="small"
                                value={newProjectDescription}
                                onChange={(event) => setNewProjectDescription(event.target.value)}
                            />
                            <Button size="small" onClick={createProject} loading={loading}>
                                Opprett prosjekt
                            </Button>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <Heading level="2" size="small">Prosjektliste</Heading>
                        {projectSummaries.length === 0 && (
                            <Alert variant="info" size="small">Ingen prosjekter funnet.</Alert>
                        )}

                        {projectSummaries.map((summary) => (
                            <article
                                key={summary.project.id}
                                className="p-4 border border-[var(--ax-border-neutral-subtle)] rounded-md bg-[var(--ax-bg-default)]"
                            >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="space-y-1">
                                        <Heading level="3" size="xsmall">{summary.project.name}</Heading>
                                        {summary.project.description && (
                                            <BodyShort size="small" className="text-[var(--ax-text-subtle)]">
                                                {summary.project.description}
                                            </BodyShort>
                                        )}
                                        <BodyShort size="small">
                                            Dashboards: <strong>{summary.dashboardCount}</strong> · Grafer: <strong>{summary.chartCount}</strong>
                                        </BodyShort>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button size="small" variant="secondary" onClick={() => openEdit(summary)}>
                                            Rediger
                                        </Button>
                                        <Button size="small" variant="secondary" onClick={() => openDelete(summary)}>
                                            Slett
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        ))}
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
