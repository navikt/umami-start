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

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
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
        const { startAt, endAt } = req.query;

        if (!bigquery) {
            return res.status(500).json({ 
                error: 'BigQuery client not initialized'
            })
        }

        const startDate = startAt ? new Date(parseInt(startAt)).toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = endAt ? new Date(parseInt(endAt)).toISOString() : new Date().toISOString();

        // Get event names with their parameters
        const query = `
            SELECT 
                e.event_name,
                d.data_key,
                COUNT(*) as total,
                d.data_type,
                CASE 
                    WHEN d.data_type = 1 THEN 'number'
                    WHEN d.data_type = 2 THEN 'string'
                    WHEN d.data_type = 3 THEN 'boolean'
                    WHEN d.data_type = 4 THEN 'date'
                    ELSE 'string'
                END as type
            FROM \`team-researchops-prod-01d6.umami.public_website_event\` e
            JOIN \`team-researchops-prod-01d6.umami.public_event_data\` d
                ON e.event_id = d.website_event_id
            WHERE e.website_id = @websiteId
              AND e.created_at BETWEEN @startDate AND @endDate
              AND e.event_name IS NOT NULL
              AND d.data_key IS NOT NULL
            GROUP BY e.event_name, d.data_key, d.data_type
            ORDER BY e.event_name, d.data_key
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
        
        // Format the response to match the expected structure
        const properties = rows.map(row => ({
            eventName: row.event_name,
            propertyName: row.data_key,
            total: parseInt(row.total),
            type: row.type
        }));

        res.json(properties);
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

app.listen(8080, () => { console.log('Listening on port 8080') })