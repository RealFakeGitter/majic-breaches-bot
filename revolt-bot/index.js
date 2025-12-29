// --- Mini Web Server for Render Health Check ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Add this logging to see what's happening
console.log(`Attempting to start health check server on port \${PORT}...`);

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

// --- Bot Dependencies ---
const { Client } = require('revolt.js'); // Changed from revolt-api/ws to revolt.js
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const axios = require('axios');

// --- Configuration ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('CRITICAL: REVOLT_BOT_TOKEN environment variable not set. Exiting.');
    process.exit(1); // Exit if the token is missing
}
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';

// --- Initialize Client ---
const client = new Client();
const messageLocks = new Map();

// --- Event Listener ---
client.on('ready', () => {
    console.log('Client is ready and bot is now online.');
});

// --- Master Error Handler ---
client.on('error', (error) => {
    console.error('!!! UNHANDLED CLIENT ERROR !!!');
    console.error(error);
});

// --- Message Handler ---
client.on('message', async (message) => {
    const messageId = message._id;
    if (!messageId) return;

    if (messageLocks.has(messageId)) {
        console.log(`Duplicate message ID \${messageId} detected, ignoring...`);
        return;
    }

    // Lock this message ID so no other instance can process it.
    messageLocks.set(messageId, true);
    console.log(`Locking message ID: \${messageId}`);

    // We will release the lock in the single, top-level `finally` block.
    let browser;

    try {
        // --- TOP LEVEL TRY/CATCH TO PREVENT CRASHES ---
        if (!message.content || !message.author || !message.channel) return;
        if (message.author.bot) return;
        if (!message.content.startsWith('!search')) return;

        const query = message.content.substring(7).trim();
        if (!query) {
            // CHANGE: Added .catch() to prevent crash on send failure
            await message.channel.sendMessage('Please provide a search term. Example: `!search email@example.com`').catch(e => console.error('Error sending "no query" message:', e));
            return;
        }

        console.log(`Received search command for query: "\${query}"`);

        // CHANGE: Added .catch() to prevent crash on send failure
        await message.channel.sendMessage(`Searching for \`${query}\`... This may take a moment.`).catch(e => console.error('Error sending "Searching..." message:', e));

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
        // This static wait is a good fallback for dynamic JS
        await new Promise(resolve => setTimeout(resolve, 3000)); // Reduced from 5s
        console.log('LOG: Results element found.');

        // --- Scrape the Results ---
        const resultsElement = await page.$('#results');
        if (!resultsElement) {
            console.log('Could not find the #results element on the page.');
            // CHANGE: Added .catch() to prevent crash on send failure
            await message.channel.sendMessage('Failed to fetch results. The website structure may have changed or no results were found.').catch(e => console.error('Error sending "Could not find #results" message:', e));
            return;
        }

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
            const embed = {
                title: 'Majic Breaches Search Results',
                description: `No results found for \`${query}\`.`,
                colour: '#FF0000'
            };
            console.log('LOG: Sending "no results" embed.');
            // CHANGE: Added .catch() to prevent crash on send failure
            await message.channel.sendMessage({ embeds: [embed] }).catch(e => console.error('Error sending "no results" embed:', e));
        } else {
            console.log('LOG: Building results for embed and download...');
            const embedFields = [];
            const allResultLines = [];
            let resultCount = 0;

            breachSections.each((i, section) => {
                // This inner loop is synchronous, so errors here are caught by the outer try/catch
                let dbName = $(section).find('h2, h3, .font-bold').first().text().trim();
                const cleanName = dbName.replace(/\s+/g, ' ').trim();

                if (cleanName) {
                    // --- For the FULL download file ---
                    allResultLines.push(`--- \${cleanName} ---`);
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
            });

            // --- Store the FULL list and generate a download link ---
            console.log('LOG: Storing full results and generating download URL...');
            const allResultsText = allResultLines.join('\n');
            const resultId = require('crypto').randomBytes(8).toString('hex');
            resultsStore.set(resultId, { content: allResultsText });
            // Clean up after 10 mins
            setTimeout(() => resultsStore.delete(resultId), 10 * 60 * 1000);
            const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;

            // --- Build the final embed with fields and a button ---
            console.log('LOG: Building final embed object...');
            const embed = {
                title: 'Majic Breaches Search Results',
                description: `Found **${breachSections.length}** breaches for \`${query}\`. Showing the first ${resultCount}.`,
                colour: '#00bfff',
                fields: embedFields
            };
            embed.fields.push({
                name: '📥 Download Full List',
                value: `[Click here for the complete data](${downloadUrl})`,
                inline: false
            });

            console.log('LOG: Sending final embed with download link...');
            // CHANGE: Added .catch() to prevent crash on send failure
            await message.channel.sendMessage({ embeds: [embed] }).catch(e => console.error('Error sending final embed:', e));
            console.log(`Results stored with ID: ${resultId}. Displayed ${resultCount} in embed.`);
        }
    } catch (error) {
        console.error('!!! PUPPETEER SEARCH ERROR !!!');
        console.error(error);
        // Send a user-friendly error message
        console.log('LOG: Sending PUPPETEER ERROR message...');
        // CHANGE: Added .catch() to prevent crash on send failure
        await message.channel.sendMessage('An error occurred while trying to fetch results. The website may be down or the search timed out.').catch(e => console.error('Error sending "PUPPETEER ERROR" message:', e));
    } finally {
        // --- Clean Up ---
        // CHANGE: This is now the ONLY place the browser is closed and lock is released.
        // This ensures it happens exactly once, even if an error occurs above.
        console.log('LOG: In top-level finally block. Closing browser and releasing lock.');
        if (browser) {
            await browser.close().catch(e => console.error('Error closing browser:', e));
            console.log('Browser closed.');
        }
        // --- Release the lock for this message ---
        messageLocks.delete(messageId);
        console.log(`Released lock for message ID: ${messageId}`);
    }
});

// --- Start the Bot ---
client.loginBot(BOT_TOKEN);
