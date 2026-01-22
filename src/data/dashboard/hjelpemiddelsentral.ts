import { DashboardConfig } from './types';
import hjelpemiddelsentralData from '../hjelpemiddelsentraler.json';

export const hjelpemiddelsentralDashboard: DashboardConfig = {
  title: "Hjelpemiddelsentralene",
  description: "Webstatistikk for hjelpemiddelsentralsidene på nav.no",

  // Hide the website picker and URL-sti filter (they work behind the scenes)
  hiddenFilters: {
    website: true,
    urlPath: true
  },

  // Default to nav.no website and starts-with operator
  defaultFilterValues: {
    websiteId: '35abb2b7-3f97-42ce-931b-cf547d40d967', // nav.no
    pathOperator: 'starts-with'
  },

  // Message to show when required filter is not selected
  customFilterRequiredMessage: "Velg en sentral for å vise webstatistikk.",

  // Only show these metric types in the Visning filter (hide 'proportion'/andel)
  metricTypeOptions: ['visitors', 'pageviews'],

  // Custom Nav hjelpemiddelsentral filter
  customFilters: [
    {
      id: 'hjelpemiddelsentral',
      label: 'Hjelpemiddelsentral',
      type: 'select',
      appliesTo: 'urlPath',
      pathOperator: 'starts-with',
      required: true,
      urlParam: 'sentral',
      options: hjelpemiddelsentralData.map(sentral => ({
        label: sentral.region,
        value: sentral.path,
        // Use region name as slug for cleaner URLs (e.g., "oslo" instead of "nav-hjelpemiddelsentral-oslo")
        slug: sentral.region.toLowerCase().replace(/\s+/g, '-').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a'),
        // Siteimprove group ID for group-level scoring
        siteimprove_groupid: sentral.siteimprove_groupid
      }))
    }
  ],

  charts: [
    {
      title: "Siteimprove",
      type: "siteimprove",
      width: '100',
      siteimprove_id: '21766831756',
      siteimprove_portal_id: '1002489'
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
