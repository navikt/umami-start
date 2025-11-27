import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { BigQuery } from '@google-cloud/bigquery'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});


// Set server timeout to 2 minutes for BigQuery queries
app.use((req, res, next) => {
    req.setTimeout(120000) // 2 minutes
    res.setTimeout(120000) // 2 minutes
    next()
})

// Initialize BigQuery client
let bigquery;
try {
    const bqConfig = {
        projectId: 'team-researchops-prod-01d6',
    };

    // Priority order:
    // 1. GCP secret (bigquery-credentials from NAIS)
    // 2. Service account key file path from env (GOOGLE_APPLICATION_CREDENTIALS)
    // 3. Service account JSON from env (UMAMI_BIGQUERY)
    // 4. Local service account key file (./service-account-key.json)

    if (process.env['bigquery-credentials']) {
        try {
            bqConfig.credentials = JSON.parse(process.env['bigquery-credentials']);
            console.log('✓ Using credentials from bigquery-credentials secret (NAIS)');
        } catch (e) {
            console.error('✗ Failed to parse bigquery-credentials:', e.message);
        }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('✓ Using service account from GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        bqConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else if (process.env.UMAMI_BIGQUERY) {
        try {
            bqConfig.credentials = JSON.parse(process.env.UMAMI_BIGQUERY);
            console.log('✓ Using credentials from UMAMI_BIGQUERY env variable');
        } catch (e) {
            console.error('✗ Failed to parse UMAMI_BIGQUERY:', e.message);
        }
    } else {
        // Try local service account key file
        const localKeyPath = path.join(__dirname, 'service-account-key.json');
        console.log('✓ Using local service account key file:', localKeyPath);
        bqConfig.keyFilename = localKeyPath;
    }

    console.log('Creating BigQuery client with config:', {
        projectId: bqConfig.projectId,
        hasCredentials: !!bqConfig.credentials,
        hasKeyFilename: !!bqConfig.keyFilename
    });

    bigquery = new BigQuery(bqConfig);

    console.log('✓ BigQuery client initialized successfully');
    console.log('==========================================');
} catch (error) {
    console.error('==========================================');
    console.error('✗ FAILED TO INITIALIZE BIGQUERY CLIENT');
    console.error('==========================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    if (error.code) console.error('Error Code:', error.code);
    if (error.errors) console.error('Error Details:', JSON.stringify(error.errors, null, 2));
    console.error('==========================================');
}

const buildPath = path.join(path.resolve(__dirname, './dist'))

app.use('/', express.static(buildPath, { index: false }))

app.use('/robots.txt', function (req, res, next) {
    res.type('text/plain')
    res.send("User-agent: *\nAllow: /");
});

app.get('/isalive', (req, res) => {
    res.send('OK')
})

app.get('/isready', (req, res) => {
    res.send('OK')
})

// BigQuery API endpoint
app.post('/api/bigquery', async (req, res) => {
    try {
        const { query } = req.body

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

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
        })

        console.log('[BigQuery API] Query job created, waiting for results...');

        const [rows] = await job.getQueryResults()

        console.log('[BigQuery API] Query successful, returned', rows.length, 'rows');

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                dryRun: true
            });

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

// Get events for a website from BigQuery
app.get('/api/bigquery/websites/:websiteId/events', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt, urlPath } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        const params = {
            websiteId: websiteId,
            startDate: startDate,
            endDate: endDate
        };

        let urlFilter = '';
        if (urlPath) {
            urlFilter = `AND (
                url_path = @urlPath 
                OR url_path = @urlPathSlash 
                OR url_path LIKE @urlPathQuery
            )`;
            params.urlPath = urlPath;
            params.urlPathSlash = urlPath.endsWith('/') ? urlPath : urlPath + '/';
            params.urlPathQuery = urlPath + '?%';
        }

        const query = `
            SELECT event_name, COUNT(*) as count
            FROM \`team-researchops-prod-01d6.umami.public_website_event\`
            WHERE website_id = @websiteId
              AND created_at BETWEEN @startDate AND @endDate
              AND event_name IS NOT NULL
            ${urlFilter}
            GROUP BY event_name
            ORDER BY count DESC
        `;

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();
        const events = rows.map(row => ({
            name: row.event_name,
            count: parseInt(row.count)
        }));

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

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
            console.log('[Events] Dry run failed:', dryRunError.message);
        }

        res.json({ events, queryStats });
    } catch (error) {
        console.error('BigQuery events error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch events'
        });
    }
});

// Get event properties/parameters for a website from BigQuery
app.get('/api/bigquery/websites/:websiteId/event-properties', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt, includeParams, eventName, urlPath } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();
        const withParams = includeParams === 'true';

        console.log(`[Event Properties] Query: ${withParams ? 'EXPENSIVE (with params)' : 'CHEAP (events only)'} - includeParams=${includeParams} eventName=${eventName} urlPath=${urlPath}`);

        const params = {
            websiteId: websiteId,
            startDate: startDate,
            endDate: endDate
        };

        let urlFilter = '';
        if (urlPath) {
            urlFilter = `AND (
                e.url_path = @urlPath 
                OR e.url_path = @urlPathSlash 
                OR e.url_path LIKE @urlPathQuery
            )`;
            params.urlPath = urlPath;
            params.urlPathSlash = urlPath.endsWith('/') ? urlPath : urlPath + '/';
            params.urlPathQuery = urlPath + '?%';
        }

        let eventFilter = '';
        if (eventName) {
            eventFilter = `AND e.event_name = @eventName`;
            params.eventName = eventName;
        }

        // Query depends on whether we need parameters or not
        const query = withParams ? `
            SELECT
                e.event_name,
                p.data_key,
                COUNT(*) AS total,
                p.data_type,
                CASE
                    WHEN p.data_type = 1 THEN 'number'
                    WHEN p.data_type = 2 THEN 'string'
                    WHEN p.data_type = 3 THEN 'boolean'
                    WHEN p.data_type = 4 THEN 'date'
                    ELSE 'string'
                END AS type
            FROM \`team-researchops-prod-01d6.umami.public_website_event\` e
            JOIN \`team-researchops-prod-01d6.umami_views.event_data\` d
                ON e.event_id = d.website_event_id
            CROSS JOIN UNNEST(d.event_parameters) AS p
            WHERE e.website_id = @websiteId
            AND e.created_at BETWEEN @startDate AND @endDate
            AND d.created_at BETWEEN @startDate AND @endDate
            AND e.event_name IS NOT NULL
            AND p.data_key IS NOT NULL
            ${urlFilter}
            ${eventFilter}
            GROUP BY
                e.event_name,
                p.data_key,
                p.data_type
            ORDER BY
                e.event_name,
                p.data_key
        ` : `
            SELECT 
                event_name,
                COUNT(*) AS total
            FROM \`team-researchops-prod-01d6.umami.public_website_event\` e
            WHERE website_id = @websiteId
            AND created_at BETWEEN @startDate AND @endDate
            AND event_name IS NOT NULL
            ${urlFilter}
            ${eventFilter}
            GROUP BY event_name
            ORDER BY event_name
        `;

        // Dry run to estimate bytes processed
        let estimatedBytes = '0';
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

            const dryRunMetadata = dryRunJob.metadata;
            estimatedBytes = dryRunMetadata.statistics?.totalBytesProcessed || '0';
            const estimatedGb = (Number(estimatedBytes) / (1024 ** 3)).toFixed(2);
            console.log(`[Event Properties] Estimated bytes: ${estimatedGb} GB`);
        } catch (dryRunError) {
            console.warn('[Event Properties] Dry run failed:', dryRunError.message);
        }

        // Actual query execution
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        // Get job statistics for bytes processed from metadata
        const [metadata] = await job.getMetadata();
        const bytesProcessed = metadata.statistics?.totalBytesProcessed || estimatedBytes;
        const gbProcessed = (Number(bytesProcessed) / (1024 ** 3)).toFixed(2);

        // Format the response based on query type
        const properties = withParams
            ? rows.map(row => ({
                eventName: row.event_name,
                propertyName: row.data_key,
                total: parseInt(row.total),
                type: row.type
            }))
            : rows.map(row => ({
                eventName: row.event_name,
                propertyName: null, // No parameters in simple query
                total: parseInt(row.total),
                type: 'string'
            }));

        res.json({
            properties,
            gbProcessed,
            estimatedGbProcessed: (Number(estimatedBytes) / (1024 ** 3)).toFixed(2),
            includeParams: withParams
        });
    } catch (error) {
        console.error('BigQuery event properties error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch event properties'
        });
    }
});

// Get event series data (time series)
app.get('/api/bigquery/websites/:websiteId/event-series', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt, eventName, urlPath, interval = 'day' } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        const params = {
            websiteId: websiteId,
            startDate: startDate,
            endDate: endDate
        };

        let urlFilter = '';
        if (urlPath) {
            urlFilter = `AND (
                url_path = @urlPath 
                OR url_path = @urlPathSlash 
                OR url_path LIKE @urlPathQuery
            )`;
            params.urlPath = urlPath;
            params.urlPathSlash = urlPath.endsWith('/') ? urlPath : urlPath + '/';
            params.urlPathQuery = urlPath + '?%';
        }

        let eventFilter = '';
        if (eventName) {
            eventFilter = `AND event_name = @eventName`;
            params.eventName = eventName;
        }

        // Determine time truncation based on interval
        let timeTrunc = 'DAY';
        if (interval === 'hour') timeTrunc = 'HOUR';
        if (interval === 'week') timeTrunc = 'WEEK';
        if (interval === 'month') timeTrunc = 'MONTH';

        const query = `
            SELECT
                TIMESTAMP_TRUNC(created_at, ${timeTrunc}) as time,
                COUNT(*) as count
            FROM \`team-researchops-prod-01d6.umami.public_website_event\`
            WHERE website_id = @websiteId
            AND created_at BETWEEN @startDate AND @endDate
            AND event_name IS NOT NULL
            ${urlFilter}
            ${eventFilter}
            GROUP BY 1
            ORDER BY 1
        `;

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        const data = rows.map(row => ({
            time: row.time.value,
            count: parseInt(row.count)
        }));

        res.json({ data });
    } catch (error) {
        console.error('BigQuery event series error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch event series'
        });
    }
});

// Get date range for a website from BigQuery
app.get('/api/bigquery/websites/:websiteId/daterange', async (req, res) => {
    try {
        const { websiteId } = req.params;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const query = `
            SELECT 
                MIN(created_at) as mindate,
                MAX(created_at) as maxdate
            FROM \`team-researchops-prod-01d6.umami.public_website_event\`
            WHERE website_id = @websiteId
        `;

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: {
                websiteId: websiteId
            }
        });

        const [rows] = await job.getQueryResults();

        if (rows.length > 0 && rows[0].mindate) {
            res.json({
                mindate: rows[0].mindate.value,
                maxdate: rows[0].maxdate.value
            });
        } else {
            res.json({
                mindate: null,
                maxdate: null
            });
        }
    } catch (error) {
        console.error('BigQuery daterange error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch date range'
        });
    }
});

// Get values for a specific event parameter
app.get('/api/bigquery/websites/:websiteId/event-parameter-values', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt, eventName, parameterName, urlPath } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        const params = {
            websiteId,
            startDate,
            endDate,
            eventName,
            parameterName
        };

        let urlFilter = '';
        if (urlPath) {
            urlFilter = `AND (
                e.url_path = @urlPath 
                OR e.url_path = @urlPathSlash 
                OR e.url_path LIKE @urlPathQuery
            )`;
            params.urlPath = urlPath;
            params.urlPathSlash = urlPath.endsWith('/') ? urlPath : urlPath + '/';
            params.urlPathQuery = urlPath + '?%';
        }

        const query = `
            SELECT
                p.string_value,
                COUNT(*) as count
            FROM \`team-researchops-prod-01d6.umami.public_website_event\` e
            JOIN \`team-researchops-prod-01d6.umami_views.event_data\` d
                ON e.event_id = d.website_event_id
            CROSS JOIN UNNEST(d.event_parameters) AS p
            WHERE e.website_id = @websiteId
            AND e.created_at BETWEEN @startDate AND @endDate
            AND d.created_at BETWEEN @startDate AND @endDate
            AND e.event_name = @eventName
            AND p.data_key = @parameterName
            ${urlFilter}
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 100
        `;

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        const values = rows.map(row => ({
            value: row.string_value,
            count: parseInt(row.count)
        }));

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

            const stats = dryRunJob.metadata.statistics;
            const bytesProcessed = parseInt(stats.totalBytesProcessed);
            const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
            const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

            queryStats = {
                totalBytesProcessedGB: gbProcessed,
                estimatedCostUSD: estimatedCostUSD
            };
        } catch (dryRunError) {
            console.log('[Event Parameter Values] Dry run failed:', dryRunError.message);
        }

        res.json({ values, queryStats });
    } catch (error) {
        console.error('BigQuery event parameter values error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch event parameter values'
        });
    }
});

// Get latest N events with all parameter values
app.get('/api/bigquery/websites/:websiteId/event-latest', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt, eventName, urlPath, limit = '20' } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        const params = {
            websiteId,
            startDate,
            endDate,
            eventName,
            limit: parseInt(limit)
        };

        let urlFilter = '';
        if (urlPath) {
            urlFilter = `AND (
                e.url_path = @urlPath 
                OR e.url_path = @urlPathSlash 
                OR e.url_path LIKE @urlPathQuery
            )`;
            params.urlPath = urlPath;
            params.urlPathSlash = urlPath.endsWith('/') ? urlPath : urlPath + '/';
            params.urlPathQuery = urlPath + '?%';
        }

        const query = `
            SELECT
                e.event_id,
                e.created_at,
                ARRAY_AGG(STRUCT(p.data_key, p.string_value) ORDER BY p.data_key) as parameters
            FROM \`team-researchops-prod-01d6.umami.public_website_event\` e
            JOIN \`team-researchops-prod-01d6.umami_views.event_data\` d
                ON e.event_id = d.website_event_id
            LEFT JOIN UNNEST(d.event_parameters) AS p
            WHERE e.website_id = @websiteId
            AND e.created_at BETWEEN @startDate AND @endDate
            AND d.created_at BETWEEN @startDate AND @endDate
            AND e.event_name = @eventName
            ${urlFilter}
            GROUP BY e.event_id, e.created_at
            ORDER BY e.created_at DESC
            LIMIT @limit
        `;

        console.log('[Latest Events] Query params:', params);
        console.log('[Latest Events] URL filter:', urlFilter);

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        console.log(`[Latest Events] Found ${rows.length} events`);
        if (rows.length > 0) {
            console.log('[Latest Events] First row sample:', JSON.stringify(rows[0], null, 2));
        }

        const events = rows.map(row => {
            const properties = {};
            if (row.parameters) {
                row.parameters.forEach(param => {
                    if (param.data_key && param.string_value) {
                        properties[param.data_key] = param.string_value;
                    }
                });
            }

            return {
                website_event_id: row.event_id,
                created_at: row.created_at.value,
                properties
            };
        });

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

            const stats = dryRunJob.metadata.statistics;
            const bytesProcessed = parseInt(stats.totalBytesProcessed);
            const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
            const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

            queryStats = {
                totalBytesProcessedGB: gbProcessed,
                estimatedCostUSD: estimatedCostUSD
            };
        } catch (dryRunError) {
            console.log('[Latest Events] Dry run failed:', dryRunError.message);
        }

        console.log(`[Latest Events] Returning ${events.length} events`);
        res.json({ events, queryStats });
    } catch (error) {
        console.error('BigQuery latest events error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch latest events'
        });
    }
});

// Get traffic series data (visits over time)
app.get('/api/bigquery/websites/:websiteId/traffic-series', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt, urlPath, interval = 'day', metricType = 'visits' } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        const params = {
            websiteId: websiteId,
            startDate: startDate,
            endDate: endDate
        };

        let urlFilter = '';
        if (urlPath) {
            urlFilter = `AND (
                url_path = @urlPath 
                OR url_path = @urlPathSlash 
                OR url_path LIKE @urlPathQuery
            )`;
            params.urlPath = urlPath;
            params.urlPathSlash = urlPath.endsWith('/') ? urlPath : urlPath + '/';
            params.urlPathQuery = urlPath + '?%';
        }

        // Determine time truncation based on interval
        let timeTrunc = 'DAY';
        if (interval === 'hour') timeTrunc = 'HOUR';
        if (interval === 'week') timeTrunc = 'WEEK';
        if (interval === 'month') timeTrunc = 'MONTH';
        // Choose aggregation based on metric type
        const countExpression = metricType === 'pageviews'
            ? 'COUNT(*)'
            : 'APPROX_COUNT_DISTINCT(session_id)'; // visitors

        const query = `
            SELECT
                TIMESTAMP_TRUNC(created_at, ${timeTrunc}) as time,
                ${countExpression} as count
            FROM \`team-researchops-prod-01d6.umami_views.event\`
            WHERE website_id = @websiteId
            AND created_at BETWEEN @startDate AND @endDate
            AND event_type = 1 -- Pageview
            ${urlFilter}
            GROUP BY 1
            ORDER BY 1
        `;

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        const data = rows.map(row => ({
            time: row.time.value,
            count: parseInt(row.count)
        }));

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

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
            console.log('[Traffic Series] Dry run failed:', dryRunError.message);
        }

        res.json({ data, queryStats });
    } catch (error) {
        console.error('BigQuery traffic series error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch traffic series'
        });
    }
});

// Get traffic flow data (Source -> Landing -> Next)
app.get('/api/bigquery/websites/:websiteId/traffic-flow', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt, limit = '50', metricType = 'visits' } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        let query;
        const params = {
            websiteId: websiteId,
            startDate: startDate,
            endDate: endDate,
            limit: parseInt(limit)
        };

        // Choose aggregation based on metric type
        const countExpression = metricType === 'pageviews'
            ? 'COUNT(*)'
            : 'APPROX_COUNT_DISTINCT(session_id)'; // visitors

        if (req.query.urlPath) {
            // Page-centric flow: Source -> Specific Page -> Next
            params.urlPath = req.query.urlPath;
            query = `
                WITH session_events AS (
                    SELECT
                        session_id,
                        referrer_domain,
                        CASE 
                            WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                            THEN '/'
                            ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
                        END as url_path,
                        created_at
                    FROM \`team-researchops-prod-01d6.umami_views.event\`
                    WHERE website_id = @websiteId
                      AND created_at BETWEEN @startDate AND @endDate
                      AND event_type = 1 -- Pageview
                ),
                events_with_context AS (
                    SELECT
                        session_id,
                        url_path,
                        referrer_domain,
                        LAG(url_path) OVER (PARTITION BY session_id ORDER BY created_at) as prev_page,
                        LEAD(url_path) OVER (PARTITION BY session_id ORDER BY created_at) as next_page
                    FROM session_events
                )
                SELECT
                    CASE
                        WHEN prev_page IS NOT NULL THEN prev_page
                        ELSE COALESCE(referrer_domain, 'Direkte / Annet')
                    END as source,
                    url_path as landing_page, -- Using 'landing_page' alias to match frontend expectation (it's the center node)
                    COALESCE(next_page, 'Exit') as next_page,
                    ${metricType === 'pageviews' ? 'COUNT(*)' : 'APPROX_COUNT_DISTINCT(session_id)'} as count
                FROM events_with_context
                WHERE url_path = @urlPath
                GROUP BY 1, 2, 3
                ORDER BY 4 DESC
                LIMIT @limit
            `;
        } else {
            // Default: Landing Page Flow (Source -> Landing Page -> Next)
            query = `
                WITH session_events AS (
                    SELECT
                        session_id,
                        referrer_domain,
                        CASE 
                            WHEN RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/') = ''
                            THEN '/'
                            ELSE RTRIM(REGEXP_REPLACE(REGEXP_REPLACE(url_path, r'[?#].*', ''), r'//+', '/'), '/')
                        END as url_path,
                        created_at,
                        ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) as rn
                    FROM \`team-researchops-prod-01d6.umami_views.event\`
                    WHERE website_id = @websiteId
                      AND created_at BETWEEN @startDate AND @endDate
                      AND event_type = 1 -- Pageview
                ),
                session_starts AS (
                    SELECT
                        session_id,
                        referrer_domain,
                        url_path as landing_page,
                        created_at
                    FROM session_events
                    WHERE rn = 1
                ),
                second_pages AS (
                    SELECT
                        session_id,
                        url_path as second_page
                    FROM session_events
                    WHERE rn = 2
                )
                SELECT
                    COALESCE(s.referrer_domain, 'Direkte / Annet') as source,
                    s.landing_page,
                    COALESCE(sp.second_page, 'Exit') as next_page,
                    ${metricType === 'pageviews' ? 'COUNT(*)' : 'APPROX_COUNT_DISTINCT(s.session_id)'} as count
                FROM session_starts s
                LEFT JOIN second_pages sp ON s.session_id = sp.session_id
                GROUP BY 1, 2, 3
                ORDER BY 4 DESC
                LIMIT @limit
            `;
        }

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        const data = rows.map(row => ({
            source: row.source,
            landingPage: row.landing_page,
            nextPage: row.next_page,
            count: parseInt(row.count)
        }));

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

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
            console.log('[Traffic Flow] Dry run failed:', dryRunError.message);
        }

        res.json({ data, queryStats });
    } catch (error) {
        console.error('BigQuery traffic flow error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch traffic flow'
        });
    }
});

// Get websites from BigQuery
app.get('/api/bigquery/websites', async (req, res) => {
    try {
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
            FROM \`team-researchops-prod-01d6.umami.public_website\`
            WHERE deleted_at IS NULL
              AND name IS NOT NULL
            GROUP BY website_id
            ORDER BY name
        `;

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1'
        });

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
app.post('/api/bigquery/journeys', async (req, res) => {
    try {
        const { websiteId, startUrl, startDate, endDate, steps = 3, limit = 30, direction = 'forward' } = req.body;

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
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
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

        const [job] = await bigquery.createQueryJob({
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
        });

        // Get cost estimate
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
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
            });

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
            const [dryRunJob] = await bigquery.createQueryJob({
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
            });

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

// BigQuery dry run endpoint - estimate query cost
app.post('/api/bigquery/estimate', async (req, res) => {
    try {
        const { query } = req.body

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
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            dryRun: true,
        })

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

// Get funnel data from BigQuery
app.post('/api/bigquery/funnel', async (req, res) => {
    try {
        const { websiteId, urls, startDate, endDate, onlyDirectEntry = true } = req.body;

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

        // 1. Base events CTE with LAG for strict mode
        let query = `
            WITH events_raw AS (
                SELECT 
                    session_id,
                    ${normalizeUrlSql} as url_path,
                    created_at
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
                WHERE website_id = @websiteId
                  AND created_at BETWEEN @startDate AND @endDate
                  AND event_type = 1 -- Pageview
            ),
            events AS (
                SELECT 
                    *,
                    LAG(url_path) OVER (PARTITION BY session_id ORDER BY created_at) as prev_url_path
                FROM events_raw
            ),
        `;

        // 2. Generate CTEs for each step
        const stepCtes = urls.map((url, index) => {
            const stepName = `step${index + 1}`;
            const prevStepName = `step${index}`;

            if (index === 0) {
                // Step 1: Always any visit to the first URL
                return `
            ${stepName} AS (
                SELECT session_id, MIN(created_at) as time${index + 1}
                FROM events
                WHERE url_path = @url${index}
                GROUP BY session_id
            )`;
            } else {
                if (onlyDirectEntry) {
                    // Strict mode: Current URL must be visited immediately after Previous URL
                    // We join on session_id and ensure the current event's prev_url_path matches the previous step's URL
                    return `
            ${stepName} AS (
                SELECT e.session_id, MIN(e.created_at) as time${index + 1}
                FROM events e
                JOIN ${prevStepName} prev ON e.session_id = prev.session_id
                WHERE e.url_path = @url${index} 
                  AND e.created_at > prev.time${index}
                  AND e.prev_url_path = @url${index - 1} -- Strict check: Immediate predecessor
                GROUP BY e.session_id
            )`;
                } else {
                    // Loose mode: Eventual visit (standard funnel)
                    return `
            ${stepName} AS (
                SELECT e.session_id, MIN(e.created_at) as time${index + 1}
                FROM events e
                JOIN ${prevStepName} prev ON e.session_id = prev.session_id
                WHERE e.url_path = @url${index} 
                  AND e.created_at > prev.time${index}
                GROUP BY e.session_id
            )`;
                }
            }
        });

        query += stepCtes.join(',') + `
            SELECT 
                ${urls.map((_, i) => `(SELECT COUNT(*) FROM step${i + 1}) as step${i + 1}_count`).join(',\n                ')}
        `;

        // Create params object
        const params = {
            websiteId,
            startDate,
            endDate
        };

        urls.forEach((url, index) => {
            params[`url${index}`] = url;
        });

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

            const stats = dryRunJob.metadata.statistics;
            const bytesProcessed = parseInt(stats.totalBytesProcessed);
            const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
            const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

            queryStats = {
                totalBytesProcessedGB: gbProcessed,
                estimatedCostUSD: estimatedCostUSD
            };

            console.log(`[Funnel] Dry run - Processing ${gbProcessed} GB, estimated cost: $${estimatedCostUSD}`);
        } catch (dryRunError) {
            console.log('[Funnel] Dry run failed:', dryRunError.message);
        }

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        if (rows.length === 0) {
            return res.json({ data: [] });
        }

        const row = rows[0];

        // Format for frontend
        const funnelData = urls.map((url, index) => ({
            step: index,
            url: url,
            count: parseInt(row[`step${index + 1}_count`] || 0)
        }));

        res.json({
            data: funnelData,
            queryStats
        });

    } catch (error) {
        console.error('BigQuery funnel error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch funnel data'
        });
    }
});

// Get funnel timing data from BigQuery (average time per step)
app.post('/api/bigquery/funnel-timing', async (req, res) => {
    try {
        const { websiteId, urls, startDate, endDate, onlyDirectEntry = true } = req.body;

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

        // 1. Base events CTE with LAG for strict mode
        let query = `
            WITH events_raw AS (
                SELECT 
                    session_id,
                    ${normalizeUrlSql} as url_path,
                    created_at
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
                WHERE website_id = @websiteId
                  AND created_at BETWEEN @startDate AND @endDate
                  AND event_type = 1 -- Pageview
            ),
            events AS (
                SELECT 
                    *,
                    LAG(url_path) OVER (PARTITION BY session_id ORDER BY created_at) as prev_url_path
                FROM events_raw
            ),
        `;

        // 2. Generate CTEs for each step with timing
        const stepCtes = urls.map((url, index) => {
            const stepName = `step${index + 1}`;
            const prevStepName = `step${index}`;

            if (index === 0) {
                // Step 1: Always any visit to the first URL
                return `
            ${stepName} AS (
                SELECT session_id, MIN(created_at) as time${index + 1}
                FROM events
                WHERE url_path = @url${index}
                GROUP BY session_id
            )`;
            } else {
                if (onlyDirectEntry) {
                    // Strict mode: Current URL must be visited immediately after Previous URL
                    return `
            ${stepName} AS (
                SELECT e.session_id, MIN(e.created_at) as time${index + 1}
                FROM events e
                JOIN ${prevStepName} prev ON e.session_id = prev.session_id
                WHERE e.url_path = @url${index} 
                  AND e.created_at > prev.time${index}
                  AND e.prev_url_path = @url${index - 1} -- Strict check: Immediate predecessor
                GROUP BY e.session_id
            )`;
                } else {
                    // Loose mode: Eventual visit (standard funnel)
                    return `
            ${stepName} AS (
                SELECT e.session_id, MIN(e.created_at) as time${index + 1}
                FROM events e
                JOIN ${prevStepName} prev ON e.session_id = prev.session_id
                WHERE e.url_path = @url${index} 
                  AND e.created_at > prev.time${index}
                GROUP BY e.session_id
            )`;
                }
            }
        });

        // 3. Build the timing query - join all steps and calculate time differences
        const joinClauses = urls.map((_, i) => {
            if (i === 0) return 'step1';
            return `LEFT JOIN step${i + 1} ON step1.session_id = step${i + 1}.session_id`;
        }).join('\n            ');

        // Create column aliases for the timing_data CTE
        const timeColumns = urls.map((_, i) => `step${i + 1}.time${i + 1} as time${i + 1}`).join(',\n                    ');

        // First, create a CTE with individual time differences per session
        const timeDiffColumns = urls.map((_, i) => {
            if (i === 0) return null;
            return `TIMESTAMP_DIFF(time${i + 1}, time${i}, SECOND) as diff_${i}_to_${i + 1}`;
        }).filter(Boolean).join(',\n                    ');

        // Then calculate both average and median for each time difference
        const aggregateSelects = urls.map((_, i) => {
            if (i === 0) return null;
            return `
                AVG(diff_${i}_to_${i + 1}) as avg_seconds_${i}_to_${i + 1},
                APPROX_QUANTILES(diff_${i}_to_${i + 1}, 2)[OFFSET(1)] as median_seconds_${i}_to_${i + 1}`;
        }).filter(Boolean);

        query += stepCtes.join(',') + `,
            timing_data AS (
                SELECT
                    ${timeColumns}
                FROM ${joinClauses}
            ),
            time_diffs AS (
                SELECT
                    ${timeDiffColumns}
                FROM timing_data
                WHERE ${urls.map((_, i) => {
            if (i === 0) return null;
            return `time${i} IS NOT NULL AND time${i + 1} IS NOT NULL`;
        }).filter(Boolean).join(' AND ')}
            )
            SELECT 
                ${aggregateSelects.join(',\n                ')}
            FROM time_diffs
        `;

        console.log('[Funnel Timing] Generated SQL query:', query);


        // Create params object
        const params = {
            websiteId,
            startDate,
            endDate
        };

        urls.forEach((url, index) => {
            params[`url${index}`] = url;
        });

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

            const stats = dryRunJob.metadata.statistics;
            const bytesProcessed = parseInt(stats.totalBytesProcessed);
            const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(1);
            const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(3);

            queryStats = {
                totalBytesProcessedGB: gbProcessed,
                estimatedCostUSD: estimatedCostUSD
            };

            console.log(`[Funnel Timing] Dry run - Processing ${gbProcessed} GB, estimated cost: $${estimatedCostUSD}`);
        } catch (dryRunError) {
            console.log('[Funnel Timing] Dry run failed:', dryRunError.message);
        }

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        if (rows.length === 0) {
            return res.json({ data: [], queryStats });
        }

        const row = rows[0];

        // Format timing data for frontend
        const timingData = [];
        for (let i = 0; i < urls.length - 1; i++) {
            const avgSeconds = row[`avg_seconds_${i}_to_${i + 1}`];
            const medianSeconds = row[`median_seconds_${i}_to_${i + 1}`];
            timingData.push({
                fromStep: i,
                toStep: i + 1,
                fromUrl: urls[i],
                toUrl: urls[i + 1],
                avgSeconds: avgSeconds ? Math.round(parseFloat(avgSeconds)) : null,
                medianSeconds: medianSeconds ? Math.round(parseFloat(medianSeconds)) : null
            });
        }

        res.json({
            data: timingData,
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
app.post('/api/bigquery/retention', async (req, res) => {
    try {
        const { websiteId, startDate, endDate, urlPath, businessDaysOnly } = req.body;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        // Calculate the maximum days for retention based on the date range
        // This represents the maximum number of days someone from the earliest cohort
        // could have retention data (e.g., if month starts Nov 1 and today is Nov 22, maxDays = 21)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const maxDays = Math.max(daysDiff, 31); // Allow up to 31 days for full month retention

        // Optimized query that normalizes URLs once and avoids expensive EXISTS clauses
        const query = `
            WITH base AS (
                -- Pre-normalize URL once (no regex in joins later)
                SELECT
                    session_id,
                    DATE(created_at) AS event_date,
                    created_at,
                    -- lightweight URL normalization
                    IFNULL(
                        NULLIF(
                            RTRIM(
                                REGEXP_REPLACE(
                                    REGEXP_REPLACE(url_path, r'[?#].*', ''), -- strip query/fragments
                                    r'//+', '/'),                             -- collapse slashes
                                '/'),
                            ''),
                        '/') AS url_path_clean
                FROM \`team-researchops-prod-01d6.umami.public_website_event\`
                WHERE website_id = @websiteId
                    AND created_at BETWEEN @startDate AND @endDate
            ),
            ${urlPath ? `
            filtered_sessions AS (
                -- Only keep session-days where the specified URL occurred
                SELECT DISTINCT
                    session_id,
                    event_date AS first_seen_date
                FROM base
                WHERE url_path_clean = @urlPath
            ),
            ` : `
            filtered_sessions AS (
                -- Get first seen date for each session
                SELECT
                    session_id,
                    MIN(event_date) AS first_seen_date
                FROM base
                GROUP BY session_id
            ),
            `}
            user_activity AS (
                SELECT DISTINCT
                    session_id,
                    event_date AS activity_date
                FROM base
                ${businessDaysOnly ? `WHERE EXTRACT(DAYOFWEEK FROM event_date) NOT IN (1, 7)` : ''}
            ),
            retention_base AS (
                SELECT
                    f.session_id,
                    f.first_seen_date,
                    a.activity_date,
                    DATE_DIFF(a.activity_date, f.first_seen_date, DAY) AS day_diff
                FROM filtered_sessions f
                JOIN user_activity a
                    USING (session_id)
                WHERE DATE_DIFF(a.activity_date, f.first_seen_date, DAY) >= 0
            ),
            retention_counts AS (
                SELECT
                    day_diff,
                    COUNT(DISTINCT session_id) AS returning_users
                FROM retention_base
                WHERE day_diff <= @maxDays
                GROUP BY day_diff
            ),
            user_counts AS (
                SELECT COUNT(DISTINCT session_id) AS total_users
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

        if (urlPath) {
            params.urlPath = urlPath;
        }

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

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

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

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
app.post('/api/bigquery/composition', async (req, res) => {
    try {
        const { websiteId, startDate, endDate, urlPath } = req.body;

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
                    s.country
                FROM \`team-researchops-prod-01d6.umami.public_session\` s
                WHERE s.website_id = @websiteId
                  AND s.created_at BETWEEN @startDate AND @endDate
                  ${urlPath ? `
                  AND EXISTS (
                    SELECT 1 
                    FROM \`team-researchops-prod-01d6.umami.public_website_event\` e 
                    WHERE e.session_id = s.session_id 
                      AND e.website_id = @websiteId
                      AND e.created_at BETWEEN @startDate AND @endDate
                      AND ${normalizeUrlSql.replace(/url_path/g, 'e.url_path')} = @urlPath
                  )` : ''}
            )
            SELECT 'browser' as category, browser as value, COUNT(*) as count FROM relevant_sessions GROUP BY 1, 2
            UNION ALL
            SELECT 'os' as category, os as value, COUNT(*) as count FROM relevant_sessions GROUP BY 1, 2
            UNION ALL
            SELECT 'device' as category, device as value, COUNT(*) as count FROM relevant_sessions GROUP BY 1, 2
            UNION ALL
            SELECT 'screen' as category, screen as value, COUNT(*) as count FROM relevant_sessions GROUP BY 1, 2
            UNION ALL
            SELECT 'language' as category, language as value, COUNT(*) as count FROM relevant_sessions GROUP BY 1, 2
            UNION ALL
            SELECT 'country' as category, country as value, COUNT(*) as count FROM relevant_sessions GROUP BY 1, 2
            ORDER BY category, count DESC
        `;

        const params = {
            websiteId,
            startDate,
            endDate
        };

        if (urlPath) {
            params.urlPath = urlPath;
        }

        // Get dry run stats
        let queryStats = null;
        try {
            const [dryRunJob] = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: params,
                dryRun: true
            });

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

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: params
        });

        const [rows] = await job.getQueryResults();

        res.json({
            data: rows,
            queryStats
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

app.use(/^(?!.*\/(internal|static)\/).*$/, (req, res) => res.sendFile(`${buildPath}/index.html`))

const server = app.listen(8080, () => {
    console.log('Listening on port 8080')
    console.log('Server timeout set to 2 minutes')
})

// Set server timeout to 2 minutes
server.timeout = 120000
server.keepAliveTimeout = 125000 // Slightly longer than timeout
server.headersTimeout = 130000 // Slightly longer than keepAliveTimeout