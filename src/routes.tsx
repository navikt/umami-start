// src/routes.tsx
import Home from './pages/Home.tsx';
import Komigang from './pages/Komigang.tsx';

const routes = [
    { path: "/", component: <Home /> },
    { path: "/komigang", component: <Komigang /> },
];

export default routes;