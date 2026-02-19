import { useState } from 'react';
import { TextField, Button, Alert, Loader, Tabs, UNSAFE_Combobox } from '@navikt/ds-react';
import { Share2, Check } from 'lucide-react';
import ChartLayout from '../../analysis/ui/ChartLayout.tsx';
import WebsitePicker from '../../analysis/ui/WebsitePicker.tsx';
import PeriodPicker from '../../analysis/ui/PeriodPicker.tsx';
import { normalizeUrlToPath } from '../../../shared/lib/utils.ts';
import { useEventJourney } from '../hooks/useEventJourney.ts';
import { getUniqueEventTypes, filterJourneys } from '../utils/journeyFilters.ts';
import { copyToClipboard } from '../utils/clipboard.ts';
import JourneyStatsGrid from './journey/JourneyStatsGrid.tsx';
import JourneyVisualView from './journey/JourneyVisualView.tsx';
import JourneyTableView from './journey/JourneyTableView.tsx';

const EventJourney = () => {
    const {
        selectedWebsite,
        setSelectedWebsite,
        urlPath,
        setUrlPath,
        period,
        setPeriod,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        data,
        loading,
        error,
        journeyStats,
        queryStats,
        hasUnappliedFilterChanges,
        fetchData
    } = useEventJourney();

    const [filterText, setFilterText] = useState<string>('');
    const [excludedEventTypes, setExcludedEventTypes] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string>('visual');
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

    const filteredData = filterJourneys(data, excludedEventTypes, filterText);
    const totalJourneySessions = data.reduce((total, journey) => total + journey.count, 0);

    const copyShareLink = async () => {
        const success = await copyToClipboard(window.location.href);
        if (success) {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    return (
        <ChartLayout
            title="Hendelsesforløp"
            description="Se rekkefølgen av hendelser brukere gjør på en spesifikk side."
            currentPage="hendelsesreiser"
            websiteDomain={selectedWebsite?.domain}
            websiteName={selectedWebsite?.name}
            sidebarContent={
                <WebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={setSelectedWebsite}
                    variant="minimal"
                />
            }
            filters={
                <>
                    <TextField
                        size="small"
                        label="URL"
                        value={urlPath}
                        onChange={(e) => setUrlPath(e.target.value)}
                        onBlur={(e) => setUrlPath(normalizeUrlToPath(e.target.value))}
                    />

                    <PeriodPicker
                        period={period}
                        onPeriodChange={setPeriod}
                        startDate={customStartDate}
                        onStartDateChange={setCustomStartDate}
                        endDate={customEndDate}
                        onEndDateChange={setCustomEndDate}
                    />

                    <div className="flex items-end pb-[2px]">
                        <Button
                            onClick={fetchData}
                            disabled={!selectedWebsite || loading || !urlPath || !hasUnappliedFilterChanges}
                            loading={loading}
                            size="small"
                        >
                            Vis
                        </Button>
                    </div>
                </>
            }
        >
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {!urlPath && !loading && data.length === 0 && (
                <Alert variant="info" className="mb-4">
                    Skriv inn en URL-sti for å se hendelsesforløp.
                </Alert>
            )}

            {loading && (
                <div className="flex justify-center items-center h-full">
                    <Loader size="xlarge" title="Laster hendelsesreiser..." />
                </div>
            )}

            {!loading && data.length > 0 && (
                <>
                    <JourneyStatsGrid journeyStats={journeyStats} />

                    <div className="mb-4">
                        <div className="flex flex-wrap items-end gap-3">
                            {getUniqueEventTypes(data).length > 0 && (
                                <UNSAFE_Combobox
                                    label="Skjul hendelser"
                                    size="small"
                                    options={getUniqueEventTypes(data)}
                                    selectedOptions={excludedEventTypes}
                                    isMultiSelect
                                    placeholder="Velg..."
                                    onToggleSelected={(option: string, isSelected: boolean) => {
                                        if (isSelected) {
                                            setExcludedEventTypes([...excludedEventTypes, option]);
                                        } else {
                                            setExcludedEventTypes(excludedEventTypes.filter(e => e !== option));
                                        }
                                    }}
                                    className="w-56"
                                />
                            )}
                            <TextField
                                label="Søk"
                                size="small"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="w-48"
                            />
                        </div>
                    </div>

                    <Tabs value={activeTab} onChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Tab value="visual" label="Hendelsesforløp" />
                            <Tabs.Tab value="table" label="Tabellvisning" />
                        </Tabs.List>

                        <Tabs.Panel value="visual" className="pt-4">
                            <JourneyVisualView journeys={filteredData} totalSessions={totalJourneySessions} />
                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">
                            <JourneyTableView journeys={filteredData} totalSessions={totalJourneySessions} />
                        </Tabs.Panel>
                    </Tabs>

                    <div className="flex justify-end mt-8">
                        <Button
                            size="small"
                            variant="secondary"
                            icon={copySuccess ? <Check size={16} /> : <Share2 size={16} />}
                            onClick={copyShareLink}
                        >
                            {copySuccess ? 'Kopiert!' : 'Del analyse'}
                        </Button>
                    </div>
                </>
            )}

            {!loading && !error && queryStats?.totalBytesProcessedGB !== undefined && (
                <div className="text-sm text-[var(--ax-text-subtle)] text-right mt-4">
                    Data prosessert: {queryStats.totalBytesProcessedGB} GB
                </div>
            )}

            {!loading && urlPath && data.length === 0 && !error && (
                <div className="flex justify-center items-center h-full text-gray-500">
                    Ingen egendefinerte hendelser funnet for valgt periode og filter.
                </div>
            )}
        </ChartLayout>
    );
};

export default EventJourney;

