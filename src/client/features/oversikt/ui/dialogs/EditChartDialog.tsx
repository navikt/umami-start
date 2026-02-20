import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Select, Switch, Textarea, TextField } from '@navikt/ds-react';
import type { GraphType, OversiktChart } from '../../model/types.ts';
import type { Website } from '../../../../shared/types/website.ts';
import { fetchWebsites } from '../../../../shared/api/websiteApi.ts';

type EditChartDialogProps = {
    open: boolean;
    chart: OversiktChart | null;
    defaultWebsiteId?: string;
    loading?: boolean;
    error?: string | null;
    onClose: () => void;
    onSave: (params: { name: string; graphType: GraphType; sqlText: string; width: number; websiteId?: string }) => Promise<void>;
};

const widthToPercent = (width?: OversiktChart['width']): number => {
    if (width === 'full') return 100;
    if (width === 'half') return 50;
    const parsed = Number(width);
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.round(parsed);
};

const EditChartDialog = ({ open, chart, defaultWebsiteId, loading = false, error, onClose, onSave }: EditChartDialogProps) => {
    const [name, setName] = useState(chart?.title ?? '');
    const [graphType, setGraphType] = useState<GraphType>(chart?.graphType ?? 'TABLE');
    const [width, setWidth] = useState(String(widthToPercent(chart?.width)));
    const [sqlText, setSqlText] = useState(chart?.sql ?? '');
    const [showSql, setShowSql] = useState(false);
    const [websites, setWebsites] = useState<Website[]>([]);
    const [websiteId, setWebsiteId] = useState(defaultWebsiteId ?? '');
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const run = async () => {
            try {
                const items = await fetchWebsites();
                setWebsites(items);
            } catch {
                setWebsites([]);
            }
        };
        void run();
    }, [open]);

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
        const parsedWidth = Number(width);
        if (!Number.isFinite(parsedWidth)) {
            setLocalError('Bredde må være et tall mellom 0 og 100');
            return;
        }
        const normalizedWidth = parsedWidth <= 0 ? 50 : Math.min(100, Math.max(1, Math.round(parsedWidth)));

        setLocalError(null);
        await onSave({
            name: name.trim(),
            graphType,
            width: normalizedWidth,
            sqlText: showSql ? sqlText : (chart.sql ?? ''),
            websiteId: websiteId || undefined,
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
                    <TextField
                        label="Bredde (%)"
                        description="Standardbredden er 50%"
                        value={width}
                        onChange={(event) => setWidth(event.target.value)}
                        size="small"
                    />
                    <Select
                        label="Nettside"
                        description="Velg hvilken nettside grafen skal bruke."
                        value={websiteId}
                        onChange={(event) => setWebsiteId(event.target.value)}
                        size="small"
                    >
                        <option value="">Velg nettside</option>
                        {websites.map((website) => (
                            <option key={website.id} value={website.id}>
                                {website.name}
                            </option>
                        ))}
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
