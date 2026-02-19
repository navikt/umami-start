import { useState } from 'react';
import { Alert, Button, Modal, Select, Switch, Textarea, TextField } from '@navikt/ds-react';
import type { GraphType, OversiktChart } from '../../model/types.ts';

type EditChartDialogProps = {
    open: boolean;
    chart: OversiktChart | null;
    loading?: boolean;
    error?: string | null;
    onClose: () => void;
    onSave: (params: { name: string; graphType: GraphType; sqlText: string }) => Promise<void>;
};

const EditChartDialog = ({ open, chart, loading = false, error, onClose, onSave }: EditChartDialogProps) => {
    const [name, setName] = useState(chart?.title ?? '');
    const [graphType, setGraphType] = useState<GraphType>(chart?.graphType ?? 'TABLE');
    const [sqlText, setSqlText] = useState(chart?.sql ?? '');
    const [showSql, setShowSql] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!chart) return;
        if (!name.trim()) {
            setLocalError('Grafnavn er påkrevd');
            return;
        }
        if (showSql && !sqlText.trim()) {
            setLocalError('SQL-kode kan ikke være tom når SQL-visning er aktiv');
            return;
        }

        setLocalError(null);
        await onSave({
            name: name.trim(),
            graphType,
            sqlText: showSql ? sqlText : (chart.sql ?? ''),
        });
    };

    return (
        <Modal open={open} onClose={onClose} header={{ heading: 'Rediger graf' }} width="medium">
            <Modal.Body>
                <div className="flex flex-col gap-4">
                    {localError && <Alert variant="error">{localError}</Alert>}
                    {error && <Alert variant="error">{error}</Alert>}
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
                    <Switch checked={showSql} onChange={(event) => setShowSql(event.target.checked)}>
                        Vis SQL kode
                    </Switch>
                    {showSql && (
                        <Textarea
                            label="SQL-kode"
                            minRows={8}
                            value={sqlText}
                            onChange={(event) => setSqlText(event.target.value)}
                        />
                    )}
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

export default EditChartDialog;
