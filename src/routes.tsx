// src/routes.tsx
import Home from './pages/Home.tsx';
import Komigang from './pages/Komigang.tsx';
import Oppsett from './pages/Oppsett.tsx';
import Personvern from "./pages/Personvern.tsx";
import Tilgjengelighet from "./pages/Tilgjengelighet.tsx";
import Combine from "./pages/Combine.tsx";
import Copilot from "./pages/Copilot.tsx";
import Validator from "./pages/Validator.tsx";
import Taksonomi from "./pages/Taksonomi.tsx";
import Charts from "./pages/Chartbuilder.tsx";
import Metabase from "./pages/Metabase.tsx";
import Sok from "./pages/Sok.tsx";
import BigQuery from "./pages/BigQuery.tsx";
import Grafdeling from "./pages/Grafdeling.tsx";
import UserJourney from "./pages/UserJourney.tsx";
import Funnel from "./pages/Funnel.tsx";
import Retention from "./pages/Retention.tsx";
import UserComposition from "./pages/UserComposition.tsx";
import EventExplorer from "./pages/EventExplorer.tsx";
import TrafficAnalysis from "./pages/TrafficAnalysis.tsx";

import PrivacyCheck from "./pages/PrivacyCheck.tsx";

const routes = [
    { path: "/", component: <Home /> },
    { path: "/komigang", component: <Komigang /> },
    { path: "/oppsett", component: <Oppsett /> },
    { path: "/personvern", component: <Personvern /> },
    { path: "/tilgjengelighet", component: <Tilgjengelighet /> },
    { path: "/modellbygger", component: <Combine /> },
    { path: "/copilot", component: <Copilot /> },
    { path: "/validator", component: <Validator /> },
    { path: "/taksonomi", component: <Taksonomi /> },
    { path: "/grafbygger", component: <Charts /> },
    { path: "/metabase", component: <Metabase /> },
    { path: "/sok", component: <Sok /> },
    { path: "/sql", component: <BigQuery /> },
    { path: "/grafdeling", component: <Grafdeling /> },
    { path: "/brukerreiser", component: <UserJourney /> },
    { path: "/trakt", component: <Funnel /> },
    { path: "/brukerlojalitet", component: <Retention /> },
    { path: "/brukersammensetning", component: <UserComposition /> },
    { path: "/utforsk-hendelser", component: <EventExplorer /> },
    { path: "/datastruktur", component: <EventExplorer /> },
    { path: "/trafikkanalyse", component: <TrafficAnalysis /> },
    { path: "/personvernssjekk", component: <PrivacyCheck /> }
];

export default routes;