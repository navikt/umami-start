import {Page} from "@navikt/ds-react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import routes from './routes';
import Footer from "./components/theme/Footer/Footer.tsx";
import ScrollToTop from "./components/theme/ScrollToTop/ScrollToTop.tsx";
import Header from "./components/theme/Header/Header.tsx";

function App() {
  return (
    <>
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
