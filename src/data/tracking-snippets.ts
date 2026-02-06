const html = (strings: TemplateStringsArray, ...values: unknown[]) =>
  String.raw({ raw: strings }, ...values);

const getUmamiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).__UMAMI_BASE_URL__) {
    return (window as any).__UMAMI_BASE_URL__;
  }
  return 'https://umami.nav.no';
};

export const getStandardSnippet = (websiteId: string) => {
  const baseUrl = getUmamiBaseUrl();
  return html`<script
    defer
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="${baseUrl}"
    data-website-id="${websiteId}"
  ></script>`;
};

export const getNextJsSnippet = (websiteId: string) => {
  const baseUrl = getUmamiBaseUrl();
  return html`<script
    defer
    strategy="afterInteractive"
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="${baseUrl}"
    data-website-id="${websiteId}"
  />`;
};

export const getReactViteProviderSnippet = () =>
  html`import { createHead, UnheadProvider } from "@unhead/react";

const head = createHead();

function App() {
  return (
    <UnheadProvider head={head}>
      {/* Your app content */}
    </UnheadProvider>
  );
}`;

export const getReactViteHeadSnippet = (websiteId: string) => {
  const baseUrl = getUmamiBaseUrl();
  return html`import { Head } from "@unhead/react";

<Head>
  <script
    defer
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="${baseUrl}"
    data-website-id="${websiteId}"
  />
</Head>`;
};

export const getAstroSnippet = (websiteId: string) => {
  const baseUrl = getUmamiBaseUrl();
  return html`<script
    is:inline
    defer
    data-astro-rerun
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="${baseUrl}"
    data-website-id="${websiteId}"
  ></script>`;
};

export const getGTMSnippet = (websiteId: string) => {
  const baseUrl = getUmamiBaseUrl();
  return html`<script>
    (function () {
      var el = document.createElement("script");
      el.setAttribute(
        "src",
        "https://cdn.nav.no/team-researchops/sporing/sporing.js",
      );
      el.setAttribute("data-host-url", "${baseUrl}");
      el.setAttribute("data-website-id", "${websiteId}");
      document.body.appendChild(el);
    })();
  </script>`;
};
