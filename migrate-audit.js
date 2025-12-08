#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, 'server.js');
let content = fs.readFileSync(file, 'utf8');
const original = content;

// Split into lines for easier processing
const lines = content.split('\n');
const updatedLines = [];
let modifications = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains createQueryJob
    if (line.includes('createQueryJob(')) {
        // Check if the previous lines already have navIdent (skip if already processed)
        const prevLines = lines.slice(Math.max(0, i - 5), i).join('\n');

        if (prevLines.includes('const navIdent = req.user?.navIdent')) {
            // Already processed
            updatedLines.push(line);
            continue;
        }

        // Get the indentation
        const indent = line.match(/^(\s*)/)[1];

        // Add navIdent extraction before createQueryJob
        updatedLines.push(`${indent}// Get NAV ident from authenticated user for audit logging`);
        updatedLines.push(`${indent}const navIdent = req.user?.navIdent || 'UNKNOWN';`);
        updatedLines.push('');

        // Replace createQueryJob({ with createQueryJob(addAuditLogging({
        updatedLines.push(line.replace('createQueryJob({', 'createQueryJob(addAuditLogging({'));

        // Now we need to find the closing }); and replace with }, navIdent));
        // Look ahead to find it
        let j = i + 1;
        let braceCount = 1;
        while (j < lines.length && braceCount > 0) {
            updatedLines.push(lines[j]);

            // Count braces
            const openBraces = (lines[j].match(/\{/g) || []).length;
            const closeBraces = (lines[j].match(/\}/g) || []).length;
            braceCount += openBraces - closeBraces;

            // If we found the closing, replace it
            if (braceCount === 0 && lines[j].includes('});')) {
                updatedLines[updatedLines.length - 1] = lines[j].replace('});', '}, navIdent));');
                modifications++;
                i = j; // Skip ahead
                break;
            }

            j++;
        }
    } else {
        updatedLines.push(line);
    }
}

// Write back
fs.writeFileSync(file, updatedLines.join('\n'), 'utf8');

console.log(`✅ Updated ${modifications} BigQuery createQueryJob calls with audit logging`);
console.log(`\nRun: git diff server.js | head -100`);
console.log(`To review the first changes.`);
