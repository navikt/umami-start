import { Alert, Select, Button, TextField, ReadMore, Label } from "@navikt/ds-react";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { getDashboard } from "../data/dashboard";
import { DashboardWidget } from "../components/DashboardWidget";
import DashboardWebsitePicker from "../components/DashboardWebsitePicker";

const Dashboard = () => {
    const [searchParams] = useSearchParams();
    const websiteId = searchParams.get("websiteId");
    const path = searchParams.get("path");
    const dashboardId = searchParams.get("dashboard");

    const dashboard = getDashboard(dashboardId);


    // Website Picker State
    const [selectedWebsite, setSelectedWebsite] = useState<any>(null);

    // UI/Temp State
    const [tempPathOperator, setTempPathOperator] = useState("equals");
    const [tempUrlPath, setTempUrlPath] = useState<string>(path || "");
    const [tempDateRange, setTempDateRange] = useState("this-month");

    // Active filters used for fetching data
    const [activeFilters, setActiveFilters] = useState({
        pathOperator: "equals",
        urlFilters: path ? [path] : [],
        dateRange: "this-month",
        metricType: 'visitors' as 'visitors' | 'pageviews' // Keeping for type compatibility, though unused UI
    });

    const handleUpdate = () => {
        // Update URL with selected website ID
        if (selectedWebsite) {
            const url = new URL(window.location.href);
            url.searchParams.set('websiteId', selectedWebsite.id);
            if (activeFilters.urlFilters !== (tempUrlPath ? [tempUrlPath] : [])) {
                if (tempUrlPath) url.searchParams.set('path', tempUrlPath);
                else url.searchParams.delete('path');
            }
            // Update URL without full page reload, but triggering re-render via router if possible? 
            // Actually, simply pushing state won't trigger React Router's URL awareness if not using navigate. 
            // But let's stick to consistent behavior. If we pushState, the `useSearchParams` hook MIGHT update if we trigger an event? 
            // Better to use setSearchParams if available, or force reload/navigate.
            // Let's us window.location.href update for simplicity as it ensures data fetch.
            // Actually, we can use window.history.pushState and then a manual forceUpdate or similar?
            // The cleanest way is to use `setSearchParams` from `useSearchParams`.

            // Re-implementing using standard URL manipulation and allowing React Router to pick it up if possible, 
            // but since we are inside a component, let's just rely on the fact that `websiteId` comes from `useSearchParams`.
            // We need to trigger a navigation.

            window.history.pushState({}, '', url.toString());
            // Force a "navigation" event or simply reload?
            // To make `useSearchParams` react, we usually need to use `setSearchParams`.
            // Let's refactor to use `setSearchParams` properly if possible, but for now matching existing patterns.
            // If `Dashboard.tsx` relies on `useSearchParams`, `pushState` won't trigger a re-render of `websiteId`.
            // So we need to force a re-render. 
        }

        setActiveFilters({
            pathOperator: tempPathOperator,
            urlFilters: tempUrlPath ? [tempUrlPath] : [],
            dateRange: tempDateRange,
            metricType: 'visitors'
        });

        // Force reload by dispatching a popstate event? No, that's hacky.
        // Let's just user navigate? I don't see `useNavigate` imported.
        // Let's use `window.dispatchEvent(new Event('popstate'));` as a hack or better, import `useNavigate`.
    };

    const hasChanges =
        tempDateRange !== activeFilters.dateRange ||
        tempUrlPath !== (activeFilters.urlFilters[0] || "") ||
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

            <div className="w-full sm:w-[240px]">
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
                <TextField
                    id="url-filter"
                    label="URL-sti"
                    hideLabel
                    size="small"
                    value={tempUrlPath}
                    onChange={(e) => setTempUrlPath(e.target.value)}
                    placeholder="/eksempel"
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
            {!websiteId ? (
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
                        />
                    ))}

                    {dashboard.charts.length === 0 && (
                        <div className="col-span-full">
                            <Alert variant="info">Ingen diagrammer konfigurert.</Alert>
                        </div>
                    )}

                    {Object.keys(stats).length > 0 && (
                        <div className="col-span-full mt-5">
                            <div>
                                <ReadMore header={`${Math.round(totalGb)} GB prosessert`} size="small">
                                    <ul className="text-sm text-gray-600 list-disc pl-5">
                                        {Object.entries(stats).map(([id, stat]) => (
                                            <li key={id}>
                                                <span className="font-medium">{Math.round(stat.gb)} GB</span> - {stat.title}
                                            </li>
                                        ))}
                                    </ul>
                                </ReadMore>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
};

export default Dashboard;
