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
// --- Message Handler ---
client.on('message', async (message) => {
    console.log('DEBUG: Message event received.'); // NEW LOG
    const messageId = message._id;
    if (!messageId) {
        console.log('DEBUG: Message has no ID, returning.'); // NEW LOG
        return;
    }

    if (messageLocks.has(messageId)) {
        console.log(`DEBUG: Duplicate message ID \${messageId} detected, ignoring...`); // CHANGED LOG
        return;
    }

    messageLocks.set(messageId, true);
    console.log(`DEBUG: Locking message ID: \${messageId}`); // CHANGED LOG

    let browser;

    try {
        console.log('DEBUG: Entering main try block.'); // NEW LOG
        if (!message.content || !message.author || !message.channel) {
            console.log('DEBUG: Message missing content/author/channel, returning.'); // NEW LOG
            return;
        }
        if (message.author.bot) {
            console.log('DEBUG: Message from another bot, returning.'); // NEW LOG
            return;
        }
        if (!message.content.startsWith('!search')) {
            console.log('DEBUG: Message does not start with !search, returning.'); // NEW LOG
            return;
        }

        const query = message.content.substring(7).trim();
        if (!query) {
            console.log('DEBUG: No query provided, sending error message.'); // NEW LOG
            await message.channel.sendMessage('Please provide a search term. Example: `!search email@example.com`').catch(e => console.error('Error sending "no query" message:', e));
            return;
        }

        console.log(`DEBUG: Received search command for query: "\${query}"`);

        console.log('DEBUG: Attempting to send "Searching..." message...'); // NEW LOG
        await message.channel.sendMessage(`Searching for \`${query}\`... This may take a moment.`).catch(e => console.error('Error sending "Searching..." message:', e));
        console.log('DEBUG: "Searching..." message sent successfully.'); // NEW LOG

        console.log('DEBUG: Attempting to launch browser...'); // NEW LOG
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
        console.log('DEBUG: Browser launched successfully.'); // NEW LOG

        console.log('DEBUG: Attempting to create new page...'); // NEW LOG
        const page = await browser.newPage();
        console.log('DEBUG: New page created successfully.'); // NEW LOG

        console.log('DEBUG: Attempting to goto website...'); // NEW LOG
        await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2' });
        console.log('DEBUG: Navigated to website successfully.'); // NEW LOG

        console.log('DEBUG: Attempting to wait for search input selector...'); // NEW LOG
        await page.waitForSelector('#searchInput', { timeout: 10000 });
        console.log('DEBUG: Search input selector found.'); // NEW LOG

        console.log('DEBUG: Attempting to type query and press enter...'); // NEW LOG
        await page.type('#searchInput', query);
        await page.keyboard.press('Enter');
        console.log('DEBUG: Search submitted successfully.'); // NEW LOG

        console.log('DEBUG: Attempting to wait for results selector...'); // NEW LOG
        await page.waitForSelector('#results', { timeout: 15000 });
        console.log('DEBUG: Results selector found. Waiting 3 seconds for JS...'); // NEW LOG
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('DEBUG: Wait for JS is complete.'); // NEW LOG

        console.log('DEBUG: Attempting to find #results element...'); // NEW LOG
        const resultsElement = await page.$('#results');
        if (!resultsElement) {
            console.log('DEBUG: #results element not found on page.'); // NEW LOG
            await message.channel.sendMessage('Failed to fetch results. The website structure may have changed or no results were found.').catch(e => console.error('Error sending "Could not find #results" message:', e));
            return;
        }
        console.log('DEBUG: #results element found.'); // NEW LOG

        console.log('DEBUG: Attempting to evaluate page HTML...'); // NEW LOG
        const resultsHtml = await page.evaluate(el => el.innerHTML, resultsElement);
        console.log('DEBUG: Page HTML evaluated successfully.'); // NEW LOG
        console.log('--- START OF RESULTS HTML ---');
        console.log(resultsHtml);
        console.log('--- END OF RESULTS HTML ---');

        // --- The rest of the code (parsing, building embed, sending) is likely fine. ---
        // If the bot gets past this point, the issue is in the final logic.

        console.log('DEBUG: Attempting to parse results with Cheerio...'); // NEW LOG
        const $ = cheerio.load(resultsHtml);
        let breachSections = $('.breach-section');
        console.log(`DEBUG: Found \${breachSections.length} total breaches.`);

        if (breachSections.length === 0) {
            const embed = {
                title: 'Majic Breaches Search Results',
                description: `No results found for \`${query}\`.`,
                colour: '#FF0000'
            };
            console.log('DEBUG: Sending "no results" embed.'); // NEW LOG
            await message.channel.sendMessage({ embeds: [embed] }).catch(e => console.error('Error sending "no results" embed:', e));
        } else {
            console.log('DEBUG: Building results for embed and download...');
            const embedFields = [];
            const allResultLines = [];
            let resultCount = 0;
            breachSections.each((i, section) => {
                let dbName = $(section).find('h2, h3, .font-bold').first().text().trim();
                const cleanName = dbName.replace(/\s+/g, ' ').trim();
                if (cleanName) {
                    allResultLines.push(`--- ${cleanName} ---`);
                    $(section).find('tbody tr').each((j, row) => {
                        const rowData = $(row).find('td').map((k, cell) => $(cell).text().trim()).get().join(' | ');
                        if (rowData) allResultLines.push(rowData);
                    });
                    allResultLines.push('');
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

            console.log('DEBUG: Storing full results and generating download URL...');
            const allResultsText = allResultLines.join('\n');
            const resultId = require('crypto').randomBytes(8).toString('hex');
            resultsStore.set(resultId, { content: allResultsText });
            setTimeout(() => resultsStore.delete(resultId), 10 * 60 * 1000);
            const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;

            console.log('DEBUG: Building final embed object...');
            const embed = {
                title: 'Majic Breaches Search Results',
                description: `Found **\${breachSections.length}** breaches for \`${query}\`. Showing the first \${resultCount}.`,
                colour: '#00bfff',
                fields: embedFields
            };
            embed.fields.push({
                name: '📥 Download Full List',
                value: `[Click here for the complete data](\${downloadUrl})`,
                inline: false
            });

            console.log('DEBUG: Sending final embed with download link...');
            await message.channel.sendMessage({ embeds: [embed] }).catch(e => console.error('Error sending final embed:', e));
            console.log(`DEBUG: Results stored with ID: ${resultId}. Displayed ${resultCount} in embed.`);
        }
        } catch (error) {
        console.error('!!! PUPPETEER SEARCH ERROR !!!');
        console.error(error);
        console.log('DEBUG: Sending PUPPETEER ERROR message...');
        await message.channel.sendMessage('An error occurred while trying to fetch results. The website may be down or the search timed out.').catch(e => console.error('Error sending "PUPPETEER ERROR" message:', e));
    } finally {
        // --- Clean Up ---
        console.log('DEBUG: In top-level finally block. Closing browser and releasing lock.');
        if (browser) {
            await browser.close().catch(e => console.error('Error closing browser:', e));
            console.log('DEBUG: Browser closed.');
        }
        // --- Release the lock for this message ---
        messageLocks.delete(messageId);
        console.log(`DEBUG: Released lock for message ID: ${messageId}`);
    }
});

// --- Start the Bot ---
client.loginBot(BOT_TOKEN);
