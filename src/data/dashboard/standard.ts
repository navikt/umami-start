import { DashboardConfig } from './types';

export const standardDashboard: DashboardConfig = {
  title: "Trafikkanalyse",
  description: "Et standarddashboard med vanlige trafikktall.",
  charts: [
    {
      id: "traffic",
      title: "Besøk over tid",
      type: "line",
      width: 'full',
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
      id: "section-traffic",
      title: "Trafikk",
      type: "title",
      width: 'full'
    },
    {
      id: "ekstern-trafikk",
      title: "Eksterne nettsider besøkende kommer fra",
      type: "table",
      width: 'half',
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
      id: "intern-trafikk",
      title: "Interne sider besøkende kommer fra",
      type: "table",
      width: 'half',
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
