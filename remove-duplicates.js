import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, 'server.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Track which lines have navIdent declarations
const navIdentLines = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('const navIdent = req.user')) {
        navIdentLines.push(i);
    }
}

console.log(`Found ${navIdentLines.length} navIdent declarations`);

// For each declaration, check if there's another one within 50 lines (same function/try block)
const toRemove = [];
for (let i = 0; i < navIdentLines.length - 1; i++) {
    const currentLine = navIdentLines[i];
    const nextLine = navIdentLines[i + 1];

    // If next declaration is within 50 lines, it's likely a duplicate in same scope
    if (nextLine - currentLine < 50) {
        console.log(`Duplicate found: line ${currentLine + 1} and line ${nextLine + 1}`);
        toRemove.push(nextLine); // Keep first, remove second
    }
}

// Re move duplicate lines
const filtered = lines.filter((line, index) => {
    if (toRemove.includes(index)) {
        console.log(`Removing line ${index + 1}: ${line.trim()}`);
        return false;
    }
    return true;
});

fs.writeFileSync(file, filtered.join('\n'), 'utf8');

console.log(`✅ Removed ${toRemove.length} duplicate navIdent declarations`);
