import express from 'express';
import { addAuditLogging } from '../../bigquery/audit.js';

export function createSqlRouter({ bigquery }) {
  const router = express.Router();

  // BigQuery API endpoint
  router.post('/api/bigquery', async (req, res) => {
      try {
          const { query, analysisType } = req.body

          console.log('[BigQuery API] Request received');

          if (!query) {
              console.error('[BigQuery API] Error: Query is required');
              return res.status(400).json({ error: 'Query is required' })
          }

          if (!bigquery) {
              console.error('[BigQuery API] Error: BigQuery client not initialized');
              return res.status(500).json({
                  error: 'BigQuery client not initialized',
                  details: 'Check server logs for initialization errors'
              })
          }

          console.log('[BigQuery API] Submitting query...');

          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1'
          }, navIdent, analysisType || 'Sqlverktoy'));

          console.log('[BigQuery API] Query job created, waiting for results...');

          const [rows] = await job.getQueryResults()

          console.log('[BigQuery API] Query successful, returned', rows.length, 'rows');

          // Get dry run stats
          let queryStats = null;
          try {
              // Get NAV ident from authenticated user for audit logging

              const [dryRunJob] = await bigquery.createQueryJob(addAuditLogging({
                  query: query,
                  location: 'europe-north1',
                  dryRun: true
              }, navIdent, analysisType || 'Sqlverktoy'));

              const stats = dryRunJob.metadata.statistics;
              const bytesProcessed = parseInt(stats.totalBytesProcessed);
              const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(2);
              const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

              queryStats = {
                  totalBytesProcessed: bytesProcessed,
                  totalBytesProcessedGB: gbProcessed,
                  estimatedCostUSD: estimatedCostUSD
              };

              console.log('[BigQuery API] Dry run stats - Processing', gbProcessed, 'GB, estimated cost: $' + estimatedCostUSD);
          } catch (dryRunError) {
              console.log('[BigQuery API] Dry run failed:', dryRunError.message);
          }

          res.json({
              success: true,
              data: rows,
              rowCount: rows.length,
              queryStats
          })
      } catch (error) {
          console.error('==========================================');
          console.error('[BigQuery API] ERROR');
          console.error('==========================================');
          console.error('Error message:', error.message);
          console.error('Error code:', error.code);
          console.error('Error name:', error.name);
          if (error.errors) {
              console.error('Error details:', JSON.stringify(error.errors, null, 2));
          }
          if (error.response) {
              console.error('Error response:', JSON.stringify(error.response, null, 2));
          }
          console.error('Full error:', error);
          console.error('==========================================');

          res.status(500).json({
              error: error.message || 'Failed to execute query',
              details: error.toString(),
              code: error.code
          })
      }
  })

  // BigQuery dry run endpoint - estimate query cost
  router.post('/api/bigquery/estimate', async (req, res) => {
      try {
          const { query, analysisType } = req.body

          if (!query) {
              return res.status(400).json({ error: 'Query is required' })
          }

          if (!bigquery) {
              return res.status(500).json({
                  error: 'BigQuery client not initialized',
                  details: 'Check server logs for initialization errors'
              })
          }

          // Dry run to get query statistics without executing
          // Get NAV ident from authenticated user for audit logging
          const navIdent = req.user?.navIdent || 'UNKNOWN';

          const [job] = await bigquery.createQueryJob(addAuditLogging({
              query: query,
              location: 'europe-north1',
              dryRun: true
          }, navIdent, analysisType || 'Sqlverktoy'));

          const stats = job.metadata.statistics;
          const totalBytesProcessed = parseInt(stats.totalBytesProcessed || 0);
          const totalBytesBilled = parseInt(stats.query?.totalBytesBilled || totalBytesProcessed);

          // BigQuery pricing: $6.25 per TB (as of 2024)
          // First 1 TB per month is free
          const costPerTB = 6.25;
          const bytesPerTB = 1024 * 1024 * 1024 * 1024;
          const estimatedCostUSD = (totalBytesBilled / bytesPerTB) * costPerTB;

          res.json({
              success: true,
              totalBytesProcessed: totalBytesProcessed,
              totalBytesBilled: totalBytesBilled,
              totalBytesProcessedMB: (totalBytesProcessed / (1024 * 1024)).toFixed(2),
              totalBytesProcessedGB: (totalBytesProcessed / (1024 * 1024 * 1024)).toFixed(1),
              estimatedCostUSD: estimatedCostUSD.toFixed(3),
              cacheHit: stats.query?.cacheHit || false,
          })
      } catch (error) {
          console.error('BigQuery estimate error:', error)
          res.status(500).json({
              error: error.message || 'Failed to estimate query',
              details: error.toString()
          })
      }
  })

  return router;
}

