const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
try {
    const envPath = path.resolve(__dirname, '.env.local');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
            process.env[key] = value;
        }
    });
} catch (e) {
    console.error('Error loading .env.local', e);
}

async function run() {
    let output = '';
    const log = (msg) => { console.log(msg); output += msg + '\n'; };

    log('--- Debugging Sync Logic ---');

    // Auth
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: clientEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    // 1. Get Metadata
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitle = meta.data.sheets[0].properties.title;
    log(`Sheet Title: "${sheetTitle}"`);

    // 2. Fetch First 5 Rows
    const rangeResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A1:Z5`,
    });
    const rowsPreview = rangeResponse.data.values || [];

    // 3. Header Detection Logic (Mirrors route.ts)
    let headerRowIndex = -1;
    for (let i = 0; i < rowsPreview.length; i++) {
        const rowStr = rowsPreview[i].join(' ').toLowerCase();
        // The check used in route.ts
        if (rowStr.includes('cohort') && rowStr.includes('subject')) {
            headerRowIndex = i;
            log(`✅ Found Header at Index ${i} (Row ${i + 1})`);
            break;
        }
    }

    if (headerRowIndex === -1) {
        log('⚠️ Header NOT found by keywords. Defaulting to 1 (Row 2).');
        headerRowIndex = 1;
    }

    const headers = rowsPreview[headerRowIndex] || [];
    log(`Headers: ${JSON.stringify(headers)}`);

    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    const findIndex = (keywords) => lowerHeaders.findIndex(h => keywords.some(k => h.includes(k)));

    const map = {
        email: findIndex(['allotted to', 'vs allotted', 'teacher', 'email']),
    };

    log(`Mappings: ${JSON.stringify(map)}`);

    // 4. Test Data Extraction (Next 3 rows)
    const dataStartRow = headerRowIndex + 2;
    log(`Fetching data starting Row ${dataStartRow}...`);

    const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A${dataStartRow}:Z${dataStartRow + 5}`,
    });

    const rows = dataResponse.data.values || [];
    rows.forEach((row, i) => {
        const emailIdx = map.email >= 0 ? map.email : 16;
        const val = row[emailIdx];
        log(`Row ${dataStartRow + i}: Length=${row.length}, Index=${emailIdx}, Value="${val}"`);
    });

    fs.writeFileSync('debug_output.txt', output);
}

run();
