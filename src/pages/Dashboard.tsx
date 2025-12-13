import { Alert, Select, Button, TextField, ReadMore } from "@navikt/ds-react";
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
    const [tempPathOperator] = useState("equals");
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
        setActiveFilters({
            pathOperator: tempPathOperator,
            urlFilters: tempUrlPath ? [tempUrlPath] : [],
            dateRange: tempDateRange,
            metricType: 'visitors'
        });
    };

    const hasChanges =
        tempDateRange !== activeFilters.dateRange ||
        tempUrlPath !== (activeFilters.urlFilters[0] || "");

    const filters = (
        <>
            <div className="w-full sm:w-[200px]">
                <DashboardWebsitePicker
                    selectedWebsite={selectedWebsite}
                    onWebsiteChange={setSelectedWebsite}
                    variant="minimal"
                    size="small"
                />
            </div>

            <div className="w-full sm:w-[200px]">
                <TextField
                    label="URL-sti er lik"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
