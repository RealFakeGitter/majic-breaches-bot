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
const messageLocks = new Map();

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

        // --- NEW: Robust Locking System ---
        // We only care about Message events, ignore everything else immediately.
        if (event.type !== 'Message') return;

        // Create a unique ID for this specific message
        const messageId = event._id;
        if (!messageId) return; // If there's no ID, we can't track it, so ignore.

        // Check if this message is already being processed. If so, stop.
        if (messageLocks.has(messageId)) {
            console.log(`Duplicate message ID \${messageId} detected, ignoring...`);
            return;
        }

        // Lock this message ID so no other instance can process it.
        messageLocks.set(messageId, true);
        console.log(`Locking message ID: ${messageId}`);
        // We will release the lock in the `finally` block.
        // --- End New Locking System ---

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
        await api.post(`/channels/\${message.channel}/messages`, { content: `Searching for \`${query}\`... This may take a moment.` })
            .catch(e => console.error('Error sending "Searching..." message:', e));

        console.log(`Received search command for query: "${query}"`);

        let browser;
        try {
            // --- Launch Puppeteer Browser ---
            console.log('LOG: Launching browser...');
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
            console.log('LOG: Browser launched.');

            const page = await browser.newPage();
            console.log('LOG: Navigating to website...');
            await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2' });
            console.log('LOG: Navigated to website, waiting for search input...');

            // --- Perform the Search ---
            await page.waitForSelector('#searchInput', { timeout: 10000 });
            await page.type('#searchInput', query);
            await page.keyboard.press('Enter');
            console.log('LOG: Search submitted, waiting for results...');
            await page.waitForSelector('#results', { timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for JS to populate
            console.log('LOG: Results element found.');

            // --- Scrape the Results ---
            const resultsElement = await page.$('#results');
            if (!resultsElement) {
                console.log('Could not find the #results element on the page.');
                await api.post(`/channels/${message.channel}/messages`, { content: 'Failed to fetch results. The website structure may have changed or no results were found.' })
                    .catch(e => console.error('Error sending "Could not find #results" message:', e));
                return;
            }

            // Safely get the HTML of the results element
            const resultsHtml = await page.evaluate(el => el.innerHTML, resultsElement);
            console.log('--- START OF RESULTS HTML ---');
            console.log(resultsHtml);
            console.log('--- END OF RESULTS HTML ---');

            // --- Format results for embed AND prepare full list for download ---
            console.log('LOG: Attempting to parse results...');
            const $ = cheerio.load(resultsHtml);
            let breachSections = $('.breach-section');
            console.log(`Found \${breachSections.length} total breaches.`);

            if (breachSections.length === 0) {
                // No results found case
                const embed = {
                    title: 'Majic Breaches Search Results',
                    description: `No results found for \`${query}\`.`,
                    colour: '#FF0000'
                };
                console.log('LOG: Sending "no results" embed.');
                await api.post(`/channels/${message.channel}/messages`, { embeds: [embed] });
            } else {
                console.log('LOG: Building results for embed and download...');
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
                                    embedFields.push({ name: cleanName, value: fieldValue, inline: false });
                                    resultCount++;
                                }
                            }
                        }
                    } catch (fieldError) {
                        console.error(`Error processing breach ${i}:`, fieldError);
                    }
                });

                // --- Store the FULL list and generate a download link ---
                console.log('LOG: Storing full results and generating download URL...');
                const allResultsText = allResultLines.join('\n');
                const resultId = require('crypto').randomBytes(8).toString('hex');
                resultsStore.set(resultId, { content: allResultsText });
                setTimeout(() => resultsStore.delete(resultId), 10 * 60 * 1000); // Clean up after 10 mins
                const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;

                // --- Build the final embed with fields and a button ---
                console.log('LOG: Building final embed object...');
                const embed = {
                    title: 'Majic Breaches Search Results',
                    description: `Found **\${breachSections.length}** breaches for \`${query}\`. Showing the first \${resultCount}.`,
                    colour: '#00bfff',
                    fields: embedFields
                };
                embed.fields.push({ name: '📥 Download Full List', value: `[Click here for the complete data](${downloadUrl})`, inline: false });

                console.log('LOG: Sending final embed with download link...');
                await api.post(`/channels/${message.channel}/messages`, { embeds: [embed] });
                console.log(`Results stored with ID: \${resultId}.
                                Displayed ${resultCount} in embed.`);
            }
        } catch (error) {
            console.error('!!! PUPPETEER SEARCH ERROR !!!');
            console.error(error);
            // Send a user-friendly error message
            console.log('LOG: Sending PUPPETEER ERROR message...');
            await api.post(`/channels/${message.channel}/messages`, { content: 'An error occurred while trying to fetch results. The website may be down or the search timed out.' })
                .catch(e => console.error('Error sending "PUPPETEER ERROR" message:', e));
        } finally {
            // --- Clean Up ---
            console.log('LOG: In inner finally block. Closing browser and releasing lock.');
            if (browser) {
                await browser.close();
                console.log('Browser closed.');
            }
            // --- Release the lock for this message ---
            messageLocks.delete(messageId);
            console.log(`Released lock for message ID: ${messageId}`);
        }
    } catch (err) {
        // THIS IS THE NEW, CRITICAL PART
        console.error('!!! UNHANDLED WEBSOCKET MESSAGE ERROR !!!');
        console.error(err);
    } finally {
        // This is the CRITICAL part that was missing.
        // It ensures the lock is ALWAYS released, even if an unexpected error happens.
        // We need to get the messageId from the event object again because we're in a different scope.
        try {
            const event = JSON.parse(data.toString());
            const messageId = event._id;
            if (messageId && messageLocks.has(messageId)) {
                messageLocks.delete(messageId);
                console.log(`Forcefully released lock for message ID: ${messageId} in top-level finally.`);
            }
        } catch (e) {
            console.error('Error in top-level finally block while trying to release lock:', e);
        }
    }
});
