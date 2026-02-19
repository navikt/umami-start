import { useState, useEffect } from 'react';
import { Button, Table, Heading, Pagination, VStack, HelpText, TextField } from '@navikt/ds-react';
import { Download } from 'lucide-react';
import type { Website } from '../../../shared/types/chart.ts';
import type { MarketingRow, QueryStats } from '../model/types';
import { downloadCsvFile } from '../utils/trafficUtils';

type AnalysisTableProps = {
    title: string;
    data: MarketingRow[];
    metricLabel: string;
    queryStats: QueryStats | null;
    selectedWebsite: Website | null;
    metricType: string;
};

const AnalysisTable = ({ title, data, metricLabel, queryStats, selectedWebsite, metricType }: AnalysisTableProps) => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const rowsPerPage = 20;

    const filteredData = data.filter(row =>
        row.name.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        setPage(1);
    }, [search]);

    const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const formatValue = (count: number) => {
        if (metricType === 'proportion') {
            return `${count.toFixed(1)}%`;
        }
        return count.toLocaleString('nb-NO');
    };

    const handleDownloadCSV = () => {
        if (!data.length) return;

        const headers = ['Navn', metricLabel];
        const csvRows = [
            headers.join(','),
            ...data.map((item) => {
                return [
                    `"${item.name}"`,
                    metricType === 'proportion' ? `${item.count.toFixed(1)}%` : item.count
                ].join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        downloadCsvFile(csvContent, `marketing_${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    const renderName = (name: string) => {
        if (name === '(none)') {
            return (
                <div className="flex items-center gap-2 max-w-full">
                    <span className="truncate">Direkte / Ingen</span>
                    <HelpText title="Hva betyr dette?" strategy="fixed">
                        Besøk hvor det ikke er registrert noen henvisningskilde. Dette er ofte brukere som skriver inn nettadressen direkte, bruker bokmerker, eller kommer fra apper (som e-post eller Teams) som ikke sender data om hvor trafikken kommer fra.
                    </HelpText>
                </div>
            );
        }

        if (name === '(exit)') {
            return (
                <div className="flex items-center gap-2 max-w-full">
                    <span className="truncate">Utganger (Exit)</span>
                    <HelpText title="Hva betyr dette?" strategy="fixed">
                        Dette viser vanligvis til økter som ble avsluttet uten ny sidevisning, eller data som mangler kildeinformasjon ved utgang.
                    </HelpText>
                </div>
            );
        }

        if (name === '(not set)') {
            return "Ikke satt (not set)";
        }

        if (selectedWebsite && name === selectedWebsite.domain) {
            return (
                <div className="flex items-center gap-2 max-w-full">
                    <span className="truncate">Interntrafikk ({name})</span>
                    <HelpText title="Hva betyr dette?" strategy="fixed">
                        Trafikk som ser ut til å komme fra samme domene. Dette skjer ofte ved omdirigeringer, eller hvis sporingskoden mistet sesjonsdata mellom to sidevisninger.
                    </HelpText>
                </div>
            );
        }

        return <div className="truncate">{name}</div>;
    };

    return (
        <VStack gap="space-4">
            <div className="flex justify-between items-end">
                <Heading level="3" size="small">{title}</Heading>
                <div className="w-64">
                    <TextField
                        label="Søk"
                        hideLabel
                        placeholder="Søk..."
                        size="small"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="border rounded-lg overflow-x-auto">
                <Table size="small">
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Navn</Table.HeaderCell>
                            <Table.HeaderCell align="right">{metricLabel}</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {paginatedData.map((row, i) => (
                            <Table.Row key={i}>
                                <Table.DataCell className="max-w-md" title={row.name}>
                                    {renderName(row.name)}
                                </Table.DataCell>
                                <Table.DataCell align="right">{formatValue(row.count)}</Table.DataCell>
                            </Table.Row>
                        ))}
                        {filteredData.length === 0 && (
                            <Table.Row>
                                <Table.DataCell colSpan={2} align="center">
                                    {data.length > 0 ? 'Ingen treff' : 'Ingen data'}
                                </Table.DataCell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
                <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                    <div className="flex gap-2">
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={handleDownloadCSV}
                            icon={<Download size={16} />}
                            disabled={data.length === 0}
                        >
                            Last ned CSV
                        </Button>
                    </div>
                    {queryStats && (
                        <span className="text-sm text-[var(--ax-text-subtle)]">
                            Data prosessert: {queryStats.totalBytesProcessedGB} GB
                        </span>
                    )}
                </div>
            </div>
            {totalPages > 1 && (
                <Pagination
                    page={page}
                    onPageChange={setPage}
                    count={totalPages}
                    size="small"
                />
            )}
        </VStack>
    );
};

export default AnalysisTable;

