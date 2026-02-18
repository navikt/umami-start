import { useState } from 'react';
import { TextField, Button, Alert, Loader, Tabs, UNSAFE_Combobox } from '@navikt/ds-react';
import { Share2, Check, ArrowRight } from 'lucide-react';
import ChartLayout from '../../analysis/ui/ChartLayout.tsx';
import WebsitePicker from '../../analysis/ui/WebsitePicker.tsx';
import PeriodPicker from '../../analysis/ui/PeriodPicker.tsx';
import { normalizeUrlToPath } from '../../../shared/lib/utils.ts';
import { useEventJourney } from '../hooks/useEventJourney.ts';
import { parseJourneyStep } from '../utils/parsers.ts';
import { formatNumber, getPercentage } from '../utils/formatters.ts';
import { getUniqueEventTypes, filterJourneys } from '../utils/journeyFilters.ts';
import { copyToClipboard } from '../utils/clipboard.ts';

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

    // Client-side filter state
    const [filterText, setFilterText] = useState<string>('');
    const [excludedEventTypes, setExcludedEventTypes] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string>('visual');
    const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
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

    const toggleDetailsExpansion = (stepKey: string) => {
        setExpandedDetails((current) => ({
            ...current,
            [stepKey]: !current[stepKey],
        }));
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
                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {/* Unique Visitors */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Unike besøkende</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {formatNumber(journeyStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">Totalt i utvalget</div>
                        </div>

                        {/* Interactive */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Utførte handlinger</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {getPercentage(journeyStats?.sessions_with_events || 0, journeyStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                                {formatNumber(journeyStats?.sessions_with_events || 0)} sesjoner
                            </div>
                        </div>

                        {/* Navigated No Events */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Navigering uten handling</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {getPercentage(journeyStats?.sessions_no_events_navigated || 0, journeyStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                                {formatNumber(journeyStats?.sessions_no_events_navigated || 0)} sesjoner
                            </div>
                        </div>

                        {/* Bounced */}
                        <div className="bg-[var(--ax-bg-default)] p-4 rounded-lg border border-[var(--ax-border-neutral-subtle)] shadow-sm">
                            <div className="text-sm text-[var(--ax-text-default)] font-medium mb-1">Forlot nettstedet</div>
                            <div className="text-2xl font-bold text-[var(--ax-text-default)] mb-1">
                                {getPercentage(journeyStats?.sessions_no_events_bounced || 0, journeyStats?.total_sessions || 0)}
                            </div>
                            <div className="text-sm text-[var(--ax-text-subtle)] mt-1">
                                {formatNumber(journeyStats?.sessions_no_events_bounced || 0)} sesjoner
                            </div>
                        </div>
                    </div>


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
                            <div className="bg-[var(--ax-bg-default)]">
                                {filteredData.length > 0 ? (
                                    <div className="space-y-4">
                                        {filteredData.map((journey, idx) => (
                                            <div key={idx} className="rounded-xl border border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-default)] p-4">
                                                <div className="flex items-center gap-2 text-sm text-[var(--ax-text-subtle)] mb-3">
                                                    <span className="font-semibold text-[var(--ax-text-default)]">{formatNumber(journey.count)} sesjoner</span>
                                                    <span>({((journey.count / totalJourneySessions) * 100).toFixed(1)}% av totalt)</span>
                                                </div>

                                                <div className="overflow-x-auto pb-1">
                                                    <div className="flex min-w-max items-stretch gap-2">
                                                        {journey.path.map((step, stepIndex) => {
                                                            const parsedStep = parseJourneyStep(step);
                                                            const stepKey = `${idx}-${stepIndex}`;
                                                            const isExpanded = expandedDetails[stepKey] === true;
                                                            const detailsToRender = isExpanded ? parsedStep.details : parsedStep.details.slice(0, 4);
                                                            const hiddenDetailsCount = parsedStep.details.length - detailsToRender.length;

                                                            return (
                                                                <div key={`${step}-${stepIndex}`} className="flex items-center gap-2">
                                                                    <div className="w-[320px] min-h-[120px] rounded-lg border border-[var(--ax-border-neutral-subtle)] bg-[var(--ax-bg-neutral-soft)] p-3">
                                                                        <div className="text-xs font-medium text-[var(--ax-text-subtle)] mb-1">
                                                                            Steg {stepIndex + 1}
                                                                        </div>
                                                                        <div className="text-sm font-semibold text-[var(--ax-text-default)] break-words">
                                                                            {parsedStep.eventName}
                                                                        </div>
                                                                        {detailsToRender.length > 0 && (
                                                                            <div className="mt-2 space-y-1">
                                                                                {detailsToRender.map((detail, detailIndex) => (
                                                                                    <div key={`${detail.key}-${detail.value}-${detailIndex}`} className="text-sm leading-5">
                                                                                        <span className="font-bold text-[var(--ax-text-default)]">{detail.key}:</span>{' '}
                                                                                        <span className="text-[var(--ax-text-default)] break-words">{detail.value}</span>
                                                                                    </div>
                                                                                ))}
                                                                                {parsedStep.details.length > 4 && (
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="xsmall"
                                                                                        variant="secondary"
                                                                                        data-color="neutral"
                                                                                        onClick={() => toggleDetailsExpansion(stepKey)}
                                                                                        className="mt-1 w-fit"
                                                                                    >
                                                                                        {isExpanded ? 'Vis færre felter' : `Vis alle felter (+${hiddenDetailsCount})`}
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {stepIndex < journey.path.length - 1 && (
                                                                        <ArrowRight size={16} className="text-[var(--ax-text-subtle)] flex-shrink-0" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500 py-8">
                                        Ingen reiser matcher søket ditt.
                                    </div>
                                )}
                            </div>
                        </Tabs.Panel>

                        <Tabs.Panel value="table" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                                        <thead className="bg-[var(--ax-bg-neutral-soft)]">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Antall</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Andel</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">Sti</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                                            {filteredData.map((journey, idx) => (
                                                <tr key={idx} className="hover:bg-[var(--ax-bg-neutral-soft)]">
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)]">{journey.count}</td>
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)]">{((journey.count / totalJourneySessions) * 100).toFixed(1)}%</td>
                                                    <td className="px-4 py-2 text-sm text-[var(--ax-text-default)] break-words">
                                                        {journey.path.map((step) => parseJourneyStep(step).eventName).join(' → ')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
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

