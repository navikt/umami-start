import { Page, Theme } from "@navikt/ds-react";
import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import routes from "./routes";
import Footer from "./components/theme/Footer/Footer.tsx";
import ScrollToTop from "./components/theme/ScrollToTop/ScrollToTop.tsx";
import Header from "./components/theme/Header/Header.tsx";
import { useHead } from "@unhead/react";

import "./App.css";

// Create a wrapper component for ScrollToTop
const ScrollToTopWrapper = () => {
  const location = useLocation();

  // Don't show on /grafbygger route
  if (location.pathname === "/grafbygger") {
    return null;
  }

  return <ScrollToTop />;
};

// Create a wrapper component for Page Layout
const PageLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isFullWidthPage =
    location.pathname === "/" ||
    location.pathname === "/dashboards" ||
    location.pathname === "/oppsett" ||
    location.pathname === "/komigang" ||
    location.pathname === "/grafbygger" ||
    location.pathname === "/personvern" ||
    location.pathname === "/tilgjengelighet" ||
    location.pathname === "/taksonomi" ||
    location.pathname === "/metabase" ||
    location.pathname.startsWith("/trafikkanalyse") ||
    location.pathname.startsWith("/markedsanalyse") ||
    location.pathname.startsWith("/utforsk-hendelser") ||
    location.pathname.startsWith("/brukerprofiler") ||
    location.pathname.startsWith("/brukerlojalitet") ||
    location.pathname.startsWith("/brukersammensetning") ||
    location.pathname.startsWith("/trakt") ||
    location.pathname.startsWith("/personvernssjekk") ||
    location.pathname.startsWith("/diagnose") ||
    location.pathname.startsWith("/sql");

  if (isFullWidthPage) {
    return <main style={{ width: "100%" }}>{children}</main>;
  }

  return (
    <Page.Block as="main" width="xl" gutters>
      {children}
    </Page.Block>
  );
};

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const storedTheme = localStorage.getItem("umami-theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return storedTheme || (prefersDark ? "dark" : "light");
  });

  useEffect(() => {
    // Listen for theme changes from ThemeButton
    const handleThemeChange = (event: CustomEvent<"light" | "dark">) => {
      setTheme(event.detail);
    };

    window.addEventListener("themeChange", handleThemeChange as EventListener);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange as EventListener);
    };
  }, []);

  useHead({
    script: [
      {
        defer: true,
        src: "https://cdn.nav.no/team-researchops/sporing/sporing.js",
        'data-host-url': "https://umami.nav.no",
        'data-domains': "startumami.ansatt.nav.no",
        'data-website-id': "8e935f84-fb1e-4d07-be28-410eb2ab8cb9"
      },
      {
        type: 'text/javascript',
        innerHTML: `
          window.SKYRA_CONFIG = {
            org: 'arbeids-og-velferdsetaten-nav'
          };
          var script = document.createElement('script');
          script.src = 'https://survey.skyra.no/skyra-survey.js';
          document.body.appendChild(script);
        `
      }
    ]
  });

  return (
    <Theme theme={theme}>
      <Page>
        <Header theme={theme} />
        <Router>
          <PageLayout>
            <Routes>
              {routes.map(({ path, component }) => (
                <Route key={path} path={path} element={component} />
              ))}
            </Routes>
            <ScrollToTopWrapper />
          </PageLayout>
        </Router>
      </Page>
      <Footer />
    </Theme>
  );
}

export default App;
