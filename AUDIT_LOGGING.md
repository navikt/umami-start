# BigQuery Audit Logging Implementation

## Overview

All BigQuery queries now include NAV ident for audit logging and compliance. This allows tracking which user made which query for legal requirements.

## Implementation

### 1. Authentication Middleware

Located at the top of `server.js`, this middleware:
- Extracts the Azure AD token from requests
- Validates the token
- Parses the NAV ident from the token
- Attaches `req.user.navIdent` to the request object

```javascript
// Applied to all /api/bigquery routes
app.use('/api/bigquery', authenticateUser);
```

### 2. Audit Logging Helper Function

```javascript
function addAuditLogging(queryConfig, navIdent) {
    // Add NAV ident as a label (queryable metadata in BigQuery)
    queryConfig.labels = {
        ...queryConfig.labels,
        nav_ident: navIdent.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
        user_type: 'internal'
    };

    // Add NAV ident as SQL comment (visible in query history)
    if (queryConfig.query && navIdent) {
        queryConfig.query = `-- NAV ident: ${navIdent}\n-- Timestamp: ${new Date().toISOString()}\n${queryConfig.query}`;
    }

    return queryConfig;
}
```

### 3. Usage Pattern

**Before:**
```javascript
const [job] = await bigquery.createQueryJob({
    query: query,
    location: 'europe-north1',
    params: params
});
```

**After:**
```javascript
// Get NAV ident from authenticated user for audit logging
const navIdent = req.user?.navIdent || 'UNKNOWN';

const [job] = await bigquery.createQueryJob(addAuditLogging({
    query: query,
    location: 'europe-north1',
    params: params
}, navIdent));
```

## What Gets Logged

### 1. BigQuery Job Labels
Queryable metadata attached to each BigQuery job:
- `nav_ident`: The NAV ident of the user (lowercase, sanitized)
- `user_type`: Always "internal" for NAV employees

Example:
```json
{
  "nav_ident": "a123456",
  "user_type": "internal"
}
```

### 2. SQL Comments
Added to the query itself, visible in BigQuery query history:
```sql
-- NAV ident: A123456
-- Timestamp: 2025-12-08T01:05:00.000Z
SELECT * FROM ...
```

## Querying Audit Logs

### Query by NAV Ident
```sql
SELECT
  job_id,
  user_email,
  creation_time,
  total_bytes_processed,
  labels
FROM
  `team-researchops-prod-01d6.region-europe-north1.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
WHERE
  JSON_VALUE(labels, '$.nav_ident') = 'a123456'
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
ORDER BY creation_time DESC;
```

### All Queries with User Info
```sql
SELECT
  job_id,
  JSON_VALUE(labels, '$.nav_ident') as nav_ident,
  creation_time,
  query,
  total_bytes_processed,
  total_slot_ms
FROM
  `team-researchops-prod-01d6.region-europe-north1.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
WHERE
  creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND JSON_VALUE(labels, '$.user_type') = 'internal'
ORDER BY creation_time DESC;
```

## Privacy & Compliance

### Why NAV Ident?
- ✅ Standard NAV internal identifier
- ✅ Less PII than email address
- ✅ Immutable (doesn't change)
- ✅ Already used throughout NAV systems
- ✅ Required for legal audit trails

### Alternative Considered
- ❌ Email (`preferred_username`): More PII, can change
- ❌ Azure Object ID: Not human-readable, hard to correlate
- ✅ **NAV ident**: Best balance of privacy and auditability

## Local Development

For local development where Azure AD is not available:
- The middleware sets `req.user.navIdent = 'LOCAL_DEV'`
- Queries are still logged but marked as LOCAL_DEV
- No authentication errors in local environment

## Migration Status

### ✅ Completed
- Authentication middleware implemented
- Audit logging helper function created
- First endpoint migrated (diagnosis)

### 🔄 To Do
Apply the audit logging pattern to all remaining BigQuery endpoints. Use this find-and-replace pattern:

**Find:**
```javascript
const [job] = await bigquery.createQueryJob({
```

**Replace with:**
```javascript
const navIdent = req.user?.navIdent || 'UNKNOWN';

const [job] = await bigquery.createQueryJob(addAuditLogging({
```

**And add closing paren:**
```javascript
        }, navIdent));
```

## Testing

After implementation, verify:
1. Authentication works (visit `/profil`)
2. BigQuery queries execute successfully
3. Check BigQuery job labels in GCP Console
4. View query history to see SQL comments

## Support

For questions about audit logging:
- Check NAIS documentation on Azure AD
- Review @navikt/oasis documentation
- Contact platform team for BigQuery audit requirements
