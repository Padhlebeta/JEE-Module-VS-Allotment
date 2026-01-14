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
            // Handle values that might contain =
            const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
            process.env[key] = value;
        }
    });
} catch (e) {
    console.error('Error loading .env.local', e);
}

async function run() {
    console.log('Testing Google Sheets Connection...');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    console.log('Client Email:', clientEmail); // Safe to log email

    // Handle private key newlines
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

    if (!privateKey) console.error('Private Key is missing or empty!');

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        console.log('Spreadsheet ID:', spreadsheetId);

        const res = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        console.log('✅ Connection Successful!');
        console.log('Sheet Title:', res.data.properties.title);
        console.log('Available Sheets (Tabs):');
        res.data.sheets.forEach(s => {
            console.log(`- "${s.properties.title}" (ID: ${s.properties.sheetId})`);
        });

        // If we find a sheet, try to fetch headers from the FIRST one
        const firstSheetName = res.data.sheets[0].properties.title;
        console.log(`\nFetching headers from: "${firstSheetName}"...`);

        const res2 = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${firstSheetName}'!A1:Z1`, // Quote the name in case of spaces
        });

        console.log('Headers:', res2.data.values[0]);
        console.log('Indices:');
        res2.data.values[0].forEach((h, i) => console.log(`${i}: ${h}`));

    } catch (error) {
        console.error('❌ Error Failed:');
        console.error(error.message);
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

run();
