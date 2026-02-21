import { useState } from 'react';
import { Alert, Button, Modal, Select, Textarea, TextField } from '@navikt/ds-react';

type GraphType = 'LINE' | 'BAR' | 'PIE' | 'TABLE';

type DashboardOption = {
    id: number;
    name: string;
};

type ImportChartDialogProps = {
    open: boolean;
    loading?: boolean;
    error?: string | null;
    dashboardOptions?: DashboardOption[];
    defaultDashboardId?: number | null;
    onClose: () => void;
    onImport: (params: {
        dashboardId?: number;
        name: string;
        graphType: GraphType;
        width: string;
        sqlText: string;
    }) => Promise<void>;
};

const ImportChartDialog = ({
    open,
    loading = false,
    error,
    dashboardOptions,
    defaultDashboardId = null,
    onClose,
    onImport,
}: ImportChartDialogProps) => {
    const initialDashboardId = dashboardOptions && dashboardOptions.length > 0
        ? (defaultDashboardId && dashboardOptions.some((item) => item.id === defaultDashboardId)
            ? defaultDashboardId
            : dashboardOptions[0].id)
        : null;
    const [name, setName] = useState('');
    const [graphType, setGraphType] = useState<GraphType>('TABLE');
    const [width, setWidth] = useState('50');
    const [sqlText, setSqlText] = useState('');
    const [dashboardId, setDashboardId] = useState<number | null>(initialDashboardId);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleImport = async () => {
        if (!name.trim()) {
            setLocalError('Grafnavn er påkrevd');
            return;
        }
        if (!sqlText.trim()) {
            setLocalError('SQL-kode er påkrevd');
            return;
        }
        if (dashboardOptions && dashboardOptions.length > 0 && !dashboardId) {
            setLocalError('Velg dashboard');
            return;
        }
        setLocalError(null);
        await onImport({
            dashboardId: dashboardId ?? undefined,
            name: name.trim(),
            graphType,
            width,
            sqlText: sqlText.trim(),
        });
    };

    return (
        <Modal
            open={open}
            onClose={() => {
                if (loading) return;
                onClose();
            }}
            header={{ heading: 'Importer graf fra SQL' }}
            width="medium"
        >
            <Modal.Body>
                <div className="flex flex-col gap-4">
                    {localError && <Alert variant="error">{localError}</Alert>}
                    {error && <Alert variant="error">{error}</Alert>}

                    {dashboardOptions && dashboardOptions.length > 0 && (
                        <Select
                            label="Dashboard"
                            value={dashboardId ? String(dashboardId) : ''}
                            onChange={(event) => setDashboardId(Number(event.target.value))}
                            size="small"
                        >
                            <option value="">Velg dashboard</option>
                            {dashboardOptions.map((dashboard) => (
                                <option key={dashboard.id} value={dashboard.id}>
                                    {dashboard.name}
                                </option>
                            ))}
                        </Select>
                    )}

                    <TextField
                        label="Grafnavn"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        size="small"
                    />
                    <Select
                        label="Graftype"
                        value={graphType}
                        onChange={(event) => setGraphType(event.target.value as GraphType)}
                        size="small"
                    >
                        <option value="LINE">Linjediagram</option>
                        <option value="BAR">Stolpediagram</option>
                        <option value="PIE">Sektordiagram</option>
                        <option value="TABLE">Tabell</option>
                    </Select>
                    <TextField
                        label="Bredde (%)"
                        description="Standardbredden er 50%"
                        value={width}
                        onChange={(event) => setWidth(event.target.value)}
                        size="small"
                    />
                    <Textarea
                        label="SQL-kode"
                        description="Lim inn SQL-spørringen du vil importere som graf."
                        minRows={10}
                        value={sqlText}
                        onChange={(event) => setSqlText(event.target.value)}
                    />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={() => void handleImport()} loading={loading}>
                    Importer graf
                </Button>
                <Button variant="secondary" onClick={onClose} disabled={loading}>
                    Avbryt
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ImportChartDialog;
