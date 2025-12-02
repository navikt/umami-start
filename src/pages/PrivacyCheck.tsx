import { useState, useEffect } from 'react';
import { Button, Alert, Loader, Radio, RadioGroup, Table, Heading, Tabs, Switch, DatePicker, ReadMore } from '@navikt/ds-react';
import { format, parse, isValid } from 'date-fns';
import ChartLayout from '../components/ChartLayout';
import WebsitePicker from '../components/WebsitePicker';
import { Website } from '../types/chart';


const PATTERNS: Record<string, RegExp> = {
    'Fødselsnummer': /\b\d{11}\b/g,
    'UUID': /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    'Navident': /\b[a-zA-Z]\d{6}\b/g,
    'E-post': /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    'IP-adresse': /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    'Telefonnummer': /(?<![-0-9a-fA-F])[2-9]\d{7}(?![-0-9a-fA-F])/g,
    'Bankkort': /(?<![0-9a-fA-F]-)\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b(?!-[0-9a-fA-F])/g,
    'Mulig navn': /\b[A-ZÆØÅ][a-zæøå]{1,20}\s[A-ZÆØÅ][a-zæøå]{1,20}(?:\s[A-ZÆØÅ][a-zæøå]{1,20})?\b/g,
    'Mulig adresse': /\b\d{4}\s[A-ZÆØÅ][A-ZÆØÅa-zæøå]+(?:\s[A-ZÆØÅa-zæøå]+)*\b/g,
    'Hemmelig adresse': /hemmelig(?:%20|\s+)(?:20\s*%(?:%20|\s+))?adresse/gi,
    'Kontonummer': /\b\d{4}\.?\d{2}\.?\d{5}\b/g,
    'Organisasjonsnummer': /\b\d{9}\b/g,
    'Bilnummer': /\b[A-Z]{2}\s?\d{5}\b/g,
    'Mulig søk': /[?&](?:q|query|search|k|ord)=[^&]+/g
};

const HighlightedText = ({ text, type }: { text: string, type: string }) => {
    const pattern = PATTERNS[type];
    if (!pattern) return <span>{text}</span>;

    // Reset regex lastIndex
    pattern.lastIndex = 0;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = pattern.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(<span key={`text-${key++}`}>{text.substring(lastIndex, match.index)}</span>);
        }

        // Add highlighted match
        parts.push(
            <mark key={`mark-${key++}`} className="bg-yellow-400 px-1 rounded">
                {match[0]}
            </mark>
        );

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(<span key={`text-${key++}`}>{text.substring(lastIndex)}</span>);
    }

    return <>{parts}</>;
};

const ExampleList = ({ examples, type }: { examples: string[], type: string }) => {
    const [showAll, setShowAll] = useState(false);

    if (!examples || examples.length === 0) return null;

    const renderItem = (ex: string) => (
        <div className="py-1.5 px-2 bg-white border border-gray-200 rounded mb-2 overflow-x-auto">
            <HighlightedText text={ex} type={type} />
        </div>
    );

    if (examples.length === 1) return renderItem(examples[0]);

    return (
        <div className="flex flex-col gap-1">
            {renderItem(examples[0])}
            {examples.length > 1 && (
                <div className="flex flex-col gap-1">
                    {showAll ? (
                        <>
                            {examples.slice(1).map((ex, i) => (
                                <div key={i}>{renderItem(ex)}</div>
                            ))}
                            <Button
                                size="xsmall"
                                variant="tertiary"
                                onClick={() => setShowAll(false)}
                                className="self-start mt-1"
                            >
                                Vis færre
                            </Button>
                        </>
                    ) : (
                        <Button
                            size="xsmall"
                            variant="tertiary"
                            onClick={() => setShowAll(true)}
                            className="self-start"
                        >
                            + {examples.length - 1} til
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

const PrivacyCheck = () => {
    const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
    const [period, setPeriod] = useState<string>('current_month');
    const [data, setData] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [queryStats, setQueryStats] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<string>('summary');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [showEmpty, setShowEmpty] = useState<boolean>(false);
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
    const [fromInputValue, setFromInputValue] = useState<string>('');
    const [toInputValue, setToInputValue] = useState<string>('');
    const [dryRunStats, setDryRunStats] = useState<any>(null);
    const [showDryRunWarning, setShowDryRunWarning] = useState<boolean>(false);

    // Sync input strings when dates change (e.g. from calendar selection)
    useEffect(() => {
        if (customStartDate) {
            setFromInputValue(format(customStartDate, 'dd.MM.yyyy'));
        } else {
            setFromInputValue('');
        }
    }, [customStartDate]);

    useEffect(() => {
        if (customEndDate) {
            setToInputValue(format(customEndDate, 'dd.MM.yyyy'));
        } else {
            setToInputValue('');
        }
    }, [customEndDate]);

    const fetchData = async (force: boolean = false) => {
        setLoading(true);
        setError(null);
        if (force) {
            setShowDryRunWarning(false); // Hide warning immediately when forced
        } else {
            setData(null);
            setQueryStats(null);
            setSelectedType(null); // Reset filter on new search
            setDryRunStats(null);
            setShowDryRunWarning(false);
        }

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (period === 'current_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        } else if (period === 'last_month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (period === 'custom') {
            if (!customStartDate || !customEndDate) {
                setError('Vennligst velg en gyldig periode.');
                setLoading(false);
                return;
            }
            startDate = customStartDate;
            endDate = customEndDate;
        } else {
            // Fallback
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        }

        try {
            const response = await fetch('/api/bigquery/privacy-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websiteId: selectedWebsite?.id,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    dryRun: !force && period === 'custom', // Only dry run for custom period initially
                }),
            });

            if (!response.ok) {
                throw new Error('Kunne ikke hente data');
            }

            const result = await response.json();

            if (result.error) {
                setError(result.error);
            } else if (result.dryRun) {
                // Handle dry run result
                const gbProcessed = parseFloat(result.queryStats.totalBytesProcessedGB);
                if (gbProcessed > 1) { // Warn if > 1 GB
                    setDryRunStats(result.queryStats);
                    setShowDryRunWarning(true);
                    setLoading(false);
                    return;
                } else {
                    // If small enough, run immediately
                    fetchData(true);
                    return;
                }
            } else {
                // Filter out false positives
                const uuidPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
                const filteredData = result.data.filter((row: any) => {
                    // Filter out names that start with Nav or Viser, or contain Modia Personoversikt
                    if (row.match_type === 'Mulig navn') {
                        const hasInvalidName = row.examples?.some((ex: string) =>
                            /^(Nav|Viser)\s/i.test(ex) || /Modia\s+Personoversikt/i.test(ex)
                        );
                        return !hasInvalidName;
                    }
                    // Filter out bank cards and phone numbers that are part of UUIDs
                    if (row.match_type === 'Bankkort' || row.match_type === 'Telefonnummer') {
                        const hasUuid = row.examples?.some((ex: string) => uuidPattern.test(ex));
                        return !hasUuid;
                    }
                    // Filter out organization numbers that are preceded by id= or similar patterns
                    if (row.match_type === 'Organisasjonsnummer') {
                        const hasIdPattern = row.examples?.some((ex: string) =>
                            /(?:id|oppgaveid|enhetid|aktoerid)=/i.test(ex)
                        );
                        return !hasIdPattern;
                    }
                    return true;
                });

                setData(filteredData);
                setQueryStats(result.queryStats);
            }
        } catch (err) {
            console.error('Error fetching privacy check data:', err);
            setError('Det oppstod en feil ved henting av data.');
        } finally {
            setLoading(false);
        }
    };

    // Get unique match types for tabs
    const matchTypes = data ? Array.from(new Set(data.map(row => row.match_type))) : [];

    const handleExplore = (type: string) => {
        setSelectedType(type);
        setActiveTab('details');
    };

    const filteredData = data
        ? (selectedType ? data.filter(row => row.match_type === selectedType) : data)
        : [];

    const visibleData = filteredData.filter(row => showEmpty || row.count > 0);

    return (
        <ChartLayout
            title="Personvernssjekk"
            description="Søk etter potensielle personopplysninger."
            currentPage="personvern" // Assuming we might add this to AnalyticsPage type later, or just use a dummy
            filters={
                <>
                    <WebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                    />

                    <RadioGroup
                        legend="Periode"
                        value={period}
                        onChange={(val: string) => setPeriod(val)}
                    >
                        <Radio value="current_month">Denne måneden</Radio>
                        <Radio value="last_month">Forrige måned</Radio>
                        <Radio value="custom">Egendefinert</Radio>
                    </RadioGroup>

                    {period === 'custom' && (
                        <div className="mb-4">
                            <DatePicker
                                mode="range"
                                onSelect={(range) => {
                                    if (range) {
                                        setCustomStartDate(range.from);
                                        setCustomEndDate(range.to);
                                    }
                                }}
                                selected={{ from: customStartDate, to: customEndDate }}
                            >
                                <div className="flex gap-4">
                                    <DatePicker.Input
                                        id="custom-date-from"
                                        label="Fra dato"
                                        value={fromInputValue}
                                        onChange={(e) => {
                                            setFromInputValue(e.target.value);
                                            const date = parse(e.target.value, 'dd.MM.yyyy', new Date());
                                            if (isValid(date) && e.target.value.length === 10) {
                                                setCustomStartDate(date);
                                            }
                                        }}
                                    />
                                    <DatePicker.Input
                                        id="custom-date-to"
                                        label="Til dato"
                                        value={toInputValue}
                                        onChange={(e) => {
                                            setToInputValue(e.target.value);
                                            const date = parse(e.target.value, 'dd.MM.yyyy', new Date());
                                            if (isValid(date) && e.target.value.length === 10) {
                                                setCustomEndDate(date);
                                            }
                                        }}
                                    />
                                </div>
                            </DatePicker>
                        </div>
                    )}

                    <Button
                        onClick={() => fetchData(false)}
                        disabled={loading}
                        loading={loading}
                        className="w-full"
                    >
                        {selectedWebsite ? 'Kjør personvernssjekk' : 'Søk i alle nettsteder'}
                    </Button>
                </>
            }
        >
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {showDryRunWarning && dryRunStats && (
                <Alert variant="warning" className="mb-4">
                    <Heading level="3" size="small">Stor datamengde</Heading>
                    <p className="mt-2">
                        Denne spørringen vil prosessere ca. <strong>{dryRunStats.totalBytesProcessedGB} GB</strong> data.
                        Dette kan ta litt tid. Vil du fortsette?
                    </p>
                    <div className="mt-4 flex gap-4">
                        <Button variant="primary" size="small" onClick={() => fetchData(true)}>
                            Ja, kjør på!
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => setShowDryRunWarning(false)}>
                            Avbryt
                        </Button>
                    </div>
                </Alert>
            )}

            {loading && (
                <div className="flex flex-col justify-center items-center h-full gap-4">
                    <Loader size="xlarge" title="Søker etter personopplysninger..." />
                    <div className="text-center text-gray-600">
                        <p className="font-medium">Dette kan ta noen sekunder</p>
                        <p className="text-sm">Vi analyserer alle data i valgt periode</p>
                    </div>
                </div>
            )}

            {!loading && data && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <Heading level="2" size="medium">Resultater</Heading>
                    </div>

                    {data.length === 0 ? (
                        <Alert variant="success">Ingen treff funnet i valgt periode.</Alert>
                    ) : (
                        <Tabs value={activeTab} onChange={setActiveTab}>
                            <Tabs.List>
                                <Tabs.Tab value="summary" label="Oppsummering" />
                                <Tabs.Tab value="details" label="Detaljer" />
                            </Tabs.List>

                            <Tabs.Panel value="summary" className="mt-4">
                                <Table>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.HeaderCell>Type</Table.HeaderCell>
                                            <Table.HeaderCell>Totalt antall forekomster</Table.HeaderCell>
                                            <Table.HeaderCell>Handling</Table.HeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {matchTypes.map(type => {
                                            const totalCount = data
                                                .filter(r => r.match_type === type)
                                                .reduce((sum, r) => sum + r.count, 0);
                                            return (
                                                <Table.Row key={type}>
                                                    <Table.DataCell>{type}</Table.DataCell>
                                                    <Table.DataCell>{totalCount.toLocaleString('no-NO')}</Table.DataCell>
                                                    <Table.DataCell>
                                                        <Button
                                                            size="small"
                                                            variant="secondary"
                                                            onClick={() => handleExplore(type)}
                                                        >
                                                            Utforsk
                                                        </Button>
                                                    </Table.DataCell>
                                                </Table.Row>
                                            );
                                        })}
                                        <Table.Row className="font-bold">
                                            <Table.DataCell>Totalt</Table.DataCell>
                                            <Table.DataCell>
                                                {data.reduce((sum, r) => sum + r.count, 0).toLocaleString('no-NO')}
                                            </Table.DataCell>
                                            <Table.DataCell></Table.DataCell>
                                        </Table.Row>
                                    </Table.Body>
                                </Table>

                                <ReadMore header="Metadata oversikt" className="mt-6">
                                    <div className="space-y-4">
                                        {!selectedWebsite && (
                                            <div>
                                                <Heading level="4" size="xsmall" className="mb-2">Unike nettsteder ({new Set(data.map(row => row.website_id)).size})</Heading>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {Array.from(new Set(data.map(row => row.website_name || row.website_id))).sort().map((websiteName, idx) => (
                                                        <li key={idx} className="text-sm">{websiteName}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div>
                                            <Heading level="4" size="xsmall" className="mb-2">Involverte tabeller og kolonner</Heading>
                                            {(() => {
                                                // Group by table
                                                const tableColumns: Record<string, Set<string>> = {};
                                                data.forEach(row => {
                                                    if (!tableColumns[row.table_name]) {
                                                        tableColumns[row.table_name] = new Set();
                                                    }
                                                    tableColumns[row.table_name].add(row.column_name);
                                                });

                                                return (
                                                    <ul className="list-disc list-inside space-y-2">
                                                        {Object.entries(tableColumns).sort().map(([table, columns]) => (
                                                            <li key={table} className="text-sm">
                                                                <strong>{table}</strong>
                                                                <ul className="list-circle list-inside ml-6 mt-1">
                                                                    {Array.from(columns).sort().map((column, idx) => (
                                                                        <li key={idx} className="text-sm text-gray-700">{column}</li>
                                                                    ))}
                                                                </ul>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </ReadMore>
                            </Tabs.Panel>

                            <Tabs.Panel value="details" className="mt-4">
                                {selectedType === 'E-post' && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="text-sm text-gray-900 font-medium mb-1">Totalt antall e-poster</div>
                                            <div className="text-2xl font-bold text-gray-900">
                                                {visibleData.reduce((sum, row) => sum + row.count, 0).toLocaleString('no-NO')}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Unike: {visibleData.reduce((sum, row) => sum + (row.unique_count || 0), 0).toLocaleString('no-NO')}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="text-sm text-gray-900 font-medium mb-1">Nav e-poster</div>
                                            <div className="text-2xl font-bold text-gray-900">
                                                {visibleData.reduce((sum, row) => sum + (row.nav_count || 0), 0).toLocaleString('no-NO')}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Unike: {visibleData.reduce((sum, row) => sum + (row.unique_nav_count || 0), 0).toLocaleString('no-NO')}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="text-sm text-gray-900 font-medium mb-1">Andre e-poster</div>
                                            <div className="text-2xl font-bold text-gray-900">
                                                {(visibleData.reduce((sum, row) => sum + row.count, 0) - visibleData.reduce((sum, row) => sum + (row.nav_count || 0), 0)).toLocaleString('no-NO')}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Unike: {visibleData.reduce((sum, row) => sum + (row.unique_other_count || 0), 0).toLocaleString('no-NO')}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!selectedWebsite && selectedType && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="text-sm text-gray-900 font-medium mb-1">Antall unike nettsteder</div>
                                            <div className="text-2xl font-bold text-gray-900">
                                                {new Set(visibleData.map(row => row.website_id)).size.toLocaleString('no-NO')}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="text-sm text-gray-900 font-medium mb-1">Antall variasjoner</div>
                                            <div className="text-2xl font-bold text-gray-900">
                                                {visibleData.length.toLocaleString('no-NO')}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedType && (
                                    <ReadMore header="Metadata oversikt" className="mb-6">
                                        <div className="space-y-4">
                                            {!selectedWebsite && (
                                                <div>
                                                    <Heading level="4" size="xsmall" className="mb-2">Unike nettsteder ({new Set(visibleData.map(row => row.website_id)).size})</Heading>
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {Array.from(new Set(visibleData.map(row => row.website_name || row.website_id))).sort().map((websiteName, idx) => (
                                                            <li key={idx} className="text-sm">{websiteName}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <div>
                                                <Heading level="4" size="xsmall" className="mb-2">Involverte tabeller og kolonner</Heading>
                                                {(() => {
                                                    // Group by table
                                                    const tableColumns: Record<string, Set<string>> = {};
                                                    visibleData.forEach(row => {
                                                        if (!tableColumns[row.table_name]) {
                                                            tableColumns[row.table_name] = new Set();
                                                        }
                                                        tableColumns[row.table_name].add(row.column_name);
                                                    });

                                                    return (
                                                        <ul className="list-disc list-inside space-y-2">
                                                            {Object.entries(tableColumns).sort().map(([table, columns]) => (
                                                                <li key={table} className="text-sm">
                                                                    <strong>{table}</strong>
                                                                    <ul className="list-circle list-inside ml-6 mt-1">
                                                                        {Array.from(columns).sort().map((column, idx) => (
                                                                            <li key={idx} className="text-sm text-gray-700">{column}</li>
                                                                        ))}
                                                                    </ul>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </ReadMore>
                                )}

                                <div className="flex justify-between items-end mb-4">
                                    {selectedType ? (
                                        <div className="flex items-center gap-4 bg-blue-50 p-2 px-4 rounded-md border border-blue-100">
                                            <div>
                                                Viser detaljer for: <strong>{selectedType}</strong>
                                            </div>
                                            <Button
                                                size="small"
                                                variant="tertiary"
                                                onClick={() => setSelectedType(null)}
                                            >
                                                Vis alle
                                            </Button>
                                        </div>
                                    ) : <div></div>}

                                    <Switch
                                        checked={showEmpty}
                                        onChange={() => setShowEmpty(!showEmpty)}
                                        size="small"
                                    >
                                        Vis rader uten treff
                                    </Switch>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table>
                                        <Table.Header>
                                            <Table.Row>
                                                {!selectedWebsite && <Table.HeaderCell>Nettside</Table.HeaderCell>}
                                                <Table.HeaderCell>Tabell</Table.HeaderCell>
                                                <Table.HeaderCell>Kolonne</Table.HeaderCell>
                                                {!selectedType && <Table.HeaderCell>Type</Table.HeaderCell>}
                                                <Table.HeaderCell>Antall</Table.HeaderCell>
                                                <Table.HeaderCell>Eksempler</Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {visibleData.map((row, index) => (
                                                <Table.Row key={index}>
                                                    {!selectedWebsite && <Table.DataCell className="whitespace-nowrap">{row.website_name}</Table.DataCell>}
                                                    <Table.DataCell className="whitespace-nowrap">{row.table_name}</Table.DataCell>
                                                    <Table.DataCell className="whitespace-nowrap">{row.column_name}</Table.DataCell>
                                                    {!selectedType && <Table.DataCell className="whitespace-nowrap">{row.match_type}</Table.DataCell>}
                                                    <Table.DataCell className="whitespace-nowrap">{row.count.toLocaleString('no-NO')}</Table.DataCell>
                                                    <Table.DataCell className="font-mono text-sm">
                                                        <ExampleList examples={row.examples} type={row.match_type} />
                                                    </Table.DataCell>
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table>
                                </div>
                            </Tabs.Panel>
                        </Tabs>
                    )}

                    {queryStats && (
                        <div className="mt-5 pt-4text-sm text-gray-500 flex justify-between">
                            <div>
                                Data prosessert: {queryStats.totalBytesProcessedGB} GB
                            </div>
                        </div>
                    )}
                </>
            )}
        </ChartLayout>
    );
};

export default PrivacyCheck;
