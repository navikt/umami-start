import express from 'express';
import { addAuditLogging, substituteQueryParameters } from '../../bigquery/audit.js';

export function createDashboardRouter({ bigquery, GCP_PROJECT_ID }) {
  const router = express.Router();

  // Get websites from BigQuery
  router.get('/api/bigquery/websites', async (req, res) => {
      try {
          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({
                  error: 'BigQuery client not initialized'
              })
          }

          const query = `
              SELECT
                  website_id as id,
                  ANY_VALUE(name) as name,
                  ANY_VALUE(domain) as domain,
                  ANY_VALUE(share_id) as shareId,
                  ANY_VALUE(team_id) as teamId,
                  ANY_VALUE(created_at) as createdAt
              FROM \`${GCP_PROJECT_ID}.umami.public_website\`
              WHERE deleted_at IS NULL
                AND name IS NOT NULL
              GROUP BY website_id
              ORDER BY name
          `;



          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1'
          }, navIdent, 'Nettsidevelger'));

          const [rows] = await job.getQueryResults();

          // Map rows to handle BigQuery timestamp objects
          const data = rows.map(row => {
              let createdAt = row.createdAt;
              if (createdAt && typeof createdAt === 'object' && createdAt.value) {
                  createdAt = createdAt.value;
              }
              return {
                  ...row,
                  createdAt
              };
          });

          res.json({
              data: data
          });
      } catch (error) {
          console.error('BigQuery websites error:', error);
          res.status(500).json({
              error: error.message || 'Failed to fetch websites'
          });
      }
  });

  // Get user journeys from BigQuery
  router.post('/api/bigquery/journeys', async (req, res) => {
      try {
          const { websiteId, startUrl, startDate, endDate, steps = 3, limit = 30, direction = 'forward' } = req.body;

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';


          if (!bigquery) {
              return res.status(500).json({
                  error: 'BigQuery client not initialized'
              })
          }

          // Choose LAG (backward) or LEAD (forward) based on direction
          const windowFunction = direction === 'backward' ? 'LAG' : 'LEAD';
          const nextUrlColumn = direction === 'backward' ? 'prev_url' : 'next_url';
          const timeOperator = direction === 'backward' ? '<=' : '>=';

          const query = `
              WITH session_events AS (
                  SELECT
                      session_id,
                      CASE 
                          WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                          THEN '/'
                          ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
                      END as url_path,
                      created_at,
                      MIN(CASE 
                          WHEN (CASE 
                              WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                              THEN '/'
                              ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
                          END) = @startUrl 
                          THEN created_at 
                      END) 
                          OVER (PARTITION BY session_id) AS start_time
                  FROM \`${GCP_PROJECT_ID}.umami.public_website_event\`
                  WHERE website_id = @websiteId
                      AND created_at BETWEEN @startDate AND @endDate
                      AND event_type = 1 -- Pageview
              ),
              journey_steps AS (
                  SELECT
                      session_id,
                      url_path,
                      created_at,
                      ${windowFunction}(url_path) OVER (PARTITION BY session_id ORDER BY created_at) AS ${nextUrlColumn}
                  FROM session_events
                  WHERE start_time IS NOT NULL
                      AND created_at ${timeOperator} start_time
              ),
              renumbered_steps AS (
                  SELECT
                      j.session_id,
                      j.url_path,
                      j.${nextUrlColumn},
                      ROW_NUMBER() OVER (PARTITION BY j.session_id ORDER BY j.created_at ${direction === 'backward' ? 'DESC' : 'ASC'}) - 1 AS step
                  FROM journey_steps j
              ),
              raw_flows AS (
                  SELECT
                      step,
                      url_path AS source,
                      ${nextUrlColumn} AS target,
                      COUNT(*) AS value
                  FROM renumbered_steps
                  WHERE step < @steps
                      AND ${nextUrlColumn} IS NOT NULL
                      -- Filter out self-loops (same page to same page)
                      AND url_path != ${nextUrlColumn}
                      -- Ensure step 0 ONLY has the start URL as source
                      AND (step > 0 OR url_path = @startUrl)
                      -- Prevent start URL from appearing as source at steps > 0
                      AND NOT (step > 0 AND url_path = @startUrl)
                      -- Prevent start URL from appearing as target at steps > 0 (no back-navigation to start)
                      AND NOT (step > 0 AND ${nextUrlColumn} = @startUrl)
                  GROUP BY 1, 2, 3
              ),
              ranked AS (
                  SELECT
                      *,
                      ROW_NUMBER() OVER (PARTITION BY step ORDER BY value DESC) AS rank_in_step
                  FROM raw_flows
              ),
              top_flows AS (
                  SELECT
                      step,
                      source,
                      target,
                      value
                  FROM ranked
                  WHERE rank_in_step <= @limit
              ),
              -- Collect all valid pages at each step (step 0 targets, step 1 targets, etc.)
              valid_pages_per_step AS (
                  SELECT 0 as step, @startUrl as page
                  UNION ALL
                  SELECT step + 1 as step, target as page
                  FROM top_flows
              )
              SELECT
                  t.step,
                  t.source,
                  t.target,
                  t.value
              FROM top_flows t
              INNER JOIN valid_pages_per_step v
                  ON v.step = t.step
                  AND v.page = t.source
              ORDER BY step, value DESC
          `;



          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              params: {
                  websiteId,
                  startUrl,
                  startDate,
                  endDate,
                  steps,
                  limit
              }
          }, navIdent, 'Sideflyt'));

          // Get cost estimate
          try {
              // Get NAV ident from authenticated user for audit logging

              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: {
                      websiteId,
                      startUrl,
                      startDate,
                      endDate,
                      steps,
                      limit
                  },
                  dryRun: true
              }, navIdent, 'Sideflyt'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              console.log(`[User Journeys] Dry run - Processing ${gbProcessed} GB, estimated cost: $${estimatedCostUSD}`);
          } catch (dryRunError) {
              console.log('[User Journeys] Dry run failed:', dryRunError.message);
          }

          const [rows] = await job.getQueryResults();

          // Transform to Sankey format
          const nodes = [];
          const links = [];
          const nodeMap = new Map();

          // Helper to get or create node index
          const getNodeIndex = (name, step) => {
              const id = `${step}:${name}`;
              if (!nodeMap.has(id)) {
                  nodeMap.set(id, nodes.length);
                  nodes.push({
                      nodeId: id,
                      name: name,
                      color: '#0056b3' // Default color
                  });
              }
              return nodeMap.get(id);
          };

          rows.forEach(row => {
              const sourceIndex = getNodeIndex(row.source, row.step);
              const targetIndex = getNodeIndex(row.target, row.step + 1);

              links.push({
                  source: sourceIndex,
                  target: targetIndex,
                  value: parseInt(row.value)
              });
          });

          // Get dry run stats for response
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging
              const navIdent = req.user?.navIdent || 'UNKNOWN';

              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: {
                      websiteId,
                      startUrl,
                      startDate,
                      endDate,
                      steps,
                      limit
                  },
                  dryRun: true
              }, navIdent, 'Sideflyt'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessed: bytesProcessed,
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };
          } catch (dryRunError) {
              console.log('[User Journeys] Dry run failed:', dryRunError.message);
          }

          res.json({
              nodes,
              links,
              queryStats
          });

      } catch (error) {
          console.error('BigQuery journeys error:', error);
          res.status(500).json({
              error: error.message || 'Failed to fetch user journeys'
          });
      }
  });

  // Get funnel data from BigQuery
  router.post('/api/bigquery/funnel', async (req, res) => {
      try {
          const { websiteId, urls, steps: inputSteps, startDate, endDate, onlyDirectEntry = true } = req.body;

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({
                  error: 'BigQuery client not initialized'
              })
          }

          // Backward compatibility: Convert legacy `urls` to `steps` if `steps` is missing
          let steps = inputSteps;
          if (!steps && urls) {
              steps = urls.map(url => ({ type: 'url', value: url }));
          }

          if (!steps || !Array.isArray(steps) || steps.length < 2) {
              return res.status(400).json({
                  error: 'At least 2 steps are required for a funnel'
              });
          }

          // Determine which event types we need to query
          // 1 = Pageview (for type: 'url')
          // 2 = Custom Event (for type: 'event')
          const neededEventTypes = new Set();
          steps.forEach(step => {
              if (step.type === 'url') neededEventTypes.add(1);
              if (step.type === 'event') neededEventTypes.add(2);
          });
          const eventTypesList = Array.from(neededEventTypes).join(', ');

          // Helper to generate the URL normalization SQL
          const normalizeUrlSql = `
              CASE 
                  WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                  THEN '/'
                  ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
              END
          `;

          // 1. Base events CTE with step_value calculation
          // We calculate a unified 'step_value' to compare against:
          // - For Pageviews (type 1): The normalized URL path
          // - For Custom Events (type 2): The event name
          // We also keep the url_path for events with eventScope='current-path'
          let query = `
              WITH events_raw AS (
                  SELECT
                      session_id,
                      event_id,
                      website_id,
                      event_type,
                      CASE
                          WHEN event_type = 1 THEN ${normalizeUrlSql}
                          WHEN event_type = 2 THEN event_name
                          ELSE NULL
                      END as step_value,
                      ${normalizeUrlSql} as url_path_normalized,
                      created_at
                  FROM \`${GCP_PROJECT_ID}.umami.public_website_event\`
                  WHERE website_id = @websiteId
                    AND created_at BETWEEN @startDate AND @endDate
                    AND event_type IN (${eventTypesList})
              ),
              events AS (
                  SELECT
                      *,
                      LAG(step_value) OVER (PARTITION BY session_id ORDER BY created_at) as prev_step_value,
                      LAG(url_path_normalized) OVER (PARTITION BY session_id ORDER BY created_at) as prev_url_path
                  FROM events_raw
              ),
          `;

          // 2. Generate CTEs for each step
          const stepCtes = steps.map((step, index) => {
              const stepName = `step${index + 1}`;
              const prevStepName = `step${index}`;
              const paramName = `stepValue${index}`;

              // Check if we need to enforce type match as well (e.g. if a URL and Event have same name?)
              // For now, assuming step_value uniqueness is enough or tolerable.
              // But strictness:
              // If checking for URL, we should ensure event_type=1
              // If checking for Event, we should ensure event_type=2
              const typeCheck = step.type === 'url' ? 'AND event_type = 1' : 'AND event_type = 2';

              // For events with eventScope='current-path', we need to ensure they happen on the same URL as the previous step
              const eventScopeCheck = (step.type === 'event' && step.eventScope === 'current-path' && index > 0)
                  ? `AND e.url_path_normalized = prev.url_path${index}`
                  : '';

              // Check for event parameters (filters)
              // Expect step.params to be an array of { key, value, operator }
              let paramFilters = '';
              if (step.type === 'event' && step.params && Array.isArray(step.params) && step.params.length > 0) {
                  const conditions = step.params.map((p, pIdx) => {
                      const pKeyName = `step${index}_pKey${pIdx}`;
                      const pValName = `step${index}_pVal${pIdx}`;

                      // We'll handle the parameter injection later when building the params object,
                      // but we need to remember to do it.

                      const operator = p.operator === 'contains' ? 'LIKE' : '=';

                      return `EXISTS (
                          SELECT 1
                          FROM \`${GCP_PROJECT_ID}.umami_views.event_data\` d_${index}_${pIdx}
                          CROSS JOIN UNNEST(d_${index}_${pIdx}.event_parameters) p_${index}_${pIdx}
                          WHERE d_${index}_${pIdx}.website_event_id = e.event_id
                            AND d_${index}_${pIdx}.website_id = e.website_id
                            AND d_${index}_${pIdx}.created_at = e.created_at
                            AND p_${index}_${pIdx}.data_key = @${pKeyName}
                            AND p_${index}_${pIdx}.string_value ${operator} @${pValName}
                      )`;
                  });

                  if (conditions.length > 0) {
                      paramFilters = 'AND ' + conditions.join(' AND ');
                  }
              }

              if (index === 0) {
                  // Step 1: Always any visit/event matching the first step
                  // We also store the URL path for potential use in subsequent steps

                  // Check for whiteboard
                  const isWildcard = step.value.includes('*');
                  const operator = isWildcard ? 'LIKE' : '=';

                  return `
              ${stepName} AS (
                  SELECT session_id, MIN(created_at) as time${index + 1},
                         MIN(url_path_normalized) as url_path${index + 1},
                         e.event_id as event_id${index + 1} -- Keep distinct
                  FROM events e
                  WHERE step_value ${operator} @${paramName}
                    ${typeCheck}
                    ${paramFilters}
                  GROUP BY session_id, e.event_id
              )`;
              } else {
                  const prevParamName = `stepValue${index - 1}`;

                  // Check for wildcard in current step
                  const isWildcard = step.value.includes('*');
                  const operator = isWildcard ? 'LIKE' : '=';

                  // Check for wildcard in PREVIOUS step (for strict mode check)
                  const isPrevWildcard = steps[index - 1].value.includes('*');
                  const prevOperator = isPrevWildcard ? 'LIKE' : '=';

                  if (onlyDirectEntry) {
                      // Strict mode: Current step must be immediately after Previous step
                      return `
              ${stepName} AS (
                  SELECT e.session_id, MIN(e.created_at) as time${index + 1},
                         MIN(e.url_path_normalized) as url_path${index + 1},
                         e.event_id as event_id${index + 1}
                  FROM events e
                  JOIN ${prevStepName} prev ON e.session_id = prev.session_id
                  WHERE e.step_value ${operator} @${paramName}
                    ${typeCheck}
                    AND e.created_at > prev.time${index}
                    AND e.prev_step_value ${prevOperator} @${prevParamName}
                    ${eventScopeCheck}
                    ${paramFilters}
                  GROUP BY e.session_id, e.event_id
              )`;
                  } else {
                      // Loose mode: Eventual follow-up
                      return `
              ${stepName} AS (
                  SELECT e.session_id, MIN(e.created_at) as time${index + 1},
                         MIN(e.url_path_normalized) as url_path${index + 1},
                         e.event_id as event_id${index + 1}
                  FROM events e
                  JOIN ${prevStepName} prev ON e.session_id = prev.session_id
                  WHERE e.step_value ${operator} @${paramName}
                    ${typeCheck}
                    AND e.created_at > prev.time${index}
                    ${eventScopeCheck}
                    ${paramFilters}
                  GROUP BY e.session_id, e.event_id
              )`;
                  }
              }

          });

          query += stepCtes.join(',') + `
              SELECT ${steps.map((_, i) => `
                  ${i} as step, 
                  @stepValue${i} as url, 
                  (SELECT COUNT(DISTINCT session_id) FROM step${i + 1}) as count`).join('\n            UNION ALL SELECT ')}
              ORDER BY step
          `;

          // Create params object
          const params = {
              websiteId,
              startDate,
              endDate
          };

          steps.forEach((step, index) => {
              if (step.value.includes('*')) {
                  params[`stepValue${index}`] = step.value.replace(/\*/g, '%');
              } else {
                  params[`stepValue${index}`] = step.value;
              }

              // Add params for filters
              if (step.type === 'event' && step.params && Array.isArray(step.params)) {
                  step.params.forEach((p, pIdx) => {
                      params[`step${index}_pKey${pIdx}`] = p.key;

                      if (p.operator === 'contains') {
                          params[`step${index}_pVal${pIdx}`] = `%${p.value}%`;
                      } else {
                          params[`step${index}_pVal${pIdx}`] = p.value;
                      }
                  });
              }
          });

          // Get dry run stats
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging


              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: params,
                  dryRun: true
              }, navIdent, 'Traktanalyse'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };

              console.log(`[Funnel] Dry run - Processing ${gbProcessed} GB, estimated cost: $${estimatedCostUSD} (Types: ${eventTypesList})`);
          } catch (dryRunError) {
              console.log('[Funnel] Dry run failed:', dryRunError.message);
          }

          // Get NAV ident from authenticated user for audit logging

          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Traktanalyse'));

          const [rows] = await job.getQueryResults();

          if (rows.length === 0) {
              return res.json({ data: [] });
          }

          const data = rows.map((row, index) => ({
              step: index,
              url: steps[index].value,
              type: steps[index].type,
              params: steps[index].params,
              count: parseInt(row.count || 0)
          }));

          res.json({ data, queryStats, sql: substituteQueryParameters(query, params) });
      } catch (error) {
          console.error('BigQuery funnel error:', error);
          res.status(500).json({
              error: error.message || 'Failed to fetch funnel data'
          });
      }
  });

  router.post('/api/bigquery/funnel-timing', async (req, res) => {
      try {
          const { websiteId, steps, startDate, endDate, onlyDirectEntry = true } = req.body;
          let { urls } = req.body;

          // Support 'steps' input format (array of objects) by extracting values
          if (!urls && steps && Array.isArray(steps)) {
              urls = steps.map(s => s.value);
          }

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({
                  error: 'BigQuery client not initialized'
              })
          }

          if (!urls || !Array.isArray(urls) || urls.length < 2) {
              return res.status(400).json({
                  error: 'At least 2 URLs are required for a funnel'
              });
          }

          // Helper to generate the URL normalization SQL
          const normalizeUrlSql = `
          CASE 
                  WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                  THEN '/'
                  ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
          END
              `;

          // Optimized Query using ARRAY_AGG and UDF to avoid self-joins
          const query = `
              CREATE TEMP FUNCTION match_funnel(
                  hits ARRAY<STRUCT<url STRING, ts TIMESTAMP>>, 
                  steps ARRAY<STRING>, 
                  strict BOOL
              )
              RETURNS ARRAY<STRUCT<step INT64, from_url STRING, to_url STRING, diff INT64>>
              LANGUAGE js AS """
                  if (!hits || !steps || steps.length < 2) return [];
                
                  var currentStepIdx = 0;
                  var stepTimes = [];
                  var lastHitIndex = -1;
                  var result = [];
                
                  // 1. Find the first occurrence of the START URL
                  for (var i = 0; i < hits.length; i++) {
                      if (hits[i].url === steps[0]) {
                          stepTimes.push(hits[i].ts);
                          lastHitIndex = i;
                          currentStepIdx = 1;
                          break;
                      }
                  }
                
                  // If start not found, return empty
                  if (currentStepIdx === 0) return [];
                
                  // 2. Find subsequent steps
                  for (var s = 1; s < steps.length; s++) {
                      var targetUrl = steps[s];
                      var stepFound = false;
                    
                      if (strict) {
                          // STRICT MODE: Must be the IMMEDIATE next event
                          if (lastHitIndex + 1 < hits.length && hits[lastHitIndex + 1].url === targetUrl) {
                              stepTimes.push(hits[lastHitIndex + 1].ts);
                              lastHitIndex++;
                              stepFound = true;
                          }
                      } else {
                          // LOOSE MODE: Search forward for the next occurrence
                          for (var i = lastHitIndex + 1; i < hits.length; i++) {
                              if (hits[i].url === targetUrl) {
                                  stepTimes.push(hits[i].ts);
                                  lastHitIndex = i;
                                  stepFound = true;
                                  break;
                              }
                          }
                      }
                    
                      // If any step in the chain is broken, stop recording timings
                      // (We only want completed sub-sequences? Or do we want partials? 
                      // The standard funnel calculation typically tracks drop-off.
                      // But for TIMING, we only care about transitions that actually happened.)
                      if (!stepFound) break; 
                  }
                
                  // Calculate diffs between found steps
                  // stepTimes contains [T0, T1, T2...] for steps 0, 1, 2...
                  // We produce pairs (0->1, 1->2, etc.)
                  for (var i = 0; i < stepTimes.length - 1; i++) {
                      var t1 = new Date(stepTimes[i]);
                      var t2 = new Date(stepTimes[i+1]);
                      var diffSeconds = (t2 - t1) / 1000;
                    
                      result.push({
                          step: i,
                          from_url: steps[i],
                          to_url: steps[i+1],
                          diff: Math.round(diffSeconds)
                      });
                  }

                  // Add total time if full funnel completed
                  if (stepTimes.length === steps.length) {
                      var tStart = new Date(stepTimes[0]);
                      var tEnd = new Date(stepTimes[stepTimes.length - 1]);
                      var totalDiffSeconds = (tEnd - tStart) / 1000;
                    
                      result.push({
                          step: -1, 
                          from_url: "Total",
                          to_url: "Total",
                          diff: Math.round(totalDiffSeconds)
                      });
                  }
                
                  return result;
              """;

              WITH events AS (
                  SELECT 
                      session_id,
                      ${normalizeUrlSql} as url_path,
                      created_at
                  FROM \`${GCP_PROJECT_ID}.umami.public_website_event\`
                  WHERE website_id = @websiteId
                    AND created_at BETWEEN @startDate AND @endDate
                    AND event_type = 1
                    -- Optimization: Filter to only relevant URLs early
                    -- Note: For strict mode, we might need context, but if we strictly just check the sequence of *funnel pages*,
                    -- filtering is fine IF strictness ignores non-funnel pages. 
                    -- standard strict funnel: A -> B (direct). 
                    -- If user does A -> Random -> B. Strict funnel fails.
                    -- If we filter out Random, we see A -> B. Strict funnel passes. 
                    -- THIS IS A SEMANTIC DIFFERENCE.
                    -- However, usually for "Funnel Analysis" we care about the specific flow defined.
                    -- But strictly speaking, "Direct Entry" means "referrer = prev_step".
                    -- To be safe and fast, we won't filter 'events' by URL for now to preserve strict semantics strictly.
                    -- But to survive the "Resources Exceeded", filtering is the main cure.
                    -- Let's Compromise: If Loose Mode, we filter. If Strict Mode, we don't (or we accept the loose-on-noise behavior).
                    -- Given the error, we MUST optimize. 
                    -- Let's try WITHOUT the URL filter first, relying on ARRAY_AGG efficiency.
                    -- If that fails, we can add the filter.
              ),
              sessions AS (
                  SELECT 
                      session_id,
                      ARRAY_AGG(STRUCT(url_path as url, created_at as ts) ORDER BY created_at) as hits
                  FROM events
                  GROUP BY session_id
              ),
              timings AS (
                  SELECT 
                      session_id,
                      match
                  FROM sessions,
                  UNNEST(match_funnel(hits, @steps, @strict)) as match
              )
              SELECT 
                  match.step,
                  match.from_url,
                  match.to_url,
                  AVG(match.diff) as avg_seconds,
                  APPROX_QUANTILES(match.diff, 2)[OFFSET(1)] as median_seconds,
                  COUNT(*) as count -- Debug info
              FROM timings
              GROUP BY 1, 2, 3
              ORDER BY step
          `;

          console.log('[Funnel Timing] Generated SQL query (Optimization: UDF)');

          // Create params object
          const params = {
              websiteId,
              startDate,
              endDate,
              steps: urls,
              strict: onlyDirectEntry
          };


          // Get dry run stats
          let queryStats = null;
          try {
              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: params,
                  dryRun: true
              }, navIdent, 'Traktanalyse'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };

              console.log(`[Funnel Timing] Dry run - Processing ${gbProcessed} GB, estimated cost: $${estimatedCostUSD} `);
          } catch (dryRunError) {
              console.log('[Funnel Timing] Dry run failed:', dryRunError.message);
          }

          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Traktanalyse'));

          const [rows] = await job.getQueryResults();

          if (rows.length === 0) {
              return res.json({ data: [], queryStats });
          }

          const timingData = rows.map((row) => ({
              fromStep: parseInt(row.step),
              toStep: parseInt(row.step) + 1,
              fromUrl: row.from_url,
              toUrl: row.to_url,
              avgSeconds: row.avg_seconds ? Math.round(parseFloat(row.avg_seconds)) : null,
              medianSeconds: row.median_seconds ? Math.round(parseFloat(row.median_seconds)) : null
          }));

          res.json({
              data: timingData,
              sql: query, // simplified for display
              queryStats
          });

      } catch (error) {
          console.error('BigQuery funnel timing error:', error);
          res.status(500).json({
              error: error.message || 'Failed to fetch funnel timing data'
          });
      }
  });


  // Get retention data from BigQuery
  router.post('/api/bigquery/retention', async (req, res) => {
      try {
          const { websiteId, startDate, endDate, urlPath, pathOperator, businessDaysOnly, countBy, countBySwitchAt } = req.body;

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({
                  error: 'BigQuery client not initialized'
              })
          }

          const countBySwitchAtMs = countBySwitchAt ? parseInt(countBySwitchAt) : NaN;
          const hasCountBySwitchAt = Number.isFinite(countBySwitchAtMs);
          const useDistinctId = countBy === 'distinct_id';
          const useSwitch = useDistinctId && hasCountBySwitchAt;
          const col = useDistinctId ? 'e.' : '';
          const fromClause = useDistinctId
              ? `\`${GCP_PROJECT_ID}.umami.public_website_event\` e LEFT JOIN \`${GCP_PROJECT_ID}.umami_views.session\` s ON e.session_id = s.session_id`
              : `\`${GCP_PROJECT_ID}.umami.public_website_event\``;
          const userIdExpression = useSwitch
              ? `IF(${col}created_at >= @countBySwitchAt, s.distinct_id, ${col}session_id)`
              : (useDistinctId ? 's.distinct_id' : `${col}session_id`);

          // Calculate the maximum days for retention based on the date range
          // This represents the maximum number of days someone from the earliest cohort
          // could have retention data (e.g., if month starts Nov 1 and today is Nov 22, maxDays = 21)
          const start = new Date(startDate);
          const end = new Date(endDate);
          const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const maxDays = Math.max(daysDiff, 31); // Allow up to 31 days for full month retention

          // Optimized query that normalizes URLs once and avoids expensive EXISTS clauses
          const query = `
              WITH base AS(
      --Pre - normalize URL once(no regex in joins later)
                  SELECT
                      ${userIdExpression} as user_id,
                      DATE(${col}created_at, 'Europe/Oslo') AS event_date,
      ${col}created_at,
      --lightweight URL normalization
                      IFNULL(
          NULLIF(
              RTRIM(
                  REGEXP_REPLACE(
                      REGEXP_REPLACE(${col}url_path, r'[?#].*', ''), --strip query / fragments
                                      r'//+', '/'), --collapse slashes
                                  '/'),
              ''),
          '/') AS url_path_clean
                  FROM ${fromClause}
                  WHERE ${col}website_id = @websiteId
                      AND ${col}created_at BETWEEN @startDate AND @endDate
              ),
              ${urlPath ? `
              filtered_sessions AS (
                  -- Only keep user-days where the specified URL occurred
                  SELECT DISTINCT
                      user_id,
                      event_date AS first_seen_date
                  FROM base
                  WHERE ${pathOperator === 'starts-with'
                      ? 'LOWER(url_path_clean) LIKE @urlPathPattern'
                      : 'url_path_clean = @urlPath'}
              ),
              ` : `
              filtered_sessions AS (
                  -- Get first seen date for each user
                  SELECT
                      user_id,
                      MIN(event_date) AS first_seen_date
                  FROM base
                  GROUP BY user_id
              ),
              `}
              user_activity AS (
                  SELECT DISTINCT
                      user_id,
                      event_date AS activity_date
                  FROM base
                  ${businessDaysOnly ? `WHERE EXTRACT(DAYOFWEEK FROM event_date) NOT IN (1, 7)` : ''}
              ),
              retention_base AS (
                  SELECT
                      f.user_id,
                      f.first_seen_date,
                      a.activity_date,
                      DATE_DIFF(a.activity_date, f.first_seen_date, DAY) AS day_diff
                  FROM filtered_sessions f
                  JOIN user_activity a
                      USING (user_id)
                  WHERE DATE_DIFF(a.activity_date, f.first_seen_date, DAY) >= 0
              ),
              retention_counts AS (
                  SELECT
                      day_diff,
                      COUNT(DISTINCT user_id) AS returning_users
                  FROM retention_base
                  WHERE day_diff <= @maxDays
                  GROUP BY day_diff
              ),
              user_counts AS (
                  SELECT COUNT(DISTINCT user_id) AS total_users
                  FROM filtered_sessions
              )
              SELECT
                  rc.day_diff AS day,
                  rc.returning_users,
                  u.total_users
              FROM retention_counts rc
              CROSS JOIN user_counts u
              ORDER BY rc.day_diff
          `;

          const params = {
              websiteId,
              startDate,
              endDate,
              maxDays
          };
          if (useSwitch) {
              params.countBySwitchAt = new Date(countBySwitchAtMs).toISOString();
          }

          if (urlPath) {
              if (pathOperator === 'starts-with') {
                  params.urlPathPattern = urlPath.toLowerCase() + '%';
              } else {
                  params.urlPath = urlPath;
              }
          }

          // Get dry run stats
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging


              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: params,
                  dryRun: true
              }, navIdent, 'Brukerlojalitet'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };

              console.log(`[Retention] Dry run - Processing ${gbProcessed} GB, estimated cost: $${estimatedCostUSD}`);
          } catch (dryRunError) {
              console.log('[Retention] Dry run failed:', dryRunError.message);
          }

          // Get NAV ident from authenticated user for audit logging

          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Brukerlojalitet'));

          const [rows] = await job.getQueryResults();

          // Process rows to calculate percentages relative to Day 0
          // Note: The SQL above aggregates all cohorts together.
          // Day 0 count represents the total number of unique users in the period (approx).
          // But strictly speaking, for retention curve, Day 0 should be 100%.

          let day0Count = 0;
          const day0Row = rows.find(r => r.day === 0);
          if (day0Row) {
              day0Count = parseInt(day0Row.returning_users);
          }

          const data = rows.map(row => {
              const count = parseInt(row.returning_users);
              const percentage = day0Count > 0 ? Math.round((count / day0Count) * 100) : 0;
              return {
                  day: row.day,
                  returning_users: count,
                  percentage: percentage
              };
          });

          res.json({
              data,
              queryStats
          });

      } catch (error) {
          console.error('BigQuery retention error:', error);
          res.status(500).json({
              error: error.message || 'Failed to fetch retention data'
          });
      }
  });

  // Get user composition data from BigQuery
  router.post('/api/bigquery/composition', async (req, res) => {
      try {
          const { websiteId, startDate, endDate, urlPath, pathOperator, countBy, countBySwitchAt } = req.body;

          const countBySwitchAtMs = countBySwitchAt ? parseInt(countBySwitchAt) : NaN;
          const hasCountBySwitchAt = Number.isFinite(countBySwitchAtMs);
          const useDistinctId = countBy === 'distinct_id';
          const useSwitch = useDistinctId && hasCountBySwitchAt;
          // Use umami_views.session if identifying by distinct_id to ensure access to that column, otherwise public_session is fine
          const table = useDistinctId
              ? `\`${GCP_PROJECT_ID}.umami_views.session\``
              : `\`${GCP_PROJECT_ID}.umami.public_session\``;

          const userIdExpression = useSwitch
              ? `IF(s.created_at >= @countBySwitchAt, s.distinct_id, s.session_id)`
              : (useDistinctId ? 's.distinct_id' : 's.session_id');
          const countExpression = useDistinctId ? 'COUNT(DISTINCT user_id)' : 'COUNT(*)';

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({
                  error: 'BigQuery client not initialized'
              })
          }

          // Helper to generate the URL normalization SQL
          const normalizeUrlSql = `
              CASE 
                  WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                  THEN '/'
                  ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
              END
          `;

          // Base query to select relevant sessions
          // If urlPath is provided, we filter sessions that visited that URL
          const query = `
              WITH relevant_sessions AS (
                  SELECT
                      s.browser,
                      s.os,
                      s.device,
                      s.screen,
                      s.language,
                      s.country,
                      ${userIdExpression} as user_id
                  FROM ${table} s
                  WHERE s.website_id = @websiteId
                    AND s.created_at BETWEEN @startDate AND @endDate
                    ${urlPath ? `
                    AND EXISTS (
                      SELECT 1 
                      FROM \`${GCP_PROJECT_ID}.umami.public_website_event\` e 
                      WHERE e.session_id = s.session_id 
                        AND e.website_id = @websiteId
                        AND e.created_at BETWEEN @startDate AND @endDate
                        ${pathOperator === 'starts-with'
                      ? `AND LOWER(${normalizeUrlSql.replace(/url_path/g, 'e.url_path')}) LIKE @urlPathPattern`
                      : `AND ${normalizeUrlSql.replace(/url_path/g, 'e.url_path')} = @urlPath`
                  }
                    )` : ''}
              )
              SELECT 'browser' as category, browser as value, ${countExpression} as count FROM relevant_sessions GROUP BY 1, 2
              UNION ALL
              SELECT 'os' as category, os as value, ${countExpression} as count FROM relevant_sessions GROUP BY 1, 2
              UNION ALL
              SELECT 'device' as category, device as value, ${countExpression} as count FROM relevant_sessions GROUP BY 1, 2
              UNION ALL
              SELECT 'screen' as category, screen as value, ${countExpression} as count FROM relevant_sessions GROUP BY 1, 2
              UNION ALL
              SELECT 'language' as category, language as value, ${countExpression} as count FROM relevant_sessions GROUP BY 1, 2
              UNION ALL
              SELECT 'country' as category, country as value, ${countExpression} as count FROM relevant_sessions GROUP BY 1, 2
              ORDER BY category, count DESC
          `;

          const params = {
              websiteId,
              startDate,
              endDate
          };
          if (useSwitch) {
              params.countBySwitchAt = new Date(countBySwitchAtMs).toISOString();
          }

          if (urlPath) {
              if (pathOperator === 'starts-with') {
                  params.urlPathPattern = urlPath.toLowerCase() + '%';
              } else {
                  params.urlPath = urlPath;
              }
          }

          // Get dry run stats
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging


              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: params,
                  dryRun: true
              }, navIdent, 'Brukersammensetning'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };

              console.log(`[Composition] Dry run - Processing ${gbProcessed} GB, estimated cost: $${estimatedCostUSD}`);
          } catch (dryRunError) {
              console.log('[Composition] Dry run failed:', dryRunError.message);
          }

          // Get NAV ident from authenticated user for audit logging

          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Brukersammensetning'));

          const [rows] = await job.getQueryResults();

          res.json({
              data: rows,
              queryStats,
              meta: { usedDistinctId: useDistinctId }
          });

      } catch (error) {
          console.error('BigQuery composition error:', error);

          // Detailed connection error logging
          if (error.code) console.error('Error Code:', error.code);
          if (error.errors) console.error('Error Details:', JSON.stringify(error.errors, null, 2));
          if (error.response) console.error('Error Response:', JSON.stringify(error.response, null, 2));

          res.status(500).json({
              error: error.message || 'Failed to fetch composition data',
              details: error.errors || error.response
          });
      }
  });

  // Privacy Check Endpoint
  router.post('/api/bigquery/privacy-check', async (req, res) => {
      try {

          const { websiteId, startDate, endDate, dryRun } = req.body;

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({ error: 'BigQuery client not initialized' });
          }

          const params = {
              startDate,
              endDate
          };

          if (websiteId) {
              params.websiteId = websiteId;
          }

          // Regex patterns
          // Note: BigQuery uses RE2 regex - using simple patterns and relying on post-processing for filtering
          const patterns = {
              'Fødselsnummer': '\\b\\d{11}\\b',
              'UUID': '\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b',
              'Navident': '\\b[a-zA-Z]\\d{6}\\b',
              'E-post': '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
              'IP-adresse': '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
              'Telefonnummer': '\\b[2-9]\\d{7}\\b',
              'Bankkort': '\\b\\d{4}[-\\s]\\d{4}[-\\s]\\d{4}[-\\s]\\d{4}\\b',
              'Mulig navn': '\\b[A-ZÆØÅ][a-zæøå]{1,20}\\s[A-ZÆØÅ][a-zæøå]{1,20}(?:\\s[A-ZÆØÅ][a-zæøå]{1,20})?\\b',
              'Mulig adresse': '\\b\\d{4}\\s[A-ZÆØÅ][A-ZÆØÅa-zæøå]+(?:\\s[A-ZÆØÅa-zæøå]+)*\\b',
              'Hemmelig adresse': '(?i)hemmelig(?:%20|\\s+)(?:20\\s*%(?:%20|\\s+))?adresse',
              'Kontonummer': '\\b\\d{4}\\.?\\d{2}\\.\\d{5}\\b',
              'Organisasjonsnummer': '\\b\\d{9}\\b',
              'Bilnummer': '\\b[A-Z]{2}\\s?\\d{5}\\b',
              'Mulig søk': '[?&](?:q|query|search|k|ord)=[^&]+',
              'Redacted': '\\[.*?\\]'
          };

          // Tables and columns to check
          const checks = [
              // public_website_event
              { table: 'public_website_event', column: 'url_path' },
              { table: 'public_website_event', column: 'url_query' },
              { table: 'public_website_event', column: 'referrer_path' },
              { table: 'public_website_event', column: 'referrer_query' },
              { table: 'public_website_event', column: 'referrer_domain' },
              { table: 'public_website_event', column: 'page_title' },
              { table: 'public_website_event', column: 'event_name' },
              // public_session
              { table: 'public_session', column: 'hostname' },
              { table: 'public_session', column: 'browser' },
              { table: 'public_session', column: 'os' },
              { table: 'public_session', column: 'device' },
              { table: 'public_session', column: 'city' },

          ];

          // If global search, fetch website names first
          let websiteMap = new Map();
          if (!websiteId) {
              try {
                  const [siteRows] = await bigquery.query(addAuditLogging({
                      query: `SELECT website_id, name FROM \`${GCP_PROJECT_ID}.umami.public_website\``
                  }, navIdent, 'Personvernssjekk'));
                  siteRows.forEach(r => websiteMap.set(r.website_id, r.name));
              } catch (e) {
                  console.error('Error fetching websites for global search:', e);
              }
          }

          let unionQueries = [];

          for (const check of checks) {
              for (const [type, pattern] of Object.entries(patterns)) {
                  // Special filter for phone numbers to avoid matching /vis/123...
                  const extraFilter = type === 'Telefonnummer'
                      ? `AND NOT REGEXP_CONTAINS(${check.column}, r'/vis/[0-9]+')`
                      : '';

                  if (websiteId) {
                      unionQueries.push(`
                          SELECT 
                              '${check.table}' as table_name,
                              '${check.column}' as column_name,
                              '${type}' as match_type,
                              COUNT(*) as count,
                              ${type === 'E-post' ? `COUNTIF(REGEXP_CONTAINS(${check.column}, r'@nav'))` : '0'} as nav_count,
                              ${type === 'E-post' ? `COUNT(DISTINCT ${check.column})` : '0'} as unique_count,
                              ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN REGEXP_CONTAINS(${check.column}, r'@nav') THEN ${check.column} END)` : '0'} as unique_nav_count,
                              ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN NOT REGEXP_CONTAINS(${check.column}, r'@nav') THEN ${check.column} END)` : '0'} as unique_other_count,
                              ARRAY_AGG(DISTINCT ${check.column} LIMIT 5) as examples
                          FROM \`.umami.${check.table}\`
                          WHERE website_id = @websiteId
                          AND created_at BETWEEN @startDate AND @endDate
                          AND REGEXP_CONTAINS(${check.column}, r'${pattern}')
                          ${extraFilter}
                      `);
                  } else {
                      // Global search: group by website_id
                      unionQueries.push(`
                          SELECT 
                              website_id,
                              '${check.table}' as table_name,
                              '${check.column}' as column_name,
                              '${type}' as match_type,
                              COUNT(*) as count,
                              ${type === 'E-post' ? `COUNTIF(REGEXP_CONTAINS(${check.column}, r'@nav'))` : '0'} as nav_count,
                              ${type === 'E-post' ? `COUNT(DISTINCT ${check.column})` : '0'} as unique_count,
                              ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN REGEXP_CONTAINS(${check.column}, r'@nav') THEN ${check.column} END)` : '0'} as unique_nav_count,
                              ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN NOT REGEXP_CONTAINS(${check.column}, r'@nav') THEN ${check.column} END)` : '0'} as unique_other_count,
                              ARRAY_AGG(DISTINCT ${check.column} LIMIT 5) as examples
                          FROM \`.umami.${check.table}\`
                          WHERE created_at BETWEEN @startDate AND @endDate
                          AND REGEXP_CONTAINS(${check.column}, r'${pattern}')
                          ${extraFilter}
                          GROUP BY website_id
                      `);
                  }
              }
          }

          // Special check for event_data (nested in views)
          for (const [type, pattern] of Object.entries(patterns)) {
              // Special filter for phone numbers to avoid matching /vis/123...
              const extraFilter = type === 'Telefonnummer'
                  ? `AND NOT REGEXP_CONTAINS(p.string_value, r'/vis/[0-9]+')`
                  : '';

              if (websiteId) {
                  unionQueries.push(`
                      SELECT 
                          'event_data' as table_name,
                          'string_value' as column_name,
                          '${type}' as match_type,
                          COUNT(*) as count,
                          ${type === 'E-post' ? `COUNTIF(REGEXP_CONTAINS(p.string_value, r'@nav'))` : '0'} as nav_count,
                          ${type === 'E-post' ? `COUNT(DISTINCT p.string_value)` : '0'} as unique_count,
                          ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN REGEXP_CONTAINS(p.string_value, r'@nav') THEN p.string_value END)` : '0'} as unique_nav_count,
                          ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN NOT REGEXP_CONTAINS(p.string_value, r'@nav') THEN p.string_value END)` : '0'} as unique_other_count,
                          ARRAY_AGG(DISTINCT p.string_value LIMIT 5) as examples
                      FROM \`${GCP_PROJECT_ID}.umami.public_website_event\` e
                      JOIN \`${GCP_PROJECT_ID}.umami_views.event_data\` d
                          ON e.event_id = d.website_event_id
                          AND e.website_id = d.website_id
                          AND e.created_at = d.created_at
                      CROSS JOIN UNNEST(d.event_parameters) AS p
                      WHERE e.website_id = @websiteId
                      AND e.created_at BETWEEN @startDate AND @endDate
                      AND REGEXP_CONTAINS(p.string_value, r'${pattern}')
                      ${extraFilter}
                  `);
              } else {
                  // Global search: group by website_id
                  unionQueries.push(`
                      SELECT 
                          e.website_id,
                          'event_data' as table_name,
                          'string_value' as column_name,
                          '${type}' as match_type,
                          COUNT(*) as count,
                          ${type === 'E-post' ? `COUNTIF(REGEXP_CONTAINS(p.string_value, r'@nav'))` : '0'} as nav_count,
                          ${type === 'E-post' ? `COUNT(DISTINCT p.string_value)` : '0'} as unique_count,
                          ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN REGEXP_CONTAINS(p.string_value, r'@nav') THEN p.string_value END)` : '0'} as unique_nav_count,
                          ${type === 'E-post' ? `COUNT(DISTINCT CASE WHEN NOT REGEXP_CONTAINS(p.string_value, r'@nav') THEN p.string_value END)` : '0'} as unique_other_count,
                          ARRAY_AGG(DISTINCT p.string_value LIMIT 5) as examples
                      FROM \`${GCP_PROJECT_ID}.umami.public_website_event\` e
                      JOIN \`${GCP_PROJECT_ID}.umami_views.event_data\` d
                          ON e.event_id = d.website_event_id
                          AND e.website_id = d.website_id
                          AND e.created_at = d.created_at
                      CROSS JOIN UNNEST(d.event_parameters) AS p
                      WHERE e.created_at BETWEEN @startDate AND @endDate
                      AND REGEXP_CONTAINS(p.string_value, r'${pattern}')
                      ${extraFilter}
                      GROUP BY e.website_id
                  `);
              }
          }

          const query = unionQueries.join(' UNION ALL ');

          // Wrap in outer query to order results
          // For global search, we just return the raw union results (ordered by count)
          const finalQuery = `
              SELECT * FROM (
                  ${query}
              )
              ORDER BY count DESC
          `;

          // Dry run check
          if (dryRun) {
              try {
                  // Get NAV ident from authenticated user for audit logging


                  const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                      query: finalQuery,
                      location: 'europe-north1',
                      params: params,
                      dryRun: true
                  }, navIdent, 'Personvernssjekk'));

                  const stats = dryRunJob.metadata.statistics;
                  const bytesProcessed = parseInt(stats.totalBytesProcessed);
                  const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(2);
                  const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

                  return res.json({
                      dryRun: true,
                      queryStats: {
                          totalBytesProcessedGB: gbProcessed,
                          estimatedCostUSD: estimatedCostUSD
                      }
                  });
              } catch (dryRunError) {
                  console.log('[Privacy Check] Dry run failed:', dryRunError.message);
                  // Fall through to execution if dry run fails? Or return error?
                  // For now, let's return error to be safe
                  return res.status(500).json({ error: 'Dry run failed: ' + dryRunError.message });
              }
          }

          // Get NAV ident from authenticated user for audit logging


          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: finalQuery,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Personvernssjekk'));

          const [rows] = await job.getQueryResults();

          // Filter out false positives
          // For bank cards and phone numbers: exclude matches that are part of UUIDs
          const uuidPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;

          let processedRows = rows.filter(row => {
              if (row.match_type === 'Bankkort' || row.match_type === 'Telefonnummer') {
                  // Check if any example contains a UUID pattern
                  const hasUuid = row.examples?.some(ex => uuidPattern.test(ex));
                  return !hasUuid;
              }
              return true;
          });

          // Map website names if global search
          if (!websiteId) {
              processedRows = processedRows.map(row => ({
                  ...row,
                  website_name: websiteMap.get(row.website_id) || row.website_id
              }));
          }

          // Get dry run stats
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging

              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: finalQuery,
                  location: 'europe-north1',
                  params: params,
                  dryRun: true
              }, navIdent));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(2);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };
          } catch (dryRunError) {
              console.log('[Privacy Check] Dry run failed:', dryRunError.message);
          }

          res.json({ data: processedRows, queryStats });

      } catch (error) {
          console.error('Privacy check error:', error);
          res.status(500).json({ error: error.message });
      }
  });


  // Get user sessions (User Profiles)
  router.post('/api/bigquery/users', async (req, res) => {
      try {
          const { websiteId, startDate, endDate, query: searchQuery, limit = 50, offset = 0, maxUsers: maxUsersInput, urlPath, pathOperator, countBy, countBySwitchAt } = req.body;
          const DEFAULT_MAX_USERS = 5000;
          const MIN_MAX_USERS = 50;
          const MAX_MAX_USERS = 10000;

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({ error: 'BigQuery client not initialized' });
          }

          const countBySwitchAtMs = countBySwitchAt ? parseInt(countBySwitchAt) : NaN;
          const hasCountBySwitchAt = Number.isFinite(countBySwitchAtMs);
          const useDistinctId = countBy === 'distinct_id';
          const useSwitch = useDistinctId && hasCountBySwitchAt;
          const userKeyExpression = useSwitch
              ? `IF(session.created_at >= @countBySwitchAt, session.distinct_id, session.session_id)`
              : (useDistinctId ? 'session.distinct_id' : 'session.session_id');
          const idTypeExpression = useSwitch
              ? `IF(session.created_at >= @countBySwitchAt AND session.distinct_id IS NOT NULL, 'cookie', 'session')`
              : (useDistinctId ? `'cookie'` : `'session'`);

          const parsedMaxUsers = parseInt(maxUsersInput, 10);
          const maxUsers = Number.isFinite(parsedMaxUsers)
              ? Math.min(Math.max(parsedMaxUsers, MIN_MAX_USERS), MAX_MAX_USERS)
              : DEFAULT_MAX_USERS;

          const parsedLimit = parseInt(limit, 10);
          const parsedOffset = parseInt(offset, 10);
          const safeOffset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;
          const remaining = Math.max(maxUsers - safeOffset, 0);
          const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 0), remaining) : Math.min(50, remaining);

          if (safeLimit === 0) {
              return res.json({ users: [], total: maxUsers, queryStats: null });
          }

          const params = {
              websiteId,
              startDate,
              endDate,
              limit: safeLimit,
              offset: safeOffset,
              maxUsers
          };
          if (useSwitch) {
              params.countBySwitchAt = new Date(countBySwitchAtMs).toISOString();
          }

          let searchFilter = '';
          if (searchQuery) {
              searchFilter = `AND (session.session_id LIKE @searchQuery OR session.distinct_id LIKE @searchQuery)`;
              params.searchQuery = `%${searchQuery}%`;
          }

          console.log('[User Profiles] Request:', { websiteId, urlPath, searchQuery });

          let urlFilterCTE = '';
          let urlFilterJoin = '';
          if (urlPath) {
              // Add URL path parameters

              let condition = '';

              if (pathOperator === 'starts-with') {
                  // Helper to generate the URL normalization SQL (same as in composition)
                  const normalizeUrlSql = `
                      CASE 
                          WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                          THEN '/'
                          ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
                      END
                  `;

                  condition = `LOWER(${normalizeUrlSql}) LIKE @urlPathPattern`;
                  params.urlPathPattern = urlPath.toLowerCase() + '%';
              } else {
                  params.urlPath = urlPath;
                  params.urlPathSlash = urlPath.endsWith('/') ? urlPath : urlPath + '/';
                  params.urlPathQuery = urlPath + '?%';

                  condition = `(
                          url_path = @urlPath
                          OR url_path = @urlPathSlash
                          OR url_path LIKE @urlPathQuery
                      )`;
              }

              // CTE to find sessions that visited the specified URL
              urlFilterCTE = `
                  matching_sessions AS (
                      SELECT DISTINCT session_id
                      FROM \`${GCP_PROJECT_ID}.umami.public_website_event\`
                      WHERE website_id = @websiteId
                      AND created_at BETWEEN @startDate AND @endDate
                      AND ${condition}
                  ),
              `;
              urlFilterJoin = `INNER JOIN matching_sessions ms ON session.session_id = ms.session_id`;

              console.log('[User Profiles] URL filter active:', { urlPath, pathOperator, urlFilterCTE: 'CTE defined', urlFilterJoin });
          }

          const query = `
              WITH ${urlFilterCTE}
              session_data AS (
                  SELECT
                      ${userKeyExpression} as user_id,
                      ${idTypeExpression} as id_type,
                      MAX(session.created_at) as last_seen,
                      MIN(session.created_at) as first_seen,
                      ANY_VALUE(session.country) as country,
                      ANY_VALUE(session.device) as device,
                      ANY_VALUE(session.os) as os,
                      ANY_VALUE(session.browser) as browser,
                      ANY_VALUE(session.distinct_id) as distinct_id,
                      ARRAY_AGG(DISTINCT session.session_id) as session_ids,
                      ARRAY_AGG(session.session_id ORDER BY session.created_at DESC LIMIT 1)[OFFSET(0)] as primary_session_id,
                      COUNT(*) as event_count
                  FROM \`${GCP_PROJECT_ID}.umami_views.session\` as session
                  ${urlFilterJoin}
                  WHERE session.website_id = @websiteId
                  AND session.created_at BETWEEN @startDate AND @endDate
                  ${searchFilter}
                  GROUP BY user_id, id_type
              )
              SELECT * FROM session_data
              ORDER BY last_seen DESC
              LIMIT @limit OFFSET @offset
          `;

          console.log('[User Profiles] Query:', query.substring(0, 500) + '...');

          // Get NAV ident from authenticated user for audit logging


          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Brukerprofiler'));

          const [rows] = await job.getQueryResults();

          // Get total count for pagination
          const countQuery = `
              WITH ${urlFilterCTE}
              filtered_sessions AS (
                  SELECT DISTINCT ${userKeyExpression} as user_id
                  FROM \`${GCP_PROJECT_ID}.umami_views.session\` as session
                  ${urlFilterJoin}
                  WHERE session.website_id = @websiteId
                  AND session.created_at BETWEEN @startDate AND @endDate
                  ${searchFilter}
              )
              SELECT COUNT(*) as total FROM (
                  SELECT 1 FROM filtered_sessions LIMIT @maxUsers
              )
          `;


          const [countJob] = await bigquery.createQueryJob(addAuditLogging({
              query: countQuery,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Brukerprofiler'));

          const [countRows] = await countJob.getQueryResults();
          const total = countRows[0]?.total || 0;

          // Get dry run stats
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging

              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: params,
                  dryRun: true
              }, navIdent, 'Brukerprofiler'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(2);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };
          } catch (dryRunError) {
              console.log('[User Profiles] Dry run failed:', dryRunError.message);
          }

          const users = rows.map(row => ({
              userId: row.user_id,
              idType: row.id_type,
              sessionIds: row.session_ids || [],
              primarySessionId: row.primary_session_id,
              distinctId: row.distinct_id,
              lastSeen: row.last_seen.value,
              firstSeen: row.first_seen.value,
              country: row.country,
              device: row.device,
              os: row.os,
              browser: row.browser,
              eventCount: parseInt(row.event_count)
          }));

          res.json({ users, total, queryStats });

      } catch (error) {
          console.error('BigQuery users error:', error);
          res.status(500).json({ error: error.message });
      }
  });

  // Get user activity (User Profile Details)
  router.post('/api/bigquery/users/:sessionId/activity', async (req, res) => {
      try {
          const { sessionId } = req.params;
          const { websiteId, startDate, endDate } = req.body;

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          if (!bigquery) {
              return res.status(500).json({ error: 'BigQuery client not initialized' });
          }

          const params = {
              websiteId,
              sessionId,
              startDate,
              endDate
          };

          const query = `
              SELECT
                  created_at,
                  event_type,
                  event_name,
                  url_path,
                  page_title
              FROM \`${GCP_PROJECT_ID}.umami_views.event\`
              WHERE website_id = @websiteId
              AND session_id = @sessionId
              AND created_at BETWEEN @startDate AND @endDate
              ORDER BY created_at DESC
              LIMIT 1000
          `;

          // Get NAV ident from authenticated user for audit logging


          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              params: params
          }, navIdent, 'Brukerprofiler'));

          const [rows] = await job.getQueryResults();

          // Get dry run stats
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging

              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  params: params,
                  dryRun: true
              }, navIdent, 'Brukerprofiler'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(2);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };
          } catch (dryRunError) {
              console.log('[User Activity] Dry run failed:', dryRunError.message);
          }

          const activity = rows.map(row => ({
              createdAt: row.created_at.value,
              type: row.event_type === 1 ? 'pageview' : 'event',
              name: row.event_name,
              url: row.url_path,
              title: row.page_title
          }));

          res.json({ activity, queryStats });

      } catch (error) {
          console.error('BigQuery user activity error:', error);
          res.status(500).json({ error: error.message });
      }
  });

  return router;
}

