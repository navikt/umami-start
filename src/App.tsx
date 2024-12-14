import {Page} from "@navikt/ds-react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import routes from './routes';
import Footer from "./components/theme/Footer/Footer.tsx";
import ScrollToTop from "./components/theme/ScrollToTop/ScrollToTop.tsx";
import Header from "./components/theme/Header/Header.tsx";
import { Helmet } from "react-helmet";

function App() {
  return (
    <>
        <Helmet>
            <script defer src="https://cdn.nav.no/team-researchops/sporing/sporing.js" data-host-url="https://umami.nav.no" data-domains="startumami.ansatt.nav.no" data-website-id="8e935f84-fb1e-4d07-be28-410eb2ab8cb9"></script>
        </Helmet>
        <Page>
            <Header />
            <Page.Block as="main" width="xl" gutters>
                <Router>
                    <Routes>
                        {routes.map(({ path, component }) => (
                            <Route key={path} path={path} element={component} />
                        ))}
                    </Routes>
                </Router>
            </Page.Block>
        </Page>
        <Footer />
        <ScrollToTop />
    </>
  )
}

export default App
