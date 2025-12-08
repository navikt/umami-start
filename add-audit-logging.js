#!/usr/bin/env node

/**
 * Script to add audit logging to all BigQuery createQueryJob calls in server.js
 * 
 * This script will:
 * 1. Find all bigquery.createQueryJob() calls
 * 2. Add NAV ident extraction before each call
 * 3. Wrap the query config with addAuditLogging()
 * 
 * Usage: node add-audit-logging.js
 */

const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.join(__dirname, 'server.js');

// Read the server.js file
let content = fs.readFileSync(SERVER_FILE, 'utf8');

// Pattern 1: Standard createQueryJob calls
// Find: const [job] = await bigquery.createQueryJob({
// Add navIdent extraction before it and wrap the config

const pattern1 = /(\s+)(const \[(?:job|dryRunJob|historyJob|lastEventJob|countJob)\] = await bigquery\.createQueryJob\(\{)/g;

let matches = 0;
let alreadyProcessed = 0;

content = content.replace(pattern1, (match, indent, captureGroup) => {
    // Check if navIdent is already defined right before this (to avoid double processing)
    const beforeMatch = content.substring(Math.max(0, content.lastIndexOf(match) - 200), content.lastIndexOf(match));

    if (beforeMatch.includes('const navIdent = req.user?.navIdent')) {
        alreadyProcessed++;
        return match; // Already processed, skip
    }

    matches++;
    return `${indent}// Get NAV ident from authenticated user for audit logging
${indent}const navIdent = req.user?.navIdent || 'UNKNOWN';

${indent}${captureGroup.replace('{', 'addAuditLogging({')}`;
});

// Pattern 2: Close the addAuditLogging wrapper
// Find the closing }); for createQueryJob and change it to }, navIdent));

// This is tricky because we need to match the right closing brace
// We'll do a simple pattern that looks for }); after params
const pattern2 = /(params: params|params: countParams|params: historyParams|params: lastEventParams)\s*\n\s*\}\);/g;

content = content.replace(pattern2, (match, paramsLine) => {
    return match.replace('});', '}, navIdent));');
});

// Pattern 3: Also handle cases where query.params is on same line
const pattern3 = /(query: \w+,\s*location: 'europe-north1',\s*params: \w+)\s*\}\);/g;

content = content.replace(pattern3, (match, configContent) => {
    // Only replace if not already wrapped
    if (!match.includes('}, navIdent')); ')) {
    return match.replace('});', '}, navIdent));');
}
    return match;
});

// Write back to file
fs.writeFileSync(SERVER_FILE, content, 'utf8');

console.log('✅ Audit logging migration complete!');
console.log(`   - Found ${matches} BigQuery query calls`);
console.log(`   - Already processed: ${alreadyProcessed}`);
console.log(`   - Updated: ${matches}`);
console.log('');
console.log('⚠️  IMPORTANT: Review the changes manually!');
console.log('   Some complex query patterns may need manual adjustment.');
console.log('');
console.log('   Run: git diff server.js');
console.log('   To review the changes before committing.');
