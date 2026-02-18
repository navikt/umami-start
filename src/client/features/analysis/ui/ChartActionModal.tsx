import React, { useState } from 'react';
import { Modal, Button } from '@navikt/ds-react';
import { ZoomPlusIcon, DownloadIcon, FileCodeIcon, LinkIcon, CheckmarkIcon } from '@navikt/aksel-icons';
import type { SavedChart } from '../../../../data/dashboard';
import { processDashboardSql } from '../../dashboard';
import { translateValue } from '../../../shared/lib/translations.ts';

interface ChartActionModalProps {
    open: boolean;
    onClose: () => void;
    chart: SavedChart;
    websiteId: string;
    filters: {
        urlFilters: string[];
        dateRange: string;
        pathOperator: string;
        metricType: 'visitors' | 'pageviews' | 'proportion' | 'visits';
        customStartDate?: Date;
        customEndDate?: Date;
    };
    domain?: string;
    data?: any[];
    dashboardTitle?: string;
}

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

    const generateShareUrl = () => {
        const processedSql = processDashboardSql(chart.sql!, websiteId, filters);

        const params = new URLSearchParams();
        params.set('sql', processedSql);
        params.set('desc', chart.title);
        if (dashboardTitle) params.set('dashboard', dashboardTitle);

        // Map chart type
        let tabParam = 'table';
        if (chart.type === 'line') tabParam = 'linechart';
        if (chart.type === 'bar') tabParam = 'barchart';
        if (chart.type === 'pie') tabParam = 'piechart';
        params.set('tab', tabParam);

        // Add context filters
        if (websiteId) params.set('websiteId', websiteId);
        if (domain) params.set('domain', domain);

        if (filters.urlFilters?.length) {
            params.set('urlPath', filters.urlFilters.join(','));
            if (filters.pathOperator) params.set('pathOperator', filters.pathOperator);
        }

        if (filters.dateRange) params.set('dateRange', filters.dateRange);
        if (filters.customStartDate) params.set('customStartDate', filters.customStartDate.toISOString());
        if (filters.customEndDate) params.set('customEndDate', filters.customEndDate.toISOString());

        return `${window.location.origin}/grafdeling?${params.toString()}`;
    };

    // 1. Explore: Open /grafdeling fully processed
    const handleOpenInNewTab = () => {
        window.open(generateShareUrl(), '_blank');
        onClose();
    };

    // 1b. Share: Copy link
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(generateShareUrl());
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    // 2. Open in Editor: Open /sql with raw SQL + params (so it remains editable/dynamic)
    const handleOpenInEditor = () => {
        const params = new URLSearchParams();
        params.set('sql', chart.sql!);

        if (websiteId) params.set('websiteId', websiteId);
        if (domain) params.set('domain', domain);

        if (filters.urlFilters?.length) {
            params.set('urlPath', filters.urlFilters.join(','));
            params.set('pathOperator', filters.pathOperator || 'equals');
        }

        if (filters.dateRange) params.set('dateRange', filters.dateRange);
        if (filters.customStartDate) params.set('customStartDate', filters.customStartDate.toISOString());
        if (filters.customEndDate) params.set('customEndDate', filters.customEndDate.toISOString());

        // Use window.open for "Open in..." actions usually
        window.open(`/sql?${params.toString()}`, '_blank');
        onClose();
    };

    // 4. Download CSV: Convert data to CSV and download
    const handleDownloadCsv = () => {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map((row: any) =>
                headers
                    .map((header) => {
                        const value = row[header];
                        const translatedValue = translateValue(header, value);
                        const stringValue = translatedValue !== null && translatedValue !== undefined ? String(translatedValue) : '';
                        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                            return `"${stringValue.replace(/"/g, '""')}"`;
                        }
                        return stringValue;
                    })
                    .join(',')
                ,
            ),
        ];
        const csvContent = csvRows.join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${chart.title || 'chart_data'}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
