import { useState } from 'react';
import { Heading, Button, Table, TextField } from '@navikt/ds-react';
import { Download } from 'lucide-react';
import type { QueryStats } from '../model/types.ts';

interface EventListProps {
    events: { name: string; count: number }[];
    eventsQueryStats: QueryStats | null;
    websiteName?: string;
    onSelectEvent: (name: string) => void;
}

const EventList = ({ events, eventsQueryStats, websiteName, onSelectEvent }: EventListProps) => {
    const [eventSearch, setEventSearch] = useState<string>('');

    const filteredEvents = events.filter(event =>
        event.name.toLowerCase().includes(eventSearch.toLowerCase())
    );

    const handleDownloadCsv = () => {
        const headers = ['Hendelsesnavn', 'Antall'];
        const csvRows = [
            headers.join(','),
            ...filteredEvents.map((event) => [
                `"${event.name}"`,
                event.count
            ].join(','))
        ];
        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `hendelser_${websiteName || 'data'}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="flex justify-between items-end mb-4">
                <Heading level="3" size="small">Egendefinerte hendelser</Heading>
                <div className="w-64">
                    <TextField
                        label="Søk"
                        hideLabel
                        placeholder="Søk..."
                        size="small"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <Table size="small">
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>Navn</Table.HeaderCell>
                                <Table.HeaderCell align="right">Antall tilfeller</Table.HeaderCell>
                                <Table.HeaderCell></Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredEvents.map((event) => (
                                <Table.Row key={event.name}>
                                    <Table.DataCell>{event.name}</Table.DataCell>
                                    <Table.DataCell align="right">{event.count.toLocaleString('nb-NO')}</Table.DataCell>
                                    <Table.DataCell>
                                        <Button
                                            size="xsmall"
                                            variant="secondary"
                                            onClick={() => onSelectEvent(event.name)}
                                        >
                                            Utforsk
                                        </Button>
                                    </Table.DataCell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
                <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-t justify-between items-center">
                    <div className="flex gap-2">
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={handleDownloadCsv}
                            icon={<Download size={16} />}
                        >
                            Last ned CSV
                        </Button>
                    </div>
                    {eventsQueryStats && (
                        <span className="text-sm text-[var(--ax-text-subtle)]">
                            Data prosessert: {eventsQueryStats.totalBytesProcessedGB} GB
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventList;

