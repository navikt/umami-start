import React from 'react';
import { Modal, Button } from '@navikt/ds-react';
import { Share2, FileCode, Copy, Download } from 'lucide-react';
import { SavedChart } from '../../data/dashboard/types';
import { processDashboardSql } from '../dashboard/dashboardQueryUtils';
import { translateValue } from '../../lib/translations';

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


    if (!chart.sql) return null;

    // 1. Share: Open /grafdeling with fully processed SQL
    // 1. Share: Open /grafdeling with fully processed SQL
    const handleShare = () => {
        const processedSql = processDashboardSql(chart.sql!, websiteId, filters);
        const encodedSql = encodeURIComponent(processedSql);
        const encodedDesc = encodeURIComponent(chart.title);
        const encodedDashboard = dashboardTitle ? encodeURIComponent(dashboardTitle) : '';
        window.open(`/grafdeling?sql=${encodedSql}&desc=${encodedDesc}&dashboard=${encodedDashboard}`, '_blank');
        onClose();
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

    // 3. Transfer to Metabase: Copy Processed SQL? Or Template SQL?
    // "Overfør til Metabase" likely implies pasting into the actual Metabase tool.
    // Metabase supports [[...]] syntax, so we should arguably copy the raw template SQL?
    // BUT, usually people want the specific query for the current view.
    // However, if we process it, we lose the interactive variables.
    // Let's copy the processed SQL so it's guaranteed to work in BigQuery console / Metabase as a static query.
    // Or, if the user wants to use the functionality of SqlEditor (as implied by prompt), they use "Open in Editor".
    // I will copy Processed SQL for "Transfer to Metabase" to ensure it runs immediately.
    // 3. Transfer to Metabase: Open /sql with processed SQL (ready for external tools)
    const handleTransferToMetabase = () => {
        const processedSql = processDashboardSql(chart.sql!, websiteId, filters);
        const encodedSql = encodeURIComponent(processedSql);
        window.open(`/sql?sql=${encodedSql}`, '_blank');
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
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="secondary"
                            onClick={handleShare}
                            icon={<Share2 aria-hidden />}
                            className="justify-start"
                        >
                            Del grafen
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleTransferToMetabase}
                            icon={<Copy aria-hidden />}
                            className="justify-start"
                        >
                            Overfør til Metabase
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleOpenInEditor}
                            icon={<FileCode aria-hidden />}
                            className="justify-start"
                        >
                            Åpne i SQL-editor
                        </Button>
                        {data && data.length > 0 && (
                            <Button
                                variant="secondary"
                                onClick={handleDownloadCsv}
                                icon={<Download aria-hidden />}
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
