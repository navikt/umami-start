import React, { useState } from 'react';
import { Modal, Button } from '@navikt/ds-react';
import { ZoomPlusIcon, DownloadIcon, FileCodeIcon, LinkIcon, CheckmarkIcon } from '@navikt/aksel-icons';
import { Pencil, Trash2 } from 'lucide-react';
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
    dashboardTitle,
    onEditChart,
    onDeleteChart,
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

    const handleEdit = () => {
        onClose();
        onEditChart?.();
    };

    const handleDelete = () => {
        onClose();
        onDeleteChart?.();
    };

    const actionButtonClass = '!w-full !justify-start';
    const iconSlotClass = 'inline-flex w-5 justify-center';

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
                            className={actionButtonClass}
                        >
                            <span className="inline-flex items-center gap-2">
                                <span className={iconSlotClass}><ZoomPlusIcon aria-hidden /></span>
                                <span>Utforsk grafen</span>
                            </span>
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleCopyLink}
                            className={actionButtonClass}
                        >
                            <span className="inline-flex items-center gap-2">
                                <span className={iconSlotClass}>
                                    {copyFeedback ? <CheckmarkIcon aria-hidden /> : <LinkIcon aria-hidden />}
                                </span>
                                <span>{copyFeedback ? 'Lenke kopiert!' : 'Del grafen'}</span>
                            </span>
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleOpenInEditor}
                            className={actionButtonClass}
                        >
                            <span className="inline-flex items-center gap-2">
                                <span className={iconSlotClass}><FileCodeIcon aria-hidden /></span>
                                <span>Åpne i SQL-editor</span>
                            </span>
                        </Button>
                        {onEditChart && (
                            <Button
                                variant="secondary"
                                onClick={handleEdit}
                                className={actionButtonClass}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <span className={iconSlotClass}><Pencil aria-hidden size={16} /></span>
                                    <span>Rediger graf</span>
                                </span>
                            </Button>
                        )}
                        {onDeleteChart && (
                            <Button
                                variant="secondary"
                                onClick={handleDelete}
                                className={actionButtonClass}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <span className={iconSlotClass}><Trash2 aria-hidden size={16} /></span>
                                    <span>Slett graf</span>
                                </span>
                            </Button>
                        )}
                        {data && data.length > 0 && (
                            <Button
                                variant="secondary"
                                onClick={handleDownloadCsv}
                                className={actionButtonClass}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <span className={iconSlotClass}><DownloadIcon aria-hidden /></span>
                                    <span>Last ned CSV</span>
                                </span>
                            </Button>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal >
    );
};

export default ChartActionModal;
