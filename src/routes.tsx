// src/routes.tsx
import Home from './pages/Home.tsx';
import Komigang from './pages/Komigang.tsx';
import Personvern from "./pages/Personvern.tsx";
import Tilgjengelighet from "./pages/Tilgjengelighet.tsx";
import Combine from "./pages/Combine.tsx";

const routes = [
    { path: "/", component: <Home /> },
    { path: "/komigang", component: <Komigang /> },
    { path: "/personvern", component: <Personvern /> },
    { path: "/tilgjengelighet", component: <Tilgjengelighet /> },
    { path: "/combine", component: <Combine /> }
];

export default routes;