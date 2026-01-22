import { DashboardConfig } from './types';

export const standardDashboard: DashboardConfig = {
  title: "Webstatistikk",
  description: "Standarddashboard med trafikktall.",
  charts: [
    {
      title: "Siteimprove",
      type: "siteimprove",
      width: '100'
    },
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
  COUNT(*) as Totalt_antall,
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
    },
    {
      title: "Aktiviteter",
      type: "title",
      width: '100'
    },
    {
      title: "Besøk gruppert på hendelser",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 2
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_name IS NOT NULL
)

SELECT
  base_query.event_name,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
GROUP BY
  base_query.event_name
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    },
    {
      title: "Hvor besøkende går videre",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.session_id,
    \`team-researchops-prod-01d6.umami.public_website_event\`.url_path,
    \`team-researchops-prod-01d6.umami.public_website_event\`.created_at,
    LEAD(\`team-researchops-prod-01d6.umami.public_website_event\`.url_path) OVER (
      PARTITION BY \`team-researchops-prod-01d6.umami.public_website_event\`.session_id 
      ORDER BY \`team-researchops-prod-01d6.umami.public_website_event\`.created_at
    ) AS next_page
  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  [[AND {{created_at}} ]]
)

SELECT
  COALESCE(next_page, '(Forlot siden)') AS Neste_side,
  COUNT(DISTINCT session_id) as Unike_besokende
FROM base_query
WHERE url_path = [[ {{url_sti}} --]] '/'
GROUP BY
  next_page
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    },
    {
      title: "Geografi og språk",
      type: "title",
      width: '100'
    },
    {
      title: "Besøk gruppert på land",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*,
    \`team-researchops-prod-01d6.umami.public_session\`.country  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  LEFT JOIN \`team-researchops-prod-01d6.umami.public_session\`
    ON \`team-researchops-prod-01d6.umami.public_website_event\`.session_id = \`team-researchops-prod-01d6.umami.public_session\`.session_id
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  base_query.country,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
GROUP BY
  base_query.country
ORDER BY Unike_besokende DESC
LIMIT 1000

`
    },
    {
      title: "Besøk gruppert på språk",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*,
    \`team-researchops-prod-01d6.umami.public_session\`.language  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  LEFT JOIN \`team-researchops-prod-01d6.umami.public_session\`
    ON \`team-researchops-prod-01d6.umami.public_website_event\`.session_id = \`team-researchops-prod-01d6.umami.public_session\`.session_id
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  base_query.language,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
GROUP BY
  base_query.language
ORDER BY Unike_besokende DESC
LIMIT 1000

`
    },
    {
      title: "Enhet",
      type: "title",
      width: '100'
    },
    {
      title: "Besøk gruppert på enhet",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*,
    \`team-researchops-prod-01d6.umami.public_session\`.device  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  LEFT JOIN \`team-researchops-prod-01d6.umami.public_session\`
    ON \`team-researchops-prod-01d6.umami.public_website_event\`.session_id = \`team-researchops-prod-01d6.umami.public_session\`.session_id
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  base_query.device,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
WHERE base_query.device NOT LIKE '%x%'
GROUP BY
  base_query.device
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    },
    {
      title: "Besøk gruppert på OS",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*,
    \`team-researchops-prod-01d6.umami.public_session\`.os  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  LEFT JOIN \`team-researchops-prod-01d6.umami.public_session\`
    ON \`team-researchops-prod-01d6.umami.public_website_event\`.session_id = \`team-researchops-prod-01d6.umami.public_session\`.session_id
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  base_query.os,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
GROUP BY
  base_query.os
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    },
    {
      title: "Besøk gruppert på nettleser",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*,
    \`team-researchops-prod-01d6.umami.public_session\`.browser  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  LEFT JOIN \`team-researchops-prod-01d6.umami.public_session\`
    ON \`team-researchops-prod-01d6.umami.public_website_event\`.session_id = \`team-researchops-prod-01d6.umami.public_session\`.session_id
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  base_query.browser,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
GROUP BY
  base_query.browser
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    },
    {
      title: "Besøk gruppert på skjermstørrelse",
      type: "table",
      width: '50',
      sql: `WITH base_query AS (
  SELECT
    \`team-researchops-prod-01d6.umami.public_website_event\`.*,
    \`team-researchops-prod-01d6.umami.public_session\`.screen  FROM \`team-researchops-prod-01d6.umami.public_website_event\`
  LEFT JOIN \`team-researchops-prod-01d6.umami.public_session\`
    ON \`team-researchops-prod-01d6.umami.public_website_event\`.session_id = \`team-researchops-prod-01d6.umami.public_session\`.session_id
  WHERE \`team-researchops-prod-01d6.umami.public_website_event\`.website_id = '{{website_id}}'
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.event_type = 1
  AND \`team-researchops-prod-01d6.umami.public_website_event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  base_query.screen,
  COUNT(DISTINCT base_query.session_id) as Unike_besokende
FROM base_query
GROUP BY
  base_query.screen
ORDER BY Unike_besokende DESC
LIMIT 1000
`
    }
  ]
};
