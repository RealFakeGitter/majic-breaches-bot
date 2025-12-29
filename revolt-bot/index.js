// --- Mini Web Server for Render Health Check ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
console.log(`Attempting to start health check server on port ${PORT}...`);
app.get('/health', (req, res) => {
    console.log('Health check endpoint was hit.');
    res.status(200).send('OK');
});

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

const { API } = require('revolt-api');
const WebSocket = require('ws');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const axios = require('axios');

// --- Configuration ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';
const WS_URL = 'wss://events.stoat.chat?token=' + BOT_TOKEN;

// --- Initialize API ---
const api = new API({
    baseURL: "https://api.stoat.chat",
    authentication: {
        revolt: BOT_TOKEN
    }
});

let isProcessing = false;
let ws;
let pingInterval;
let reconnectAttempts = 0;
const MAX_BACKOFF = 60000; // 1 min max wait

// --- Function to connect/reconnect WebSocket ---
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('WebSocket connection opened. Bot is now online.');
        reconnectAttempts = 0; // Reset on success

        // Start sending pings every 30s to keep alive
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log('Sending keep-alive ping...');
                ws.ping();
            }
        }, 30000);
    });

    ws.on('pong', () => {
        console.log('Received pong from server. Connection healthy.');
    });

    ws.on('message', async (data) => {
        try {
            if (isProcessing) {
                console.log('Duplicate message detected, ignoring...');
                return;
            }
            isProcessing = true;

            const event = JSON.parse(data.toString());
            if (event.type !== 'Message') return;
            if (!event.content || !event.author || !event.channel) return;
            if (event.author.bot) return;
            if (!event.content.startsWith('!search')) return;

            const message = event;
            const query = message.content.substring(7).trim();

            if (!query) {
                return api.post(`/channels/${message.channel}/messages`, {
                    content: 'Please provide a search term. Example: `!search email@example.com`'
                });
            }

            console.log('Attempting to send "Searching..." message...');
            await api.post(`/channels/${message.channel}/messages`, { 
                content: `Searching for \`${query}\`... This may take a moment.` 
            }).catch(e => console.error('Error sending "Searching..." message:', e));

            console.log(`Received search command for query: "${query}"`);

            let browser;
            try {
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

                await page.waitForSelector('#searchInput', { timeout: 10000 });
                await page.type('#searchInput', query);
                await page.keyboard.press('Enter');
                console.log('Search submitted, waiting for results...');
                await page.waitForSelector('#results', { timeout: 15000 });
                await new Promise(resolve => setTimeout(resolve, 5000));

                const resultsElement = await page.$('#results');
                if (!resultsElement) {
                    console.log('Could not find the #results element on the page.');
                    await api.post(`/channels/${message.channel}/messages`, { 
                        content: 'Failed to fetch results. The website structure may have changed or no results were found.' 
                    }).catch(e => console.error('Error sending message:', e));
                    return;
                }

                const resultsHtml = await page.evaluate(el => el.innerHTML, resultsElement);
                console.log('--- START OF RESULTS HTML ---');
                console.log(resultsHtml);
                console.log('--- END OF RESULTS HTML ---');

                // --- Load with Cheerio ---
                const $ = cheerio.load(resultsHtml);
                let breachSections = $('.breach-section');
                console.log(`Found ${breachSections.length} total breach sections.`);

                // --- Build preview lines (max 10) ---
                const previewLines = [];
                let previewCount = 0;

                // --- Build full results text (no limit) ---
                const fullResultLines = [];

                breachSections.each((i, section) => {
                    try {
                        let dbName = $(section).find('h2').first().text().trim();
                        if (!dbName) dbName = $(section).find('h3').first().text().trim();
                        if (!dbName) dbName = $(section).find('.font-bold').first().text().trim();
                        if (!dbName) return;

                        const cleanName = dbName.replace(/\s+/g, ' ').trim();

                        // --- For preview (only first 10) ---
                        if (previewCount < 10) {
                            const firstRow = $(section).find('tbody tr').first();
                            const rowData = firstRow.find('td').map((j, cell) => $(cell).text().trim()).get().join(' | ');
                            let previewLine = `**${cleanName}**`;
                            if (rowData) {
                                previewLine += `\n\`${rowData.substring(0, 150)}${rowData.length > 150 ? '...' : ''}\``;
                            }
                            previewLines.push(previewLine);
                            previewCount++;
                        }

                        // --- For full download (all rows, all breaches) ---
                        fullResultLines.push(`--- ${cleanName} ---`);
                        $(section).find('tbody tr').each((j, row) => {
                            const rowData = $(row).find('td').map((k, cell) => $(cell).text().trim()).get().join(' | ');
                            if (rowData) {
                                fullResultLines.push(rowData);
                            }
                        });
                        fullResultLines.push(''); // blank line separator

                    } catch (err) {
                        console.error(`Error processing breach section ${i}:`, err);
                    }
                });

                const allResultsText = fullResultLines.join('\n');

                // --- Build and send the preview embed ---
                const embed = {
                    title: 'Majic Breaches Search Results',
                    colour: '#00bfff'
                };

                if (previewCount === 0) {
                    embed.description = `No results found for \`${query}\`.`;
                    embed.colour = '#FF0000';
                } else {
                    embed.description = `Found **${breachSections.length}** result${breachSections.length === 1 ? '' : 's'} for \`${query}\`\n\n${previewLines.join('\n\n')}`;
                }

                console.log('Sending preview embed...');
                await api.post(`/channels/${message.channel}/messages`, { embeds: [embed] });

                // --- If there are results, store full data and send download link ---
                if (breachSections.length > 0) {
                    const resultId = require('crypto').randomBytes(8).toString('hex');
                    resultsStore.set(resultId, { content: allResultsText });

                    // Auto-delete after 10 minutes
                    setTimeout(() => resultsStore.delete(resultId), 10 * 60 * 1000);

                    const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;

                    const linkMessage = `**Full results download** (${breachSections.length} breach${breachSections.length === 1 ? '' : 'es'}):\n${downloadUrl}`;

                    await api.post(`/channels/${message.channel}/messages`, { content: linkMessage });
                    console.log(`Full results stored and download link sent: ${resultId}`);
                }

            } catch (error) {
                console.error('!!! PUPPETEER SEARCH ERROR !!!');
                console.error(error);
                await api.post(`/channels/${message.channel}/messages`, { 
                    content: 'An error occurred while trying to fetch results. The website may be down or the search timed out.' 
                }).catch(e => console.error('Error sending error message:', e));
            } finally {
                if (browser) {
                    await browser.close();
                    console.log('Browser closed.');
                }
            }
        } catch (err) {
            console.error('!!! WEBSOCKET MESSAGE ERROR !!!');
            console.error(err);
        } finally {
            isProcessing = false;
        }
    });

    ws.on('error', (err) => {
        console.error('!!! WEBSOCKET ERROR !!!');
        console.error(err);
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
        clearInterval(pingInterval); // Stop pings

        if (code !== 1000) { // Not a normal closure? Reconnect
            console.log('!!! Abnormal close detected. Attempting reconnect...');
            const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_BACKOFF);
            reconnectAttempts++;
            setTimeout(connectWebSocket, backoff);
        }
    });
}

// Initial connection
connectWebSocket();
