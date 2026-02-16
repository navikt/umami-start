import { readFile } from 'fs/promises';

export function registerFrontend(app, { buildPath, UMAMI_BASE_URL, GCP_PROJECT_ID }) {
    // Serve index.html with injected runtime config
    app.use(/^(?!.*\/(api|internal|static)\/).*$/, async (req, res) => {
        const indexPath = `${buildPath}/index.html`;

        try {
            let html = await readFile(indexPath, 'utf8');

            // Inject runtime config
            const runtimeConfig = `
        <script>
          window.__RUNTIME_CONFIG__ = {
            UMAMI_BASE_URL: "${UMAMI_BASE_URL}",
            GCP_PROJECT_ID: "${GCP_PROJECT_ID}"
          };
          // Legacy globals for main UI code paths
          window.__UMAMI_BASE_URL__ = window.__UMAMI_BASE_URL__ || "${UMAMI_BASE_URL}";
          window.__GCP_PROJECT_ID__ = window.__GCP_PROJECT_ID__ || "${GCP_PROJECT_ID}";
          if (!window.__RUNTIME_CONFIG_LOGGED__) {
            window.__RUNTIME_CONFIG_LOGGED__ = true;
            console.log('[RuntimeConfig]', {
              UMAMI_BASE_URL: window.__UMAMI_BASE_URL__,
              GCP_PROJECT_ID: window.__GCP_PROJECT_ID__
            });
          }
        </script>
      `;

            html = html.replace('</head>', `${runtimeConfig}</head>`);

            res.send(html);
        } catch (err) {
            console.error('Failed to serve index.html:', err);
            res.status(500).send('Failed to load frontend');
        }
    });
}