import { useState } from 'react';
import { Alert, Button, Modal, Select, TextField } from '@navikt/ds-react';
import type { DashboardDto, ProjectDto } from '../../model/types.ts';

type EditDashboardDialogProps = {
    open: boolean;
    dashboard: DashboardDto | null;
    projects: ProjectDto[];
    loading?: boolean;
    error?: string | null;
    onClose: () => void;
    onSave: (params: { name: string; projectId: number }) => Promise<void>;
};

const EditDashboardDialog = ({
    open,
    dashboard,
    projects,
    loading = false,
    error,
    onClose,
    onSave,
}: EditDashboardDialogProps) => {
    const [name, setName] = useState(dashboard?.name ?? '');
    const [projectId, setProjectId] = useState<number>(dashboard?.projectId ?? 0);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!dashboard) return;
        if (!name.trim()) {
            setLocalError('Dashboardnavn er påkrevd');
            return;
        }
        if (!projectId) {
            setLocalError('Velg arbeidsområde');
            return;
        }
        setLocalError(null);
        await onSave({ name: name.trim(), projectId });
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            header={{ heading: 'Rediger dashboard' }}
            width="small"
        >
            <Modal.Body>
                <div className="flex flex-col gap-4">
                    {localError && <Alert variant="error">{localError}</Alert>}
                    {error && <Alert variant="error">{error}</Alert>}
                    <TextField
                        label="Dashboardnavn"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        size="small"
                    />
                    <Select
                        label="Arbeidsområde"
                        value={projectId ? String(projectId) : ''}
                        onChange={(event) => setProjectId(Number(event.target.value))}
                        size="small"
                    >
                        <option value="">Velg arbeidsområde</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </Select>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={() => void handleSave()} loading={loading}>
                    Lagre endringer
                </Button>
                <Button variant="secondary" onClick={onClose} disabled={loading}>
                    Avbryt
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EditDashboardDialog;
