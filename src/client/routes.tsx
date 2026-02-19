import { lazy } from 'react';
import type { ReactElement } from 'react';

// Content Feature
const Home = lazy(() => import('./features/content').then(m => ({ default: m.Home })));
const Komigang = lazy(() => import('./features/content').then(m => ({ default: m.Komigang })));
const MetabaseGuide = lazy(() => import('./features/content').then(m => ({ default: m.MetabaseGuide })));
const Personvern = lazy(() => import('./features/content').then(m => ({ default: m.Personvern })));
const Tilgjengelighet = lazy(() => import('./features/content').then(m => ({ default: m.Tilgjengelighet })));
const Taksonomi = lazy(() => import('./features/content').then(m => ({ default: m.Taksonomi })));
const Oppsett = lazy(() => import('./features/content').then(m => ({ default: m.Oppsett })));
const Sporingskoder = lazy(() => import('./features/content').then(m => ({ default: m.Sporingskoder })));

// Dashboard Feature
const Dashboard = lazy(() => import('./features/dashboard').then(m => ({ default: m.Dashboard })));
const DashboardOverview = lazy(() => import('./features/dashboard').then(m => ({ default: m.DashboardOverview })));

// Chartbuilder Feature
const Grafbygger = lazy(() => import('./features/chartbuilder').then(m => ({ default: m.Grafbygger })));
const Grafdeling = lazy(() => import('./features/chartbuilder').then(m => ({ default: m.Grafdeling })));

// Backend Test Feature
const Oversikt = lazy(() => import('./features/oversikt/index.ts').then(m => ({ default: m.Oversikt })));
const ProjectManager = lazy(() => import('./features/projectmanager/index.ts').then(m => ({ default: m.ProjectManager })));

// Analysis Feature
const UserComposition = lazy(() => import('./features/analysis').then(m => ({ default: m.UserComposition })));
const Spellings = lazy(() => import('./features/analysis').then(m => ({ default: m.Spellings })));
const BrokenLinks = lazy(() => import('./features/analysis').then(m => ({ default: m.BrokenLinks })));
const PrivacyCheck = lazy(() => import('./features/analysis').then(m => ({ default: m.PrivacyCheck })));
const Diagnosis = lazy(() => import('./features/analysis').then(m => ({ default: m.Diagnosis })));

// User Feature
const UserJourney = lazy(() => import('./features/user').then(m => ({ default: m.UserJourney })));
const UserProfile = lazy(() => import('./features/user').then(m => ({ default: m.UserProfile })));
const UserProfiles = lazy(() => import('./features/user').then(m => ({ default: m.UserProfiles })));

// Events Feature
const EventExplorer = lazy(() => import('./features/eventexplorer').then(m => ({ default: m.EventExplorer })));

// Event Journey Feature
const EventJourney = lazy(() => import('./features/eventjourney').then(m => ({ default: m.EventJourney })));

// Traffic Feature
const TrafficAnalysis = lazy(() => import('./features/traffic').then(m => ({ default: m.TrafficAnalysis })));
const MarketingAnalysis = lazy(() => import('./features/traffic').then(m => ({ default: m.MarketingAnalysis })));

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
    { path: "/prosjekter", component: <ProjectManager />, fullWidth: true },
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
    { path: "/oversikt", component: <Oversikt />, fullWidth: true },
    { path: "/kvalitet/odelagte-lenker", component: <BrokenLinks />, fullWidth: true },
    { path: "/kvalitet/stavekontroll", component: <Spellings />, fullWidth: true }
];

export const isFullWidthPath = (pathname: string) =>
    fullWidthPathPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    routes.some((route) => route.fullWidth && route.path === pathname);

export default routes;
