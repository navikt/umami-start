import { lazy } from 'react';
import type { ReactElement } from 'react';

// Content Feature
const Home = lazy(() => import('./features/content/ui/Home.tsx'));
const Komigang = lazy(() => import('./features/content/ui/articles/Komigang.tsx'));
const MetabaseGuide = lazy(() => import('./features/content/ui/articles/MetabaseGuide.tsx'));
const Personvern = lazy(() => import('./features/content/ui/articles/Personvern.tsx'));
const Tilgjengelighet = lazy(() => import('./features/content/ui/articles/Tilgjengelighet.tsx'));
const Taksonomi = lazy(() => import('./features/content/ui/articles/Taksonomi.tsx'));
const Oppsett = lazy(() => import('./features/content/ui/topics/Oppsett.tsx'));
const Sporingskoder = lazy(() => import('./features/content/ui/topics/Sporingskoder.tsx'));

// Dashboard Feature
const Dashboard = lazy(() => import('./features/dashboard/ui/Dashboard.tsx'));
const DashboardOverview = lazy(() => import('./features/dashboard/ui/DashboardOverview.tsx'));

// Chartbuilder Feature
const Grafbygger = lazy(() => import('./features/chartbuilder').then(m => ({ default: m.Grafbygger })));
const Grafdeling = lazy(() => import('./features/chartbuilder').then(m => ({ default: m.Grafdeling })));

// Analysis Feature
const UserComposition = lazy(() => import('./features/analysis/ui/UserComposition.tsx'));
const Spellings = lazy(() => import('./features/analysis/ui/Spellings.tsx'));
const BrokenLinks = lazy(() => import('./features/analysis/ui/BrokenLinks.tsx'));
const PrivacyCheck = lazy(() => import('./features/analysis/ui/PrivacyCheck.tsx'));
const Diagnosis = lazy(() => import('./features/analysis/ui/Diagnosis.tsx'));

// User Feature
const UserJourney = lazy(() => import('./features/user/ui/UserJourney.tsx'));
const UserProfile = lazy(() => import('./features/user/ui/UserProfile.tsx'));
const UserProfiles = lazy(() => import('./features/user/ui/UserProfiles.tsx'));

// Events Feature
const EventExplorer = lazy(() => import('./features/events/ui/EventExplorer.tsx'));
const EventJourney = lazy(() => import('./features/events/ui/EventJourney.tsx'));

// Traffic Feature
const TrafficAnalysis = lazy(() => import('./features/traffic/ui/TrafficAnalysis.tsx'));
const MarketingAnalysis = lazy(() => import('./features/traffic/ui/MarketingAnalysis.tsx'));

// Funnel Feature
const Funnel = lazy(() => import('./features/funnel').then(m => ({ default: m.Funnel })));

// Retention Feature
const Retention = lazy(() => import('./features/retention').then(m => ({ default: m.Retention })));

// SQL Feature
const SqlEditor = lazy(() => import('./features/sql').then(m => ({ default: m.SqlEditor })));

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
    { path: "/sporingskoder", component: <Sporingskoder />, fullWidth: true },
    { path: "/personvern", component: <Personvern />, fullWidth: true },
    { path: "/tilgjengelighet", component: <Tilgjengelighet />, fullWidth: true },

    { path: "/taksonomi", component: <Taksonomi />, fullWidth: true },
    { path: "/grafbygger", component: <Grafbygger />, fullWidth: true },
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
