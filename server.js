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
            console.log('Using credentials from bigquery-credentials secret (NAIS)');
        } catch (e) {
            console.error('Failed to parse bigquery-credentials:', e.message);
        }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('Using service account from GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        bqConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else if (process.env.UMAMI_BIGQUERY) {
        try {
            bqConfig.credentials = JSON.parse(process.env.UMAMI_BIGQUERY);
            console.log('Using credentials from UMAMI_BIGQUERY env variable');
        } catch (e) {
            console.error('Failed to parse UMAMI_BIGQUERY:', e.message);
        }
    } else {
        // Try local service account key file
        const localKeyPath = path.join(__dirname, 'service-account-key.json');
        console.log('Attempting to use local service account key file:', localKeyPath);
        bqConfig.keyFilename = localKeyPath;
    }

    bigquery = new BigQuery(bqConfig);
} catch (error) {
    console.error('Failed to initialize BigQuery client:', error);
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

        if (!query) {
            return res.status(400).json({ error: 'Query is required' })
        }

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized',
                details: 'Check server logs for initialization errors'
            })
        }

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
        })

        const [rows] = await job.getQueryResults()

        res.json({
            success: true,
            data: rows,
            rowCount: rows.length
        })
    } catch (error) {
        console.error('BigQuery error:', error)
        res.status(500).json({
            error: error.message || 'Failed to execute query',
            details: error.toString()
        })
    }
})

// Get events for a website from BigQuery
app.get('/api/bigquery/websites/:websiteId/events', async (req, res) => {
    try {
        const { websiteId } = req.params;
        const { startAt, endAt } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        const query = `
            SELECT DISTINCT event_name
            FROM \`team-researchops-prod-01d6.umami.public_website_event\`
            WHERE website_id = @websiteId
              AND created_at BETWEEN @startDate AND @endDate
              AND event_name IS NOT NULL
            ORDER BY event_name
        `;

        const [job] = await bigquery.createQueryJob({
            query: query,
            location: 'europe-north1',
            params: {
                websiteId: websiteId,
                startDate: startDate,
                endDate: endDate
            }
        });

        const [rows] = await job.getQueryResults();
        const events = rows.map(row => row.event_name);

        res.json({ events });
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
        const { startAt, endAt, includeParams } = req.query;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();
        const withParams = includeParams === 'true';

        console.log(`[Event Properties] Query: ${withParams ? 'EXPENSIVE (with params)' : 'CHEAP (events only)'} - includeParams=${includeParams}`);

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
            FROM \`team-researchops-prod-01d6.umami.public_website_event\`
            WHERE website_id = @websiteId
            AND created_at BETWEEN @startDate AND @endDate
            AND event_name IS NOT NULL
            GROUP BY event_name
            ORDER BY event_name
        `;

        // Dry run to estimate bytes processed
        let estimatedBytes = '0';
        try {
            const dryRunJob = await bigquery.createQueryJob({
                query: query,
                location: 'europe-north1',
                params: {
                    websiteId: websiteId,
                    startDate: startDate,
                    endDate: endDate
                },
                dryRun: true
            });

            const [dryRunMetadata] = await dryRunJob.getMetadata();
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
            params: {
                websiteId: websiteId,
                startDate: startDate,
                endDate: endDate
            }
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

        res.json({
            data: rows
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
        const { websiteId, startUrl, days = 30, steps = 3, limit = 30 } = req.body;

        if (!bigquery) {
            return res.status(500).json({
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const endDate = new Date().toISOString();

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
                    LEAD(url_path) OVER (PARTITION BY session_id ORDER BY created_at) AS next_url
                FROM session_events
                WHERE start_time IS NOT NULL
                    AND created_at >= start_time
            ),
            start_positions AS (
                SELECT
                    session_id,
                    MIN(created_at) as first_pageview_time,
                    MIN(CASE WHEN url_path = @startUrl THEN created_at END) as first_start_url_time
                FROM journey_steps
                GROUP BY session_id
                HAVING MIN(created_at) = MIN(CASE WHEN url_path = @startUrl THEN created_at END)
            ),
            renumbered_steps AS (
                SELECT
                    j.session_id,
                    j.url_path,
                    j.next_url,
                    ROW_NUMBER() OVER (PARTITION BY j.session_id ORDER BY j.created_at) - 1 AS step
                FROM journey_steps j
                INNER JOIN start_positions sp 
                    ON j.session_id = sp.session_id 
                    AND j.created_at >= sp.first_pageview_time
            ),
            raw_flows AS (
                SELECT
                    step,
                    url_path AS source,
                    next_url AS target,
                    COUNT(*) AS value
                FROM renumbered_steps
                WHERE step < @steps
                    AND next_url IS NOT NULL
                    -- Filter out self-loops (same page to same page)
                    AND url_path != next_url
                    -- Ensure step 0 ONLY has the start URL as source
                    AND (step > 0 OR url_path = @startUrl)
                    -- Prevent start URL from appearing as source at steps > 0
                    AND NOT (step > 0 AND url_path = @startUrl)
                    -- Prevent start URL from appearing as target at steps > 0 (no back-navigation to start)
                    AND NOT (step > 0 AND next_url = @startUrl)
                GROUP BY 1, 2, 3
            ),
            ranked AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (PARTITION BY step ORDER BY value DESC) AS rank_in_step
                FROM raw_flows
            )
            SELECT
                step,
                source,
                target,
                value
            FROM ranked
            WHERE rank_in_step <= @limit
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
            const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(4);
            const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(6);

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
            const gbProcessed = (bytesProcessed / (1024 ** 3)).toFixed(4);
            const estimatedCostUSD = ((bytesProcessed / (1024 ** 4)) * 6.25).toFixed(6);

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
            totalBytesProcessedGB: (totalBytesProcessed / (1024 * 1024 * 1024)).toFixed(2),
            estimatedCostUSD: estimatedCostUSD.toFixed(6),
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

app.use(/^(?!.*\/(internal|static)\/).*$/, (req, res) => res.sendFile(`${buildPath}/index.html`))

const server = app.listen(8080, () => {
    console.log('Listening on port 8080')
    console.log('Server timeout set to 2 minutes')
})

// Set server timeout to 2 minutes
server.timeout = 120000
server.keepAliveTimeout = 125000 // Slightly longer than timeout
server.headersTimeout = 130000 // Slightly longer than keepAliveTimeout