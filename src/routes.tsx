import { lazy } from 'react';
import type { ReactElement } from 'react';

const Home = lazy(() => import('./pages/Home.tsx'));
const Komigang = lazy(() => import('./pages/articles/Komigang.tsx'));
const Oppsett = lazy(() => import('./pages/topics/Oppsett.tsx'));
const Personvern = lazy(() => import("./pages/articles/Personvern.tsx"));
const Tilgjengelighet = lazy(() => import("./pages/articles/Tilgjengelighet.tsx"));


const Taksonomi = lazy(() => import("./pages/articles/Taksonomi.tsx"));
const Charts = lazy(() => import("./pages/analysis/Chartbuilder.tsx"));
const MetabaseGuide = lazy(() => import("./pages/articles/MetabaseGuide.tsx"));

const SqlEditor = lazy(() => import("./pages/analysis/SqlEditor.tsx"));
const Grafdeling = lazy(() => import("./pages/analysis/Grafdeling.tsx"));
const UserJourney = lazy(() => import("./pages/analysis/UserJourney.tsx"));
const Funnel = lazy(() => import("./pages/analysis/Funnel.tsx"));
const Retention = lazy(() => import("./pages/analysis/Retention.tsx"));
const UserComposition = lazy(() => import("./pages/analysis/UserComposition.tsx"));
const EventExplorer = lazy(() => import("./pages/analysis/EventExplorer.tsx"));
const TrafficAnalysis = lazy(() => import("./pages/analysis/TrafficAnalysis.tsx"));
const MarketingAnalysis = lazy(() => import("./pages/analysis/MarketingAnalysis.tsx"));

const UserProfiles = lazy(() => import("./pages/analysis/UserProfiles.tsx"));

const PrivacyCheck = lazy(() => import("./pages/analysis/PrivacyCheck.tsx"));
const Diagnosis = lazy(() => import("./pages/analysis/Diagnosis.tsx"));

const EventJourney = lazy(() => import("./pages/analysis/EventJourney.tsx"));
const UserProfile = lazy(() => import("./pages/analysis/UserProfile.tsx"));
const Dashboard = lazy(() => import("./pages/analysis/Dashboard.tsx"));
const DashboardOverview = lazy(() => import("./pages/topics/DashboardOverview.tsx"));
const BrokenLinks = lazy(() => import("./pages/analysis/BrokenLinks.tsx"));
const Spellings = lazy(() => import("./pages/analysis/Spellings.tsx"));

export type AppRoute = {
    path: string;
    component: ReactElement;
    fullWidth?: boolean;
};

export const fullWidthPathPrefixes = [
    "/trafikkanalyse",
    "/markedsanalyse",
    "/utforsk-hendelser",
    "/datastruktur",
    "/brukerprofiler",
    "/brukerlojalitet",
    "/brukersammensetning",
    "/brukerreiser",
    "/hendelsesreiser",
    "/trakt",
    "/personvernssjekk",
    "/diagnose",
    "/grafdeling",
    "/profil",
    "/kvalitet/odelagte-lenker",
    "/kvalitet/stavekontroll",
    "/sql"
];

export const routes: AppRoute[] = [
    { path: "/", component: <Home />, fullWidth: true },
    { path: "/komigang", component: <Komigang />, fullWidth: true },
    { path: "/oppsett", component: <Oppsett />, fullWidth: true },
    { path: "/personvern", component: <Personvern />, fullWidth: true },
    { path: "/tilgjengelighet", component: <Tilgjengelighet />, fullWidth: true },

    { path: "/taksonomi", component: <Taksonomi />, fullWidth: true },
    { path: "/grafbygger", component: <Charts />, fullWidth: true },
    { path: "/metabase", component: <MetabaseGuide />, fullWidth: true },

    { path: "/sql", component: <SqlEditor />, fullWidth: true },
    { path: "/grafdeling", component: <Grafdeling />, fullWidth: true },
    { path: "/brukerreiser", component: <UserJourney />, fullWidth: true },
    { path: "/hendelsesreiser", component: <EventJourney />, fullWidth: true },
    { path: "/trakt", component: <Funnel />, fullWidth: true },
    { path: "/brukerlojalitet", component: <Retention />, fullWidth: true },
    { path: "/brukersammensetning", component: <UserComposition />, fullWidth: true },
    { path: "/brukerprofiler", component: <UserProfiles />, fullWidth: true },
    { path: "/utforsk-hendelser", component: <EventExplorer />, fullWidth: true },
    { path: "/datastruktur", component: <EventExplorer />, fullWidth: true },
    { path: "/trafikkanalyse", component: <TrafficAnalysis />, fullWidth: true },
    { path: "/markedsanalyse", component: <MarketingAnalysis />, fullWidth: true },
    { path: "/personvernssjekk", component: <PrivacyCheck />, fullWidth: true },
    { path: "/diagnose", component: <Diagnosis />, fullWidth: true },
    { path: "/profil", component: <UserProfile />, fullWidth: true },
    { path: "/dashboards", component: <DashboardOverview />, fullWidth: true },
    { path: "/dashboard", component: <Dashboard />, fullWidth: true },
    { path: "/kvalitet/odelagte-lenker", component: <BrokenLinks />, fullWidth: true },
    { path: "/kvalitet/stavekontroll", component: <Spellings />, fullWidth: true }
];

export const isFullWidthPath = (pathname: string) =>
    fullWidthPathPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    routes.some((route) => route.fullWidth && route.path === pathname);

export default routes;