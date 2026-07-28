// Dev/ops utility: load an exported request_tracking CSV into the DB.
// Usage:  node scripts/importTrackingCsv.js <file.csv> [--truncate]
// Rows that fail to cast (bad inet / json) are skipped, not fatal.
import fs from 'fs';
import { query } from '../utilities/connectDB.js';

function parseCsv(text) {
    const rows = [];
    let field = '', row = [], inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
}

const COLUMNS = [
    ['timestamp', '$$::timestamptz'], ['method', '$$'], ['path', '$$'],
    ['status_code', 'NULLIF($$,\'\')::int'], ['ip_address', 'NULLIF($$,\'\')::inet'],
    ['user_agent', '$$'], ['is_trap', 'NULLIF($$,\'\')::boolean'], ['trap_type', 'NULLIF($$,\'\')'],
    ['bot_score', 'NULLIF($$,\'\')::int'], ['bot_label', 'NULLIF($$,\'\')'], ['crawler_type', 'NULLIF($$,\'\')'],
    ['threat_signals', 'NULLIF($$,\'\')::jsonb'], ['country', 'NULLIF($$,\'\')'], ['asn', 'NULLIF($$,\'\')'],
    ['body', 'NULLIF($$,\'\')::jsonb'],
];

async function main() {
    const file = process.argv[2];
    if (!file) { console.error('usage: importTrackingCsv.js <file.csv> [--truncate]'); process.exit(1); }

    const rows = parseCsv(fs.readFileSync(file, 'utf8'));
    const header = rows.shift();
    const colIndex = (name) => header.indexOf(name);

    if (process.argv.includes('--truncate')) {
        await query('TRUNCATE request_tracking');
        console.log('truncated request_tracking');
    }

    const cols = COLUMNS.map(([c]) => c).join(', ');
    const placeholders = COLUMNS.map(([, cast], i) => cast.replace('$$', `$${i + 1}`)).join(', ');
    const insert = `INSERT INTO request_tracking (${cols}) VALUES (${placeholders})`;

    let ok = 0, skipped = 0;
    for (const r of rows) {
        if (r.length !== header.length) { skipped++; continue; }
        const params = COLUMNS.map(([name]) => r[colIndex(name)] ?? '');
        try { await query(insert, params); ok++; }
        catch { skipped++; }
    }
    console.log(`imported ${ok} rows, skipped ${skipped}`);
    process.exit(0);
}

main();
