// src/routes.tsx
import Home from './pages/Home.tsx';
import Sok from './pages/Sok.tsx';

const routes = [
    { path: "/", component: <Home /> },
    { path: "/sok", component: <Sok /> },
];

export default routes;