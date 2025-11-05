const html = (strings: TemplateStringsArray, ...values: unknown[]) =>
  String.raw({ raw: strings }, ...values);

export const getStandardSnippet = (websiteId: string) =>
  html`<script
    defer
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="https://umami.nav.no"
    data-website-id="${websiteId}"
  ></script>`;

export const getNextJsSnippet = (websiteId: string) =>
  html`<script
    defer
    strategy="afterInteractive"
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="https://umami.nav.no"
    data-website-id="${websiteId}"
  />`;

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

export const getReactViteHeadSnippet = (websiteId: string) =>
  html`import { Head } from "@unhead/react";

<Head>
  <script
    defer
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="https://umami.nav.no"
    data-website-id="${websiteId}"
  />
</Head>`;

export const getAstroSnippet = (websiteId: string) =>
  html`<script
    is:inline
    defer
    data-astro-rerun
    src="https://cdn.nav.no/team-researchops/sporing/sporing.js"
    data-host-url="https://umami.nav.no"
    data-website-id="${websiteId}"
  ></script>`;

export const getGTMSnippet = (websiteId: string) =>
  html`<script>
    (function () {
      var el = document.createElement("script");
      el.setAttribute(
        "src",
        "https://cdn.nav.no/team-researchops/sporing/sporing.js",
      );
      el.setAttribute("data-host-url", "https://umami.nav.no");
      el.setAttribute("data-website-id", "${websiteId}");
      document.body.appendChild(el);
    })();
  </script>`;
