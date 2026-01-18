import { Heading, BodyLong, LinkPanel } from "@navikt/ds-react";
import { Link } from "react-router-dom";
import { dashboards } from "../../data/dashboard";
import { BarChartIcon, Buildings3Icon, WheelchairIcon } from "@navikt/aksel-icons";
import Kontaktboks from "../../components/theme/Kontaktboks/Kontaktboks";

// Map dashboard IDs to metadata (icons and custom titles)
const dashboardMeta: Record<string, { icon: React.ReactNode; title?: string }> = {
    'standard': {
        icon: <BarChartIcon className="w-8 h-8 text-blue-600" aria-hidden />,
        title: 'Webstatistikk (generelt)'
    },
    'fylkeskontor': {
        icon: <Buildings3Icon className="w-8 h-8 text-blue-600" aria-hidden />,
        title: 'Nav fylkeskontor'
    },
    'hjelpemiddelsentral': {
        icon: <WheelchairIcon className="w-8 h-8 text-blue-600" aria-hidden />,
        title: 'Hjelpemiddelsentralene'
    }
};

const DashboardOverview = () => {
    const dashboardEntries = Object.entries(dashboards);

    return (
        <div className="py-8">
            <Heading size="xlarge" level="1" className="mb-2">
                Dashboard
            </Heading>
            <BodyLong className="mb-8 text-gray-600">
                Oversikt over tilpassede dashboard.
            </BodyLong>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {dashboardEntries.map(([id, config]) => {
                    const meta = dashboardMeta[id] || {
                        icon: <BarChartIcon className="w-8 h-8 text-blue-600" aria-hidden />
                    };

                    return (
                        <LinkPanel
                            as={Link}
                            key={id}
                            to={`/dashboard?visning=${id}`}
                            border
                            className="hover:shadow-md transition-shadow group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                    {meta.icon}
                                </div>
                                <div>
                                    <LinkPanel.Title className="text-lg">
                                        {meta.title || config.title}
                                    </LinkPanel.Title>
                                </div>
                            </div>
                        </LinkPanel>
                    );
                })}
            </div>

            <div className="mt-12">
                <Kontaktboks />
            </div>
        </div>
    );
};

export default DashboardOverview;
