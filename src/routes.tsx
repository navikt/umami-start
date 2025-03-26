// src/routes.tsx
import Home from './pages/Home.tsx';
import Komigang from './pages/Komigang.tsx';
import Personvern from "./pages/Personvern.tsx";
import Tilgjengelighet from "./pages/Tilgjengelighet.tsx";
import Combine from "./pages/Combine.tsx";
import Explore from "./pages/Explore.tsx";
import Copilot from "./pages/Copilot.tsx";
import Validator from "./pages/Validator.tsx";
import Taksonomi from "./pages/Taksonomi.tsx";
import Charts from "./pages/Chartbuilder.tsx";

const routes = [
    { path: "/", component: <Home /> },
    { path: "/komigang", component: <Komigang /> },
    { path: "/personvern", component: <Personvern /> },
    { path: "/tilgjengelighet", component: <Tilgjengelighet /> },
    { path: "/modellbygger", component: <Combine /> },
    { path: "/datastruktur", component: <Explore /> },
    { path: "/copilot", component: <Copilot /> },
    { path: "/validator", component: <Validator /> },
    { path: "/taksonomi", component: <Taksonomi /> },
    { path: "/grafbygger", component: <Charts /> }
];

export default routes;