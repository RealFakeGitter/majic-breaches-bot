// --- Mini Web Server for Render Health Check ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Add this logging to see what's happening
console.log(`Attempting to start health check server on port ${PORT}...`);

app.get('/health', (req, res) => {
    console.log('Health check endpoint was hit.');
    res.status(200).send('OK');
});

// Use a try/catch for the server start itself
try {
    const server = app.listen(PORT, () => {
        console.log(`✅ Health check server listening successfully on port ${PORT}`);
    });
    server.on('error', (err) => {
        console.error('❌ Failed to start health check server:', err);
    });
} catch (err) {
    console.error('❌ Critical error starting server:', err);
}
// --- End Mini Web Server ---

// --- In-memory storage for results --- // --- NEW ---
const resultsStore = new Map();

// --- Endpoint to serve results as a downloadable text file --- // --- NEW ---
app.get('/results/:id', (req, res) => {
    const resultId = req.params.id;
    const resultData = resultsStore.get(resultId);
    if (!resultData) {
        return res.status(404).send('Results not found or have expired.');
    }
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="majic-results-${resultId}.txt"`);
    res.send(resultData.content);
});


const { API } = require('revolt-api');
const WebSocket = require('ws');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const axios = require('axios');

// --- Configuration ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';

// --- Initialize API and WebSocket ---
const api = new API({
    baseURL: "https://api.stoat.chat",
    authentication: {
        revolt: BOT_TOKEN
    }
});

let isProcessing = false; // Add this line

// Connect to the WebSocket using the 'ws' library with a different auth method
const ws = new WebSocket('wss://events.stoat.chat?token=' + BOT_TOKEN);

// --- Event Listeners ---
ws.on('open', () => {
    console.log('WebSocket connection opened. Bot is now online.');
});


        ws.on('message', async (data) => {
    try {
        // Add this check to prevent duplicate processing
        if (isProcessing) {
            console.log('Duplicate message detected, ignoring...');
            return;
        }
        isProcessing = true; // Set the flag

        const event = JSON.parse(data.toString());

        // We only care about Message events
        if (event.type !== 'Message') return;

        // Ensure the event has the basic structure of a message
        if (!event.content || !event.author || !event.channel) return;

        // Ignore messages from bots
        if (event.author.bot) return;

        // Check for the command
        if (!event.content.startsWith('!search')) return;

        // Use the 'event' object from here on, or rename it to 'message' for consistency
        const message = event;

        const query = message.content.substring(7).trim();
        if (!query) {
            return api.post(`/channels/${message.channel}/messages`, {
                content: 'Please provide a search term. Example: `!search email@example.com`'
            });
        }

        // Let the user know the bot is working
      // Let the user know the bot is working
console.log('Attempting to send "Searching..." message...');
await api.post(`/channels/${message.channel}/messages`, { content: `Searching for \`${query}\`... This may take a moment.` })
    .catch(e => console.error('Error sending "Searching..." message:', e));
        console.log(`Received search command for query: "${query}"`);

        let browser;
        try {
           // --- Launch Puppeteer Browser ---
browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [
        ...chromium.args,
        '--no-sandbox', // Add this
        '--disable-setuid-sandbox', // Add this
        '--disable-dev-shm-usage', // Critical for memory issues on Linux
        '--disable-gpu' // We don't need a GPU
    ],
    headless: chromium.headless,
});
            const page = await browser.newPage();
            await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2' });

            console.log('Navigated to website, waiting for search input...');

            // --- Perform the Search ---
            await page.waitForSelector('#searchInput', { timeout: 10000 });
            await page.type('#searchInput', query);
            await page.keyboard.press('Enter');

            console.log('Search submitted, waiting for results...');

            await page.waitForSelector('#results', { timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for JS to populate

            // --- Scrape the Results ---
const resultsElement = await page.$('#results');
if (!resultsElement) {
    console.log('Could not find the #results element on the page.');
   console.log('Attempting to send "Could not find #results" message...');
await api.post(`/channels/${message.channel}/messages`, { content: 'Failed to fetch results. The website structure may have changed or no results were found.' })
    .catch(e => console.error('Error sending "Could not find #results" message:', e));
    return;
}
// Safely get the HTML of the results element
const resultsHtml = await page.evaluate(el => el.innerHTML, resultsElement);
            console.log('--- START OF RESULTS HTML ---');
            console.log(resultsHtml);
            console.log('--- END OF RESULTS HTML ---');

                     // --- NEW: Format ALL results for download and first 10 for display ---
            const embed = { title: 'Majic Breaches Search Results', colour: '#00bfff' };
            const $ = cheerio.load(resultsHtml);
            console.log('Attempting to parse results...');
            let breachSections = $('.breach-section');
            const totalBreachCount = breachSections.length;
            console.log(`Found ${totalBreachCount} total breaches.`);

            // --- PART 1: Prepare ALL results for the text file ---
            const allResultLines = [];
            breachSections.each((i, section) => {
                let dbName = $(section).find('h2, h3, .font-bold').first().text().trim();
                const cleanName = dbName.replace(/\s+/g, ' ').trim();
                if (cleanName) {
                    allResultLines.push(`--- ${cleanName} ---`);
                    $(section).find('tbody tr').each((j, row) => {
                        const rowData = $(row).find('td').map((k, cell) => $(cell).text().trim()).get().join(' | ');
                        if (rowData) allResultLines.push(rowData);
                    });
                    allResultLines.push(''); // Add a blank line between breaches
                }
            });
            const allResultsText = allResultLines.join('\n');

            // --- PART 2: Store full results and generate download URL ---
            const resultId = require('crypto').randomBytes(8).toString('hex');
            resultsStore.set(resultId, { content: allResultsText });
            setTimeout(() => resultsStore.delete(resultId), 10 * 60 * 1000); // Auto-delete after 10 minutes
            const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;

            // --- PART 3: Build embed fields for display (max 10) ---
            const fields = [];
            let resultCount = 0;
            breachSections.each((i, section) => {
                if (resultCount >= 10) return false; // Stop after 10 fields
                try {
                    let dbName = $(section).find('h2').first().text().trim();
                    if (!dbName) dbName = $(section).find('h3').first().text().trim();
                    if (!dbName) dbName = $(section).find('.font-bold').first().text().trim();
                    if (dbName) {
                        const cleanName = dbName.replace(/\s+/g, ' ').trim();
                        if (cleanName) {
                            const firstRow = $(section).find('tbody tr').first();
                            const rowData = firstRow.find('td').map((j, cell) => $(cell).text().trim()).get().join(' | ');
                            let fieldValue = `Sample: \`${rowData.substring(0, 150)}\``;
                            if (rowData.length < 5) fieldValue = 'No sample data available.';
                            fields.push({ name: cleanName, value: fieldValue, inline: false });
                            resultCount++;
                        }
                    }
                } catch (fieldError) {
                    console.error(`Error processing field ${i}:`, fieldError);
                }
            });

            // --- PART 4: Assemble and send the final embed ---
            if (resultCount === 0) {
                embed.description = `No results found for \`${query}\`.`;
                embed.colour = '#FF0000';
            } else {
                embed.description = `Found **${totalBreachCount}** breaches for \`${query}\`. Showing the first ${resultCount}.`;
                embed.fields = fields; // Add the array of fields here
                // Add the download link as the last field
                embed.fields.push({
                    name: '📥 Download Full List',
                    value: `[Click here for the complete data](${downloadUrl})`,
                    inline: false
                });
            }

            // --- Send the Final Message ---
            console.log('Preparing to send final message...');
            try {
                const payload = { embeds: [embed] };
                console.log('Payload being sent:', JSON.stringify(payload, null, 2));
                await api.post(`/channels/${message.channel}/messages`, payload);
                console.log('!!! API CALL COMPLETED SUCCESSFULLY !!!');
            } catch (finalMessageError) {
                console.error('!!! FAILED TO SEND EMBED !!!');
                console.error(finalMessageError.response?.data || finalMessageError);
            }
        } catch (error) {
            console.error('!!! PUPPETEER SEARCH ERROR !!!');
            console.error(error);
            // Send a user-friendly error message
            // Send a user-friendly error message
console.log('Attempting to send "PUPPETEER ERROR" message...');
await api.post(`/channels/${message.channel}/messages`, { content: 'An error occurred while trying to fetch results. The website may be down or the search timed out.' })
    .catch(e => console.error('Error sending "PUPPETEER ERROR" message:', e));

        } finally {
            // --- Clean Up ---
            if (browser) {
                await browser.close();
                console.log('Browser closed.');
            }
        }

    }     catch (err) {
        console.error('!!! WEBSOCKET MESSAGE ERROR !!!');
        console.error(err);
    } finally {
        isProcessing = false; // Reset the flag
    }
});

ws.on('error', (err) => {
    console.error('!!! WEBSOCKET ERROR !!!');
    console.error(err);
});

ws.on('close', (code, reason) => {
    console.log(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
});
