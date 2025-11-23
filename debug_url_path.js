
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const keyFilename = path.join(__dirname, 'service-account-key.json');
const bigquery = new BigQuery({
    projectId: 'team-researchops-prod-01d6',
    keyFilename: keyFilename
});

async function checkUrlPaths() {
    const websiteId = 'feb08edd-87bf-4617-a22f-363ce00d48f6'; // dp-rapportering
    const query = `
        SELECT url_path, COUNT(*) as count
        FROM \`team-researchops-prod-01d6.umami.public_website_event\`
        WHERE website_id = @websiteId
          AND created_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
        GROUP BY url_path
        ORDER BY count DESC
        LIMIT 20
    `;

    const options = {
        query: query,
        location: 'europe-north1',
        params: { websiteId }
    };

    try {
        const [rows] = await bigquery.query(options);
        console.log('Top 20 URL paths:');
        rows.forEach(row => {
            console.log(`${row.url_path}: ${row.count}`);
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

checkUrlPaths();
