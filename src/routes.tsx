// src/routes.tsx
import Home from './pages/Home.tsx';
import Komigang from './pages/articles/Komigang.tsx';
import Oppsett from './pages/articles/Oppsett.tsx';
import Personvern from "./pages/legal/Personvern.tsx";
import Tilgjengelighet from "./pages/legal/Tilgjengelighet.tsx";


import Taksonomi from "./pages/articles/Taksonomi.tsx";
import Charts from "./pages/analysis/Chartbuilder.tsx";
import Metabase from "./pages/articles/Metabase.tsx";

import BigQuery from "./pages/analysis/BigQuery.tsx";
import Grafdeling from "./pages/analysis/Grafdeling.tsx";
import UserJourney from "./pages/analysis/UserJourney.tsx";
import Funnel from "./pages/analysis/Funnel.tsx";
import Retention from "./pages/analysis/Retention.tsx";
import UserComposition from "./pages/analysis/UserComposition.tsx";
import EventExplorer from "./pages/analysis/EventExplorer.tsx";
import TrafficAnalysis from "./pages/analysis/TrafficAnalysis.tsx";
import MarketingAnalysis from "./pages/analysis/MarketingAnalysis.tsx";

import UserProfiles from "./pages/analysis/UserProfiles.tsx";

import PrivacyCheck from "./pages/analysis/PrivacyCheck.tsx";
import Diagnosis from "./pages/analysis/Diagnosis.tsx";

import EventJourney from "./pages/analysis/EventJourney.tsx";
import UserProfile from "./pages/analysis/UserProfile.tsx";
import Dashboard from "./pages/dashboard/Dashboard.tsx";
import DashboardOverview from "./pages/dashboard/DashboardOverview.tsx";


const routes = [
    { path: "/", component: <Home /> },
    { path: "/komigang", component: <Komigang /> },
    { path: "/oppsett", component: <Oppsett /> },
    { path: "/personvern", component: <Personvern /> },
    { path: "/tilgjengelighet", component: <Tilgjengelighet /> },


    { path: "/taksonomi", component: <Taksonomi /> },
    { path: "/grafbygger", component: <Charts /> },
    { path: "/metabase", component: <Metabase /> },

    { path: "/sql", component: <BigQuery /> },
    { path: "/grafdeling", component: <Grafdeling /> },
    { path: "/brukerreiser", component: <UserJourney /> },
    { path: "/hendelsesreiser", component: <EventJourney /> },
    { path: "/trakt", component: <Funnel /> },
    { path: "/brukerlojalitet", component: <Retention /> },
    { path: "/brukersammensetning", component: <UserComposition /> },
    { path: "/brukerprofiler", component: <UserProfiles /> },
    { path: "/utforsk-hendelser", component: <EventExplorer /> },
    { path: "/datastruktur", component: <EventExplorer /> },
    { path: "/trafikkanalyse", component: <TrafficAnalysis /> },
    { path: "/markedsanalyse", component: <MarketingAnalysis /> },
    { path: "/personvernssjekk", component: <PrivacyCheck /> },
    { path: "/diagnose", component: <Diagnosis /> },
    { path: "/profil", component: <UserProfile /> },
    { path: "/dashboards", component: <DashboardOverview /> },
    { path: "/dashboard", component: <Dashboard /> }
];

export default routes;