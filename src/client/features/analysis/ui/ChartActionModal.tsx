import React, { useState } from 'react';
import { Modal, Button } from '@navikt/ds-react';
import { ZoomPlusIcon, DownloadIcon, FileCodeIcon, LinkIcon, CheckmarkIcon } from '@navikt/aksel-icons';
import type { ChartActionModalProps } from '../model/types.ts';
import { generateShareUrl, buildEditorUrl, downloadChartCsv } from '../utils/chartActions.ts';

const ChartActionModal: React.FC<ChartActionModalProps> = ({
    open,
    onClose,
    chart,
    websiteId,
    filters,
    domain,
    data,
    dashboardTitle
}) => {
    const [copyFeedback, setCopyFeedback] = useState(false);

    if (!chart.sql) return null;

    const handleOpenInNewTab = () => {
        window.open(generateShareUrl(chart, websiteId, filters, domain, dashboardTitle), '_blank');
        onClose();
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(generateShareUrl(chart, websiteId, filters, domain, dashboardTitle));
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const handleOpenInEditor = () => {
        window.open(buildEditorUrl(chart, websiteId, filters, domain), '_blank');
        onClose();
    };

    const handleDownloadCsv = () => {
        if (!data || data.length === 0) return;
        downloadChartCsv(data, chart.title);
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} header={{ heading: 'Hva vil du gjøre med grafen?' }} width="small" >
            <Modal.Body>
                <div className="p-2 pb-4 flex flex-col gap-4 text-left">
                    <div className="pb-2">
                        <p className="text-sm text-[var(--ax-text-subtle)]">Valgt graf</p>
                        <p className="text-base font-medium text-[var(--ax-text-default)]">{chart.title}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="secondary"
                            onClick={handleOpenInNewTab}
                            icon={<ZoomPlusIcon aria-hidden />}
                            className="justify-start"
                        >
                            Utforsk grafen
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleCopyLink}
                            icon={copyFeedback ? <CheckmarkIcon aria-hidden /> : <LinkIcon aria-hidden />}
                            className="justify-start"
                        >
                            {copyFeedback ? 'Lenke kopiert!' : 'Del grafen'}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleOpenInEditor}
                            icon={<FileCodeIcon aria-hidden />}
                            className="justify-start"
                        >
                            Åpne i SQL-editor
                        </Button>
                        {data && data.length > 0 && (
                            <Button
                                variant="secondary"
                                onClick={handleDownloadCsv}
                                icon={<DownloadIcon aria-hidden />}
                                className="justify-start"
                            >
                                Last ned CSV
                            </Button>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal >
    );
};

export default ChartActionModal;
