import { Alert, Select, Button, ReadMore, Label, UNSAFE_Combobox, Modal, DatePicker } from "@navikt/ds-react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { getDashboard } from "../data/dashboard";
import { DashboardWidget } from "../components/DashboardWidget";
import DashboardWebsitePicker from "../components/DashboardWebsitePicker";
import { fetchDashboardDataBatched, isBatchableChart } from "../lib/batchedDashboardFetcher";
import { format } from "date-fns";

const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const websiteId = searchParams.get("websiteId");
    // Support domain-based lookups for external apps
    const domainFromUrl = searchParams.get("domain");
    // Support multiple paths from URL (comma-separated or multiple params)
    const pathsFromUrl = searchParams.getAll("path");
    const initialPaths = pathsFromUrl.length > 0 ? pathsFromUrl : [];
    const pathOperator = searchParams.get("pathOperator");
    // Support both old 'metricType' and new 'metrikk' params
    const metricTypeFromUrl = (searchParams.get("metrikk") || searchParams.get("metricType")) as 'visitors' | 'pageviews' | 'proportion' | null;
    // Support 'periode' param for date range
    // Support 'periode' param for date range
    const rawDateRangeFromUrl = searchParams.get("periode");
    // Normalize legacy URL params to match PeriodPicker values (underscore instead of hyphen)
    const dateRangeFromUrl = rawDateRangeFromUrl === 'this-month' ? 'current_month'
        : rawDateRangeFromUrl === 'last-month' ? 'last_month'
            : rawDateRangeFromUrl;

    const dashboardId = searchParams.get("visning");

    const dashboard = getDashboard(dashboardId);

    // Track if we're resolving a domain to websiteId
    const [isResolvingDomain, setIsResolvingDomain] = useState(false);
    const [domainResolutionError, setDomainResolutionError] = useState<string | null>(null);
    // Track if initial filters have been auto-applied (for external links)
    const [hasAutoAppliedFilters, setHasAutoAppliedFilters] = useState(false);

    // Website Picker State
    const [selectedWebsite, setSelectedWebsite] = useState<any>(null);

    // Initialize custom filter values from URL params (translating slug to value)
    const getInitialCustomFilterValues = (): Record<string, string> => {
        const values: Record<string, string> = {};
        dashboard.customFilters?.forEach(filter => {
            if (filter.urlParam) {
                const urlSlug = searchParams.get(filter.urlParam);
                if (urlSlug) {
                    // Find option by slug or by value (for backwards compatibility)
                    const option = filter.options.find(opt =>
                        opt.slug === urlSlug || opt.value === urlSlug
                    );
                    // Store the value (not slug) for filtering
                    values[filter.id] = option?.value || urlSlug;
                }
            }
        });
        return values;
    };

    // Custom filter state: keyed by filter id
    const [customFilterValues, setCustomFilterValues] = useState<Record<string, string>>(getInitialCustomFilterValues);

    // Determine default path operator from dashboard config or URL
    const defaultPathOperator = dashboard.defaultFilterValues?.pathOperator || pathOperator || "equals";

    // Get initial URL paths: first check custom filter URL params, then fall back to path params
    const getInitialUrlPaths = (): string[] => {
        // Check if any custom filter has a URL param that maps to urlPath
        const initialCustomValues = getInitialCustomFilterValues();
        for (const filter of dashboard.customFilters || []) {
            if (filter.appliesTo === 'urlPath' && filter.urlParam) {
                const value = initialCustomValues[filter.id];
                if (value) {
                    return [value];
                }
            }
        }
        return initialPaths;
    };

    const initialUrlPathsFromCustomFilter = getInitialUrlPaths();

    // UI/Temp State
    const [tempPathOperator, setTempPathOperator] = useState(defaultPathOperator);
    const [tempUrlPaths, setTempUrlPaths] = useState<string[]>(initialUrlPathsFromCustomFilter);
    const [tempDateRange, setTempDateRange] = useState(dateRangeFromUrl || "current_month");
    const [tempMetricType, setTempMetricType] = useState<'visitors' | 'pageviews' | 'proportion'>(metricTypeFromUrl || 'visitors');

    // Custom date state
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const dateModalRef = useRef<HTMLDialogElement>(null);

    // Active filters used for fetching data
    const [activeFilters, setActiveFilters] = useState({
        pathOperator: defaultPathOperator,
        urlFilters: initialUrlPathsFromCustomFilter,
        dateRange: dateRangeFromUrl || "current_month",
        customStartDate: undefined as Date | undefined,
        customEndDate: undefined as Date | undefined,
        metricType: (metricTypeFromUrl || 'visitors') as 'visitors' | 'pageviews' | 'proportion'
    });

    // Active website state to ensure widget only updates on "Oppdater"
    const [activeWebsite, setActiveWebsite] = useState<any>(null);

    // Batched session data - stores pre-fetched data for session-metric charts
    const [batchedData, setBatchedData] = useState<Map<string, any[]>>(new Map());
    // Track if batching is complete
    const [batchingComplete, setBatchingComplete] = useState(false);

    // Check for hidden filters and use effective websiteId
    const effectiveWebsiteId = websiteId || dashboard.defaultFilterValues?.websiteId;

    // Helper function matching metadashboard.tsx logic
    const normalizeDomain = (domain: string) => {
        if (domain === "www.nav.no") return domain;
        return domain.replace(/^www\./, "");
    };

    // Resolve domain to websiteId for external app compatibility
    useEffect(() => {
        const resolveDomainToWebsiteId = async () => {
            // Skip if we already have a websiteId or no domain provided
            if (websiteId || !domainFromUrl) return;

            setIsResolvingDomain(true);
            setDomainResolutionError(null);

            try {
                // Fetch websites list
                const response = await fetch('/api/bigquery/websites');
                const data = await response.json();
                const websitesData = data.data || [];

                // Filter for prod websites - same team IDs as metadashboard.tsx
                const relevantTeams = [
                    'aa113c34-e213-4ed6-a4f0-0aea8a503e6b',
                    'bceb3300-a2fb-4f73-8cec-7e3673072b30'
                ];
                const prodWebsites = websitesData.filter((website: any) =>
                    relevantTeams.includes(website.teamId)
                );

                // Filter out exactly "nav.no" domain
                const filteredWebsites = prodWebsites.filter((item: any) => item.domain !== "nav.no");

                // Normalize input domain for matching (handle nav.no -> www.nav.no)
                let inputDomain = domainFromUrl;
                if (inputDomain === "nav.no") {
                    inputDomain = "www.nav.no";
                }
                const normalizedInputDomain = normalizeDomain(inputDomain);

                // Find matching website using same logic as metadashboard.tsx
                const matchedWebsite = filteredWebsites.find((item: any) =>
                    normalizeDomain(item.domain) === normalizedInputDomain ||
                    normalizedInputDomain.endsWith(`.${normalizeDomain(item.domain)}`)
                );

                if (matchedWebsite) {
                    // Update URL to use websiteId instead of domain (cleaner URLs)
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('websiteId', matchedWebsite.id);
                    newParams.delete('domain'); // Remove domain since we now have websiteId
                    setSearchParams(newParams, { replace: true });

                    // Set the website
                    setSelectedWebsite(matchedWebsite);
                    setActiveWebsite(matchedWebsite);
                } else {
                    setDomainResolutionError(`Fant ingen nettside for domenet "${domainFromUrl}"`);
                }
            } catch (error) {
                console.error('Error resolving domain to websiteId:', error);
                setDomainResolutionError('Kunne ikke slå opp domenet');
            } finally {
                setIsResolvingDomain(false);
            }
        };

        resolveDomainToWebsiteId();
    }, [domainFromUrl, websiteId, searchParams, setSearchParams]);

    // Auto-apply filters when coming from an external link with paths
    useEffect(() => {
        if (!hasAutoAppliedFilters && selectedWebsite && initialPaths.length > 0) {
            // Auto-apply filters without requiring user to click "Oppdater"
            setActiveFilters({
                pathOperator: pathOperator || "equals",
                urlFilters: initialPaths,
                dateRange: "current_month",
                customStartDate: undefined,
                customEndDate: undefined,
                metricType: metricTypeFromUrl || 'visitors'
            });
            setHasAutoAppliedFilters(true);
        }
    }, [selectedWebsite, initialPaths, pathOperator, hasAutoAppliedFilters, metricTypeFromUrl]);

    // SYNC: Compute batchable chart IDs immediately (not in effect) so widgets know on first render
    const batchableChartIds = useMemo(() => {
        const batchableCharts = dashboard.charts.filter(c => c.id && isBatchableChart(c));
        // Only batch if we have 2+ charts to batch
        if (batchableCharts.length < 2) return new Set<string>();
        return new Set(batchableCharts.map(c => c.id!));
    }, [dashboard.charts]);

    // Sync activeWebsite when selectedWebsite matches the URL websiteId (initial load or after navigation)
    useEffect(() => {
        if (selectedWebsite && selectedWebsite.id === websiteId) {
            setActiveWebsite(selectedWebsite);
        }
    }, [selectedWebsite, websiteId]);

    // Reset batching state when filters change
    useEffect(() => {
        setBatchingComplete(false);
        setBatchedData(new Map());
    }, [effectiveWebsiteId, activeFilters]);

    // Fetch batched session data when filters/websiteId change
    useEffect(() => {
        const fetchBatchedData = async () => {
            if (!effectiveWebsiteId) {
                setBatchingComplete(true);
                return;
            }

            // Get charts that can be batched (session-metric charts)
            const batchableCharts = dashboard.charts.filter(c => c.id && isBatchableChart(c));

            if (batchableCharts.length < 2) {
                // Not worth batching if less than 2 charts
                setBatchedData(new Map());
                setBatchingComplete(true);
                return;
            }

            try {
                const result = await fetchDashboardDataBatched(
                    dashboard.charts,
                    effectiveWebsiteId,
                    activeFilters
                );

                setBatchedData(result.chartResults);

                // Report stats for batched charts
                for (const [chartId, bytes] of result.chartBytes) {
                    const chart = dashboard.charts.find(c => c.id === chartId);
                    if (chart) {
                        const gb = bytes / (1024 ** 3);
                        setStats(prev => ({
                            ...prev,
                            [chartId]: { gb, title: chart.title }
                        }));
                    }
                }
            } catch (error) {
                console.error('[Dashboard] Batched fetch failed:', error);
                setBatchedData(new Map());
            } finally {
                setBatchingComplete(true);
            }
        };

        fetchBatchedData();
    }, [effectiveWebsiteId, activeFilters, dashboard.charts]);

    const handleUpdate = () => {
        const url = new URL(window.location.href);

        // Update URL with selected website ID and filters (only if website filter is visible)
        if (!dashboard.hiddenFilters?.website && selectedWebsite) {
            setActiveWebsite(selectedWebsite); // Explicitly update active website
            url.searchParams.set('websiteId', selectedWebsite.id);

            // Update path filter in URL (support multiple paths)
            url.searchParams.delete('path');
            tempUrlPaths.forEach(p => {
                if (p) url.searchParams.append('path', p);
            });

            // Update pathOperator in URL (only if not default "equals")
            if (tempPathOperator && tempPathOperator !== "equals") {
                url.searchParams.set('pathOperator', tempPathOperator);
            } else {
                url.searchParams.delete('pathOperator');
            }
        }

        // Always update dateRange in URL (if not default)
        if (tempDateRange !== 'current_month') {
            url.searchParams.set('periode', tempDateRange);
        } else {
            url.searchParams.delete('periode');
        }

        // Always update metricType in URL (if not default)
        if (tempMetricType && tempMetricType !== "visitors") {
            url.searchParams.set('metrikk', tempMetricType);
        } else {
            url.searchParams.delete('metrikk');
        }

        window.history.pushState({}, '', url.toString());

        setActiveFilters({
            pathOperator: tempPathOperator,
            urlFilters: tempUrlPaths,
            dateRange: tempDateRange,
            customStartDate: tempDateRange === 'custom' ? customStartDate : undefined,
            customEndDate: tempDateRange === 'custom' ? customEndDate : undefined,
            metricType: tempMetricType
        });
    };

    // Handle custom filter selection (e.g., Nav fylkeskontor)
    const handleCustomFilterChange = (filterId: string, value: string) => {
        setCustomFilterValues(prev => ({ ...prev, [filterId]: value }));

        // Find the filter definition to determine how to apply it
        const filterDef = dashboard.customFilters?.find(f => f.id === filterId);
        if (filterDef) {
            // Update URL with slug (for clean URLs) or value as fallback
            if (filterDef.urlParam) {
                const url = new URL(window.location.href);
                if (value) {
                    // Find the option to get its slug
                    const option = filterDef.options.find(opt => opt.value === value);
                    const urlValue = option?.slug || value;
                    url.searchParams.set(filterDef.urlParam, urlValue);
                } else {
                    url.searchParams.delete(filterDef.urlParam);
                }
                window.history.pushState({}, '', url.toString());
            }

            // Apply to URL path filter if configured
            if (filterDef.appliesTo === 'urlPath') {
                // If value is empty, clear the path; otherwise set it
                if (value) {
                    setTempUrlPaths([value]);
                    setTempPathOperator(filterDef.pathOperator);
                } else {
                    setTempUrlPaths([]);
                }
            }
        }
    };

    // Helper to compare arrays
    const arraysEqual = (a: string[], b: string[]) =>
        a.length === b.length && a.every((v, i) => v === b[i]);

    // Helper to compare dates (handles undefined)
    const datesEqual = (a: Date | undefined, b: Date | undefined) => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        return a.getTime() === b.getTime();
    };

    const hasChanges =
        tempDateRange !== activeFilters.dateRange ||
        !arraysEqual(tempUrlPaths, activeFilters.urlFilters) ||
        tempPathOperator !== activeFilters.pathOperator ||
        tempMetricType !== activeFilters.metricType ||
        (!dashboard.hiddenFilters?.website && selectedWebsite && selectedWebsite.id !== websiteId) ||
        (tempDateRange === 'custom' && (
            !datesEqual(customStartDate, activeFilters.customStartDate) ||
            !datesEqual(customEndDate, activeFilters.customEndDate)
        ));

    // Check if all required custom filters are satisfied
    const requiredFiltersAreSatisfied = useMemo(() => {
        if (!dashboard.customFilters) return true;

        const requiredFilters = dashboard.customFilters.filter(f => f.required);
        if (requiredFilters.length === 0) return true;

        // Check if all required filters have values in activeFilters
        // For urlPath filters, check if there's a path selected
        return requiredFilters.every(filter => {
            if (filter.appliesTo === 'urlPath') {
                return activeFilters.urlFilters.length > 0;
            }
            return !!customFilterValues[filter.id];
        });
    }, [dashboard.customFilters, activeFilters.urlFilters, customFilterValues]);

    const filters = (
        <>
            {/* Website picker - only show if not hidden */}
            {!dashboard.hiddenFilters?.website && (
                <div className="w-full sm:w-[200px]">
                    <DashboardWebsitePicker
                        selectedWebsite={selectedWebsite}
                        onWebsiteChange={setSelectedWebsite}
                        variant="minimal"
                        size="small"
                        disableUrlUpdate
                    />
                </div>
            )}

            {/* URL-sti filter - only show if not hidden */}
            {!dashboard.hiddenFilters?.urlPath && (
                <div className="w-full sm:w-[300px]">
                    <div className="flex items-center gap-2 mb-1">
                        <Label size="small" htmlFor="url-filter">URL-sti</Label>
                        <select
                            className="text-sm bg-white border border-gray-300 rounded text-[#0067c5] font-medium cursor-pointer focus:outline-none py-1 px-2"
                            value={tempPathOperator}
                            onChange={(e) => setTempPathOperator(e.target.value)}
                        >
                            <option value="equals">er lik</option>
                            <option value="starts-with">starter med</option>
                        </select>
                    </div>
                    <UNSAFE_Combobox
                        id="url-filter"
                        label="URL-stier"
                        hideLabel
                        size="small"
                        isMultiSelect
                        allowNewValues
                        options={tempUrlPaths.map(p => ({ label: p, value: p }))}
                        selectedOptions={tempUrlPaths}
                        onToggleSelected={(option, isSelected) => {
                            if (isSelected) {
                                setTempUrlPaths(prev => [...prev, option]);
                            } else {
                                setTempUrlPaths(prev => prev.filter(p => p !== option));
                            }
                        }}
                        placeholder="Skriv og trykk enter"
                    />
                </div>
            )}

            {/* Custom filters (e.g., Nav kontor) */}
            {dashboard.customFilters?.map(filter => (
                <div key={filter.id} className="w-full sm:w-auto min-w-[200px]">
                    <Select
                        label={filter.label}
                        size="small"
                        value={customFilterValues[filter.id] || ''}
                        onChange={(e) => handleCustomFilterChange(filter.id, e.target.value)}
                    >
                        <option value="">Velg {filter.label.toLowerCase()}</option>
                        {filter.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </Select>
                </div>
            ))}

            {/* Date range filter - only show if not hidden */}
            {!dashboard.hiddenFilters?.dateRange && (
                <div className="w-full sm:w-auto min-w-[200px]">
                    <Select
                        label="Datoperiode"
                        size="small"
                        value={tempDateRange}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'custom') {
                                setIsDateModalOpen(true);
                            } else if (value === 'custom-edit') {
                                // Clear dates so user can start fresh
                                setCustomStartDate(undefined);
                                setCustomEndDate(undefined);
                                setIsDateModalOpen(true);
                            } else {
                                setTempDateRange(value);
                            }
                        }}
                    >
                        <option value="current_month">Denne måneden</option>
                        <option value="last_month">Forrige måned</option>
                        {tempDateRange === 'custom' && customStartDate && customEndDate ? (
                            <>
                                <option value="custom">
                                    {`${format(customStartDate, 'dd.MM.yy')} - ${format(customEndDate, 'dd.MM.yy')}`}
                                </option>
                                <option value="custom-edit">Endre datoer</option>
                            </>
                        ) : (
                            <option value="custom">Egendefinert</option>
                        )}
                    </Select>
                </div>
            )}

            {/* Metric type filter - only show if not hidden */}
            {!dashboard.hiddenFilters?.metricType && (
                <div className="w-full sm:w-auto min-w-[150px]">
                    <Select
                        label="Visning"
                        size="small"
                        value={tempMetricType}
                        onChange={(e) => setTempMetricType(e.target.value as 'visitors' | 'pageviews' | 'proportion')}
                    >
                        {(!dashboard.metricTypeOptions || dashboard.metricTypeOptions.includes('visitors')) && (
                            <option value="visitors">Unike besøkende</option>
                        )}
                        {(!dashboard.metricTypeOptions || dashboard.metricTypeOptions.includes('pageviews')) && (
                            <option value="pageviews">Sidevisninger</option>
                        )}
                        {(!dashboard.metricTypeOptions || dashboard.metricTypeOptions.includes('proportion')) && (
                            <option value="proportion">Andel (%)</option>
                        )}
                    </Select>
                </div>
            )}

            <div className="flex items-end pb-[2px]">
                <Button onClick={handleUpdate} size="small" disabled={!hasChanges}>
                    Oppdater
                </Button>
            </div>

            {/* Custom Date Modal */}
            <Modal
                ref={dateModalRef}
                open={isDateModalOpen}
                onClose={() => setIsDateModalOpen(false)}
                header={{ heading: "Velg datoperiode", closeButton: true }}
            >
                <Modal.Body>
                    <div className="flex flex-col gap-4">
                        <DatePicker
                            mode="range"
                            selected={{ from: customStartDate, to: customEndDate }}
                            onSelect={(range) => {
                                if (range) {
                                    setCustomStartDate(range.from);
                                    setCustomEndDate(range.to);
                                }
                            }}
                        >
                            <div className="flex flex-col gap-2">
                                <DatePicker.Input
                                    id="custom-start-date"
                                    label="Fra dato"
                                    size="small"
                                    value={customStartDate ? format(customStartDate, 'dd.MM.yyyy') : ''}
                                />
                                <DatePicker.Input
                                    id="custom-end-date"
                                    label="Til dato"
                                    size="small"
                                    value={customEndDate ? format(customEndDate, 'dd.MM.yyyy') : ''}
                                />
                            </div>
                        </DatePicker>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={() => {
                            if (customStartDate && customEndDate) {
                                setTempDateRange('custom');
                                setIsDateModalOpen(false);
                            }
                        }}
                        disabled={!customStartDate || !customEndDate}
                    >
                        Bruk datoer
                    </Button>
                    <Button variant="secondary" onClick={() => setIsDateModalOpen(false)}>
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );

    const [stats, setStats] = useState<Record<string, { gb: number, title: string }>>({});

    const handleDataLoaded = (data: { id: string; gb: number; title: string }) => {
        setStats(prev => ({
            ...prev,
            [data.id]: { gb: data.gb, title: data.title }
        }));
    };

    const totalGb = Object.values(stats).reduce((acc, curr) => acc + curr.gb, 0);

    // Get the siteimprove group ID based on the currently active URL path filter
    const getSiteimproveGroupId = useMemo(() => {
        // Find any custom filter that has siteimprove_groupid in options
        for (const filter of dashboard.customFilters || []) {
            if (filter.appliesTo === 'urlPath' && activeFilters.urlFilters.length > 0) {
                const selectedPath = activeFilters.urlFilters[0];
                const option = filter.options.find(opt => opt.value === selectedPath);
                if (option?.siteimprove_groupid) {
                    return option.siteimprove_groupid;
                }
            }
        }
        return undefined;
    }, [dashboard.customFilters, activeFilters.urlFilters]);

    return (
        <DashboardLayout
            title={dashboard.title}
            description={dashboard.description}
            filters={filters}
        >
            {isResolvingDomain ? (
                <></>
            ) : domainResolutionError ? (
                <div className="p-8 col-span-full">
                    <Alert variant="error" size="small">
                        {domainResolutionError}
                    </Alert>
                </div>
            ) : !effectiveWebsiteId ? (
                <div className="w-fit">
                    <Alert variant="info" size="small">
                        Legg til URL-sti og trykk Oppdater for å vise statistikk.
                    </Alert>
                </div>
            ) : !requiredFiltersAreSatisfied ? (
                <div className="w-fit">
                    <Alert variant="info" size="small">
                        {dashboard.customFilterRequiredMessage || "Velg nødvendige filtre for å vise data."}
                    </Alert>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-20 gap-6">
                    {dashboard.charts.map((chart) => (
                        <DashboardWidget
                            key={chart.id}
                            chart={chart}
                            websiteId={effectiveWebsiteId}
                            filters={activeFilters}
                            onDataLoaded={handleDataLoaded}
                            selectedWebsite={activeWebsite}
                            prefetchedData={chart.id ? batchedData.get(chart.id) : undefined}
                            shouldWaitForBatch={chart.id ? batchableChartIds.has(chart.id) && !batchingComplete : false}
                            siteimproveGroupId={getSiteimproveGroupId}
                        />
                    ))}

                    {dashboard.charts.length === 0 && (
                        <div className="col-span-full">
                            <Alert variant="info">Ingen diagrammer konfigurert.</Alert>
                        </div>
                    )}

                    {Object.keys(stats).length > 0 && (() => {
                        // Separate batched and individual charts
                        const batchedChartStats = Object.entries(stats).filter(([id]) => batchableChartIds.has(id));
                        const individualChartStats = Object.entries(stats).filter(([id]) => !batchableChartIds.has(id));
                        const batchedTotalGb = batchedChartStats.reduce((acc, [, stat]) => acc + stat.gb, 0);

                        return (
                            <div className="col-span-full mt-5">
                                <div>
                                    <ReadMore header={`${Math.round(totalGb)} GB prosessert`} size="small">
                                        <div className="text-sm text-gray-600">
                                            {/* Individual queries */}
                                            {individualChartStats.length > 0 && (
                                                <ul className="list-disc pl-5 mb-3">
                                                    {individualChartStats.map(([id, stat]) => (
                                                        <li key={id}>
                                                            <span className="font-medium">{Math.round(stat.gb)} GB</span> - {stat.title}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}

                                            {/* Batched queries - shown grouped */}
                                            {batchedChartStats.length > 0 && (
                                                <div className="border-l-4 border-green-500 pl-3 py-1 bg-green-50 rounded-r">
                                                    <div className="font-medium text-green-700 mb-1">
                                                        Kombinert spørring: {Math.round(batchedTotalGb)} GB for {batchedChartStats.length} diagrammer
                                                    </div>
                                                    <ul className="list-disc pl-5 text-green-800">
                                                        {batchedChartStats.map(([id, stat]) => (
                                                            <li key={id}>{stat.title}</li>
                                                        ))}
                                                    </ul>
                                                    <div className="text-xs text-green-600 mt-1">
                                                        Spart ~{Math.round(batchedTotalGb * (batchedChartStats.length - 1))} GB ved å kombinere disse spørringene
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </ReadMore>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </DashboardLayout>
    );
};

export default Dashboard;
