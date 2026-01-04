import { Alert, Select, Button, ReadMore, Label, UNSAFE_Combobox } from "@navikt/ds-react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { getDashboard } from "../data/dashboard";
import { DashboardWidget } from "../components/DashboardWidget";
import DashboardWebsitePicker from "../components/DashboardWebsitePicker";
import { fetchDashboardDataBatched, isBatchableChart } from "../lib/batchedDashboardFetcher";

const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const websiteId = searchParams.get("websiteId");
    // Support domain-based lookups for external apps
    const domainFromUrl = searchParams.get("domain");
    // Support multiple paths from URL (comma-separated or multiple params)
    const pathsFromUrl = searchParams.getAll("path");
    const initialPaths = pathsFromUrl.length > 0 ? pathsFromUrl : [];
    const pathOperator = searchParams.get("pathOperator");
    const dashboardId = searchParams.get("dashboard");

    const dashboard = getDashboard(dashboardId);

    // Track if we're resolving a domain to websiteId
    const [isResolvingDomain, setIsResolvingDomain] = useState(false);
    const [domainResolutionError, setDomainResolutionError] = useState<string | null>(null);
    // Track if initial filters have been auto-applied (for external links)
    const [hasAutoAppliedFilters, setHasAutoAppliedFilters] = useState(false);

    // Website Picker State
    const [selectedWebsite, setSelectedWebsite] = useState<any>(null);

    // UI/Temp State
    const [tempPathOperator, setTempPathOperator] = useState(pathOperator || "equals");
    const [tempUrlPaths, setTempUrlPaths] = useState<string[]>(initialPaths);
    const [tempDateRange, setTempDateRange] = useState("this-month");

    // Active filters used for fetching data
    const [activeFilters, setActiveFilters] = useState({
        pathOperator: pathOperator || "equals",
        urlFilters: initialPaths,
        dateRange: "this-month",
        metricType: 'visitors' as 'visitors' | 'pageviews' // Keeping for type compatibility, though unused UI
    });

    // Active website state to ensure widget only updates on "Oppdater"
    const [activeWebsite, setActiveWebsite] = useState<any>(null);

    // Batched session data - stores pre-fetched data for session-metric charts
    const [batchedData, setBatchedData] = useState<Map<string, any[]>>(new Map());
    // Track if batching is complete
    const [batchingComplete, setBatchingComplete] = useState(false);

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
                const websites = data.data || [];

                // Normalize domain for matching (handle www. prefix)
                const normalizedDomain = domainFromUrl.replace(/^www\./, '');

                // Find matching website
                const matchedWebsite = websites.find((w: any) => {
                    const websiteDomain = (w.domain || '').replace(/^www\./, '');
                    return websiteDomain === normalizedDomain ||
                        normalizedDomain === websiteDomain ||
                        domainFromUrl === w.domain;
                });

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
                dateRange: "this-month",
                metricType: 'visitors'
            });
            setHasAutoAppliedFilters(true);
        }
    }, [selectedWebsite, initialPaths, pathOperator, hasAutoAppliedFilters]);

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
    }, [websiteId, activeFilters]);

    // Fetch batched session data when filters/websiteId change
    useEffect(() => {
        const fetchBatchedData = async () => {
            if (!websiteId) {
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
                    websiteId,
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
    }, [websiteId, activeFilters, dashboard.charts]);

    const handleUpdate = () => {
        // Update URL with selected website ID and filters
        if (selectedWebsite) {
            setActiveWebsite(selectedWebsite); // Explicitly update active website
            const url = new URL(window.location.href);
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

            window.history.pushState({}, '', url.toString());
        }

        setActiveFilters({
            pathOperator: tempPathOperator,
            urlFilters: tempUrlPaths,
            dateRange: tempDateRange,
            metricType: 'visitors'
        });
    };

    // Helper to compare arrays
    const arraysEqual = (a: string[], b: string[]) =>
        a.length === b.length && a.every((v, i) => v === b[i]);

    const hasChanges =
        tempDateRange !== activeFilters.dateRange ||
        !arraysEqual(tempUrlPaths, activeFilters.urlFilters) ||
        tempPathOperator !== activeFilters.pathOperator ||
        (selectedWebsite && selectedWebsite.id !== websiteId);

    const filters = (
        <>
            <div className="w-full sm:w-[200px]">
                <DashboardWebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={setSelectedWebsite}
                    variant="minimal"
                    size="small"
                    disableUrlUpdate
                />
            </div>

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

            <div className="w-full sm:w-auto min-w-[200px]">
                <Select
                    label="Datoperiode"
                    size="small"
                    value={tempDateRange}
                    onChange={(e) => setTempDateRange(e.target.value)}
                >
                    <option value="this-month">Denne måneden</option>
                    <option value="last-month">Forrige måned</option>
                </Select>
            </div>

            <div className="flex items-end pb-[2px]">
                <Button onClick={handleUpdate} size="small" disabled={!hasChanges}>
                    Oppdater
                </Button>
            </div>
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

    return (
        <DashboardLayout
            title={dashboard.title}
            description={dashboard.description}
            filters={filters}
        >
            {isResolvingDomain ? (
                <div className="p-8 col-span-full">
                    <Alert variant="info">
                        Slår opp nettside for domenet "{domainFromUrl}"...
                    </Alert>
                </div>
            ) : domainResolutionError ? (
                <div className="p-8 col-span-full">
                    <Alert variant="error">
                        {domainResolutionError}
                    </Alert>
                </div>
            ) : !websiteId ? (
                <div className="p-8 col-span-full">
                    <Alert variant="info">
                        Velg en nettside fra menyen for å se dashboardet.
                    </Alert>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-20 gap-6">
                    {dashboard.charts.map((chart) => (
                        <DashboardWidget
                            key={chart.id}
                            chart={chart}
                            websiteId={websiteId}
                            filters={activeFilters}
                            onDataLoaded={handleDataLoaded}
                            selectedWebsite={activeWebsite}
                            prefetchedData={chart.id ? batchedData.get(chart.id) : undefined}
                            shouldWaitForBatch={chart.id ? batchableChartIds.has(chart.id) && !batchingComplete : false}
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
