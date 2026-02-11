Start Umami
================

For å måle brukeradferd effektivt, trenger du verktøy som gir innsikt uten å gå på bekostning av brukervennlighet, datasikkerhet eller personvern..

Derfor tilbyr Team ResearchOps Umami – en løsning som kombinerer ferdigbygde dashboards, med mulighet for dypere produktanalyser i verktøy som Metabase, Grafana og Jupyter Notebook.

---
# Utvikling
```
pnpm i
pnpm run dev
```

# Env
- `SITEIMPROVE_BASE_URL`: Base URL for the Siteimprove proxy, injected via NAIS (see `.nais/dev/nais-dev.yaml` and `.nais/prod/nais-prod.yaml`) to avoid hardcoded endpoints.
- `UMAMI_BASE_URL`: Base URL for the Umami tracking server, injected via NAIS (see `.nais/dev/nais-dev.yaml` and `.nais/prod/nais-prod.yaml`). This is used in tracking code snippets. **Required** - the application will fail to start if not set.
- `GCP_PROJECT_ID`: GCP Project ID for BigQuery queries, injected via NAIS (see `.nais/dev/nais-dev.yaml` and `.nais/prod/nais-prod.yaml`). Used in SQL Editor and other BigQuery integrations. **Required** - the application will fail to start if not set.


# Bruk a KI

Start Umami er utviklet med hjelp av KI.

# Henvendelser og veiledning

Spørsmål knyttet til koden eller arbeidet kan stilles
som issues her på Github. Henvendelser kan sendes via Slack i
kanalen [#researchops](https://nav-it.slack.com/archives/C02UGFS2J4B).
