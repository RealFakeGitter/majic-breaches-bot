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

// --- In-memory storage for results ---
const resultsStore = new Map();

// --- Endpoint to serve results as a downloadable text file ---
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
const processedMessages = new Set();

// Connect to the WebSocket using the 'ws' library with a different auth method
const ws = new WebSocket('wss://events.stoat.chat?token=' + BOT_TOKEN);

// --- Event Listeners ---
ws.on('open', () => {
    console.log('WebSocket connection opened. Bot is now online.');
});


     ws.on('message', async (data) => {
    // --- TOP LEVEL TRY/CATCH TO PREVENT CRASHES ---
    try {
        const event = JSON.parse(data.toString());
        const messageId = event._id || `${event.channel}-${event.author.id}-${Date.now()}`;

        // Add this check to prevent duplicate processing
        if (isProcessing) {
            console.log('Duplicate message detected, ignoring...');
            return;
        }
        // Check if we've already processed this specific message ID
        if (processedMessages.has(messageId)) {
            console.log(`Already processed message ID: ${messageId}, ignoring...`);
            return;
        }
        processedMessages.add(messageId);

        isProcessing = true; // Set the flag

        // We only care about Message events
        if (event.type !== 'Message') return;
        // ... and the rest of your code

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
            return api.post(`/channels/${message.channel}/messages`, { content: 'Please provide a search term. Example: `!search email@example.com`' });
        }

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
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
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

          // --- NEW: Format results for embed AND prepare full list for download ---
console.log('Attempting to parse results...');
const $ = cheerio.load(resultsHtml);
let breachSections = $('.breach-section');
console.log(`Found ${breachSections.length} total breaches.`);

if (breachSections.length === 0) {
    // No results found case
    const embed = { title: 'Majic Breaches Search Results', description: `No results found for \`${query}\`.`, colour: '#FF0000' };
    await api.post(`/channels/${message.channel}/messages`, { embeds: [embed] });
} else {
    const embedFields = [];
    const allResultLines = [];
    let resultCount = 0;

    breachSections.each((i, section) => {
        try {
            let dbName = $(section).find('h2').first().text().trim();
            if (!dbName) dbName = $(section).find('h3').first().text().trim();
            if (!dbName) dbName = $(section).find('.font-bold').first().text().trim();

            if (dbName) {
                const cleanName = dbName.replace(/\s+/g, ' ').trim();
                if (cleanName) {
                    // --- For the FULL download file ---
                    allResultLines.push(`--- ${cleanName} ---`);
                    $(section).find('tbody tr').each((j, row) => {
                        const rowData = $(row).find('td').map((k, cell) => $(cell).text().trim()).get().join(' | ');
                        if (rowData) allResultLines.push(rowData);
                    });
                    allResultLines.push(''); // Add a blank line for spacing

                    // --- For the EMBED (first 10 only) ---
                    if (resultCount < 10) {
                        const firstRow = $(section).find('tbody tr').first();
                        const sampleData = firstRow.find('td').map((j, cell) => $(cell).text().trim()).get().join(' | ');

                        let fieldValue = `Sample: \`${sampleData.substring(0, 150)}\``;
                        if (fieldValue.length < 5) fieldValue = 'No sample data available.';

                        embedFields.push({
                            name: cleanName,
                            value: fieldValue,
                            inline: false
                        });
                        resultCount++;
                    }
                }
            }
        } catch (fieldError) {
            console.error(`Error processing breach ${i}:`, fieldError);
        }
    });

    // --- Store the FULL list and generate a download link ---
    const allResultsText = allResultLines.join('\n');
    const resultId = require('crypto').randomBytes(8).toString('hex');
    resultsStore.set(resultId, { content: allResultsText });
    setTimeout(() => resultsStore.delete(resultId), 10 * 60 * 1000); // Clean up after 10 mins
    const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;

    // --- Build the final embed with fields and a button ---
    const embed = {
        title: 'Majic Breaches Search Results',
        description: `Found **${breachSections.length}** breaches for \`${query}\`. Showing the first ${resultCount}.`,
        colour: '#00bfff',
        fields: embedFields
    };

    // Note: Revolt API doesn't have native buttons, so we add the link to the embed's footer.
    embed.footer = {
        text: `Download the complete list (${breachSections.length} total breaches):`,
        icon_url: null,
        proxy_icon_url: null
    };
    // We add the URL as a field because Revolt's footer isn't clickable.
    embed.fields.push({
        name: '📥 Download Full List',
        value: `[Click here for the complete data](${downloadUrl})`,
        inline: false
    });

    await api.post(`/channels/${message.channel}/messages`, { embeds: [embed] });
    console.log(`Results stored with ID: ${resultId}. Displayed ${resultCount} in embed.`);
}

        } catch (error) {
            console.error('!!! PUPPETEER SEARCH ERROR !!!');
            console.error(error);
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

    } catch (err) {
        // THIS IS THE NEW, CRITICAL PART
        console.error('!!! UNHANDLED WEBSOCKET MESSAGE ERROR !!!');
        console.error(err);
    } finally {
        // ALWAYS reset the flag
        isProcessing = false;
    }
});
