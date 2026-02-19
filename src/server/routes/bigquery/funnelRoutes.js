import express from 'express';
import { addAuditLogging, substituteQueryParameters } from '../../bigquery/audit.js';
import { requireBigQuery, getNavIdent, getDryRunStats, normalizeUrlSql } from './helpers.js';

export function createFunnelRoutes({ bigquery, GCP_PROJECT_ID }) {
  const router = express.Router();

  // Get funnel data from BigQuery
  router.post('/api/bigquery/funnel', async (req, res) => {
    try {
      const { websiteId, urls, steps: inputSteps, startDate, endDate, onlyDirectEntry = true } = req.body;
      const navIdent = getNavIdent(req);

      if (!requireBigQuery(bigquery, res)) return;

      // Backward compatibility: Convert legacy `urls` to `steps` if `steps` is missing
      let steps = inputSteps;
      if (!steps && urls) {
        steps = urls.map(url => ({ type: 'url', value: url }));
      }

      if (!steps || !Array.isArray(steps) || steps.length < 2) {
        return res.status(400).json({
          error: 'At least 2 steps are required for a funnel',
        });
      }

      // Determine which event types we need to query
      const neededEventTypes = new Set();
      steps.forEach(step => {
        if (step.type === 'url') neededEventTypes.add(1);
        if (step.type === 'event') neededEventTypes.add(2);
      });
      const eventTypesList = Array.from(neededEventTypes).join(', ');

      const urlNormSql = normalizeUrlSql();

      // 1. Base events CTE with step_value calculation
      let query = `
          WITH events_raw AS (
              SELECT
                  session_id,
                  event_id,
                  website_id,
                  event_type,
                  CASE
                      WHEN event_type = 1 THEN ${urlNormSql}
                      WHEN event_type = 2 THEN event_name
                      ELSE NULL
                  END as step_value,
                  ${urlNormSql} as url_path_normalized,
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
        const typeCheck = step.type === 'url' ? 'AND event_type = 1' : 'AND event_type = 2';

        const eventScopeCheck = (step.type === 'event' && step.eventScope === 'current-path' && index > 0)
          ? `AND e.url_path_normalized = prev.url_path${index}`
          : '';

        // Check for event parameters (filters)
        let paramFilters = '';
        if (step.type === 'event' && step.params && Array.isArray(step.params) && step.params.length > 0) {
          const conditions = step.params.map((p, pIdx) => {
            const pKeyName = `step${index}_pKey${pIdx}`;
            const pValName = `step${index}_pVal${pIdx}`;
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

        const isWildcard = step.value.includes('*');
        const operator = isWildcard ? 'LIKE' : '=';

        if (index === 0) {
          return `
          ${stepName} AS (
              SELECT session_id, MIN(created_at) as time${index + 1},
                     MIN(url_path_normalized) as url_path${index + 1},
                     e.event_id as event_id${index + 1}
              FROM events e
              WHERE step_value ${operator} @${paramName}
                ${typeCheck}
                ${paramFilters}
              GROUP BY session_id, e.event_id
          )`;
        } else {
          const prevParamName = `stepValue${index - 1}`;
          const isPrevWildcard = steps[index - 1].value.includes('*');
          const prevOperator = isPrevWildcard ? 'LIKE' : '=';

          if (onlyDirectEntry) {
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
      const params = { websiteId, startDate, endDate };

      steps.forEach((step, index) => {
        params[`stepValue${index}`] = step.value.includes('*')
          ? step.value.replace(/\*/g, '%')
          : step.value;

        if (step.type === 'event' && step.params && Array.isArray(step.params)) {
          step.params.forEach((p, pIdx) => {
            params[`step${index}_pKey${pIdx}`] = p.key;
            params[`step${index}_pVal${pIdx}`] = p.operator === 'contains'
              ? `%${p.value}%`
              : p.value;
          });
        }
      });

      const queryStats = await getDryRunStats(bigquery, {
        query, params, navIdent, analysisType: 'Traktanalyse',
      }, addAuditLogging);

      if (queryStats) {
        console.log(`[Funnel] Dry run - Processing ${queryStats.totalBytesProcessedGB} GB, estimated cost: $${queryStats.estimatedCostUSD} (Types: ${eventTypesList})`);
      }

      const [job] = await bigquery.createQueryJob(addAuditLogging({
        query,
        location: 'europe-north1',
        params,
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
        count: parseInt(row.count || 0),
      }));

      res.json({ data, queryStats, sql: substituteQueryParameters(query, params) });
    } catch (error) {
      console.error('BigQuery funnel error:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch funnel data',
      });
    }
  });

  // Get funnel timing data from BigQuery
  router.post('/api/bigquery/funnel-timing', async (req, res) => {
    try {
      const { websiteId, steps, startDate, endDate, onlyDirectEntry = true } = req.body;
      let { urls } = req.body;
      const navIdent = getNavIdent(req);

      if (!requireBigQuery(bigquery, res)) return;

      // Support 'steps' input format (array of objects) by extracting values
      if (!urls && steps && Array.isArray(steps)) {
        urls = steps.map(s => s.value);
      }

      if (!urls || !Array.isArray(urls) || urls.length < 2) {
        return res.status(400).json({
          error: 'At least 2 URLs are required for a funnel',
        });
      }

      const urlNormSql = normalizeUrlSql();

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
            
              for (var i = 0; i < hits.length; i++) {
                  if (hits[i].url === steps[0]) {
                      stepTimes.push(hits[i].ts);
                      lastHitIndex = i;
                      currentStepIdx = 1;
                      break;
                  }
              }
            
              if (currentStepIdx === 0) return [];
            
              for (var s = 1; s < steps.length; s++) {
                  var targetUrl = steps[s];
                  var stepFound = false;
                
                  if (strict) {
                      if (lastHitIndex + 1 < hits.length && hits[lastHitIndex + 1].url === targetUrl) {
                          stepTimes.push(hits[lastHitIndex + 1].ts);
                          lastHitIndex++;
                          stepFound = true;
                      }
                  } else {
                      for (var i = lastHitIndex + 1; i < hits.length; i++) {
                          if (hits[i].url === targetUrl) {
                              stepTimes.push(hits[i].ts);
                              lastHitIndex = i;
                              stepFound = true;
                              break;
                          }
                      }
                  }
                
                  if (!stepFound) break; 
              }
            
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
                  ${urlNormSql} as url_path,
                  created_at
              FROM \`${GCP_PROJECT_ID}.umami.public_website_event\`
              WHERE website_id = @websiteId
                AND created_at BETWEEN @startDate AND @endDate
                AND event_type = 1
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
              COUNT(*) as count
          FROM timings
          GROUP BY 1, 2, 3
          ORDER BY step
      `;

      const params = {
        websiteId,
        startDate,
        endDate,
        steps: urls,
        strict: onlyDirectEntry,
      };

      const queryStats = await getDryRunStats(bigquery, {
        query, params, navIdent, analysisType: 'Traktanalyse',
      }, addAuditLogging);

      if (queryStats) {
        console.log(`[Funnel Timing] Dry run - Processing ${queryStats.totalBytesProcessedGB} GB, estimated cost: $${queryStats.estimatedCostUSD}`);
      }

      const [job] = await bigquery.createQueryJob(addAuditLogging({
        query,
        location: 'europe-north1',
        params,
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
        medianSeconds: row.median_seconds ? Math.round(parseFloat(row.median_seconds)) : null,
      }));

      res.json({ data: timingData, sql: query, queryStats });

    } catch (error) {
      console.error('BigQuery funnel timing error:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch funnel timing data',
      });
    }
  });

  return router;
}

