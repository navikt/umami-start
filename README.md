Start Umami
================

For å måle brukeradferd effektivt, trenger du verktøy som gir innsikt uten å gå på bekostning av brukervennlighet, datasikkerhet eller personvern..

Derfor tilbyr Team ResearchOps Umami – en løsning som kombinerer ferdigbygde dashboards, med mulighet for dypere produktanalyser i verktøy som Metabase, Grafana og Jupyter Notebook.

---
# Utvikling
Opprett en `.env`-fil i prosjektets rotmappe med følgende innhold, og erstatt `<value>` med de faktiske verdiene for ditt miljø:
```
BACKEND_BASE_URL=<value>
SITEIMPROVE_BASE_URL=<value>
UMAMI_BASE_URL=<value>
GCP_PROJECT_ID=<value>

# Alternativt kan du bruke VITE_-prefiksene (støttes av både server og Vite):
VITE_BACKEND_BASE_URL=<value>
VITE_SITEIMPROVE_BASE_URL=<value>
VITE_UMAMI_BASE_URL=<value>
VITE_GCP_PROJECT_ID=<value>
```
Kjør så:
```
pnpm i
pnpm run dev
```

# Env
- `BACKEND_BASE_URL`: Base URL for the start umami backend, injected via NAIS (see `.nais/dev/nais-dev.yaml` and `.nais/prod/nais-prod.yaml`) to avoid hardcoded endpoints.
- `BACKEND_TOKEN`: Optional static token used by `/api/backend` proxy when no incoming auth token is present (useful for localhost development against a protected backend).
- `SITEIMPROVE_BASE_URL`: Base URL for the Siteimprove proxy, injected via NAIS (see `.nais/dev/nais-dev.yaml` and `.nais/prod/nais-prod.yaml`) to avoid hardcoded endpoints.
- `UMAMI_BASE_URL`: Base URL for the Umami tracking server, injected via NAIS (see `.nais/dev/nais-dev.yaml` and `.nais/prod/nais-prod.yaml`). This is used in tracking code snippets. **Required** - the application will fail to start if not set.
- `GCP_PROJECT_ID`: GCP Project ID for BigQuery queries, injected via NAIS (see `.nais/dev/nais-dev.yaml` and `.nais/prod/nais-prod.yaml`). Used in SQL Editor and other BigQuery integrations. **Required** - the application will fail to start if not set.


# Bruk a KI

Start Umami er utviklet med hjelp av KI.

# Henvendelser og veiledning

Spørsmål knyttet til koden eller arbeidet kan stilles
som issues her på Github. Henvendelser kan sendes via Slack i
kanalen [#researchops](https://nav-it.slack.com/archives/C02UGFS2J4B).
