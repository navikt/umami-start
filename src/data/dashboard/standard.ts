import { DashboardConfig } from './types';

export const standardDashboard: DashboardConfig = {
  title: "Trafikkanalyse",
  description: "Et standarddashboard med vanlige trafikktall.",
  charts: [
    {
      title: "Besøk over tid",
      type: "line",
      width: '60',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  FORMAT_TIMESTAMP('%Y-%m-%d', base_query.created_at) AS dato,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
GROUP BY
  dato
ORDER BY dato ASC
LIMIT 1000`
    },
    {
      title: "Besøk gruppert på sider",
      type: "table",
      width: '40',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  COUNT(DISTINCT base_query.session_id) as Unike_besokende,
  base_query.url_path
FROM base_query
GROUP BY
  base_query.url_path
ORDER BY 1 DESC
LIMIT 1000

`
    },
    {
      title: "Trafikk til siden",
      type: "title",
      width: '100'
    },
    {
      title: "Eksterne nettsider besøkende kommer fra",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  COUNT(DISTINCT base_query.session_id) as Unike_besokende,
  base_query.referrer_domain
FROM base_query
GROUP BY
  base_query.referrer_domain
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    },
    {
      title: "Interne sider besøkende kommer fra",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  COUNT(DISTINCT base_query.session_id) as Unike_besokende,
  base_query.referrer_path
FROM base_query
GROUP BY
  base_query.referrer_path
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    }
  ]
};
