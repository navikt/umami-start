import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, 'server.js');
const content = fs.readFileSync(file, 'utf8');

// Simple regex replacement approach - more reliable
let updated = content;

// Pattern: Find createQueryJob({ and replace with createQueryJob(addAuditLogging({
// Then find the matching closing }); and replace with }, navIdent));

// First, add navIdent before each createQueryJob
updated = updated.replace(
    /(const \[(?:job|dryRunJob|historyJob|lastEventJob|countJob)\] = await bigquery\.createQueryJob\(\{)/g,
    `const navIdent = req.user?.navIdent || 'UNKNOWN';\n\n        $1`
);

// Then wrap with addAuditLogging 
updated = updated.replace(
    /const \[(?:job|dryRunJob|historyJob|lastEventJob|countJob)\] = await bigquery\.createQueryJob\(\{/g,
    match => match.replace('createQueryJob({', 'createQueryJob(addAuditLogging({')
);

// Find closing }); that comes after location and params, and replace with }, navIdent));
// This is tricky - we need to match the right closing brace
// Look for pattern like: params: something\n        });
updated = updated.replace(
    /(params:\s*\w+)\s*\n\s*\}\);/g,
    '$1\n        }, navIdent));'
);

// Also handle dryRun: true cases
updated = updated.replace(
    /(dryRun:\s*true)\s*\n\s*\}\);/g,
    '$1\n        }, navIdent));'
);

// Write back
fs.writeFileSync(file, updated, 'utf8');

console.log('✅ Migration complete - please review manually');
console.log('Run: node server.js');
console.log('To test for syntax errors');
