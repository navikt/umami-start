import type { DashboardConfig } from './types';
import { getGcpProjectId } from '../../lib/runtimeConfig';

const projectId = getGcpProjectId();

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
    \`${projectId}.umami_views.event\`.*  FROM \`${projectId}.umami_views.event\`
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  DATE(base_query.created_at, 'Europe/Oslo') AS dato,
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
      showTotal: true,
      sql: `WITH base_query AS (
  SELECT
    \`${projectId}.umami_views.event\`.*  FROM \`${projectId}.umami_views.event\`
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
)

SELECT
  COUNT(DISTINCT base_query.session_id) as Unike_besokende,
  base_query.url_path
FROM base_query
GROUP BY
  base_query.url_path

UNION ALL

SELECT
  COUNT(DISTINCT base_query.session_id) as Unike_besokende,
  '__TOTAL__' as url_path
FROM base_query

ORDER BY 1 DESC
LIMIT 1001

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
    \`${projectId}.umami_views.event\`.*  FROM \`${projectId}.umami_views.event\`
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
    \`${projectId}.umami_views.event\`.*  FROM \`${projectId}.umami_views.event\`
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
    \`${projectId}.umami_views.event\`.*  FROM \`${projectId}.umami_views.event\`
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
  [[AND {{created_at}} ]]
  AND \`${projectId}.umami_views.event\`.event_type = 2
  AND \`${projectId}.umami_views.event\`.event_name IS NOT NULL
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
    \`${projectId}.umami_views.event\`.session_id,
    \`${projectId}.umami_views.event\`.visit_id,
    \`${projectId}.umami_views.event\`.url_path,
    \`${projectId}.umami_views.event\`.created_at,
    LEAD(\`${projectId}.umami_views.event\`.url_path) OVER (
      PARTITION BY \`${projectId}.umami_views.event\`.session_id 
      ORDER BY \`${projectId}.umami_views.event\`.created_at
    ) AS next_page
  FROM \`${projectId}.umami_views.event\`
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
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
    \`${projectId}.umami_views.event\`.*,
    \`${projectId}.umami_views.session\`.country  FROM \`${projectId}.umami_views.event\`
  LEFT JOIN \`${projectId}.umami_views.session\`
    ON \`${projectId}.umami_views.event\`.session_id = \`${projectId}.umami_views.session\`.session_id
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
    \`${projectId}.umami_views.event\`.*,
    \`${projectId}.umami_views.session\`.language  FROM \`${projectId}.umami_views.event\`
  LEFT JOIN \`${projectId}.umami_views.session\`
    ON \`${projectId}.umami_views.event\`.session_id = \`${projectId}.umami_views.session\`.session_id
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
    \`${projectId}.umami_views.event\`.*,
    \`${projectId}.umami_views.session\`.device  FROM \`${projectId}.umami_views.event\`
  LEFT JOIN \`${projectId}.umami_views.session\`
    ON \`${projectId}.umami_views.event\`.session_id = \`${projectId}.umami_views.session\`.session_id
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
    \`${projectId}.umami_views.event\`.*,
    \`${projectId}.umami_views.session\`.os  FROM \`${projectId}.umami_views.event\`
  LEFT JOIN \`${projectId}.umami_views.session\`
    ON \`${projectId}.umami_views.event\`.session_id = \`${projectId}.umami_views.session\`.session_id
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
    \`${projectId}.umami_views.event\`.*,
    \`${projectId}.umami_views.session\`.browser  FROM \`${projectId}.umami_views.event\`
  LEFT JOIN \`${projectId}.umami_views.session\`
    ON \`${projectId}.umami_views.event\`.session_id = \`${projectId}.umami_views.session\`.session_id
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
    \`${projectId}.umami_views.event\`.*,
    \`${projectId}.umami_views.session\`.screen  FROM \`${projectId}.umami_views.event\`
  LEFT JOIN \`${projectId}.umami_views.session\`
    ON \`${projectId}.umami_views.event\`.session_id = \`${projectId}.umami_views.session\`.session_id
  WHERE \`${projectId}.umami_views.event\`.website_id = '{{website_id}}'
  AND \`${projectId}.umami_views.event\`.event_type = 1
  AND \`${projectId}.umami_views.event\`.url_path = [[ {{url_sti}} --]] '/'
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
