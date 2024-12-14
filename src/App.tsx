import {Page, InternalHeader} from "@navikt/ds-react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import routes from './routes';
import Footer from "./components/theme/Footer/Footer.tsx";

function App() {
  return (
    <>
        <Page>
            <InternalHeader>
                <InternalHeader.Title as="h1">Start Umami</InternalHeader.Title>
            </InternalHeader>
            <Page.Block as="main" width="xl" gutters style={{ marginBottom: "100px" }}>
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
    </>
  )
}

export default App
