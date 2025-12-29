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

// --- Configuration ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';
const WS_URL = `wss://events.stoat.chat?token=${BOT_TOKEN}`;

// --- Initialize API ---
const api = new API({
    baseURL: "https://api.stoat.chat",
    authentication: {
        revolt: BOT_TOKEN
    }
});

// --- State variables ---
let isProcessing = false;
let ws;
let pingInterval;
let reconnectAttempts = 0;
const MAX_BACKOFF = 60000; // 60 seconds max
const processedMessageIds = new Set(); // For deduplication

// --- WebSocket connection handler ---
function connectWebSocket() {
    console.log('Connecting to Revolt WebSocket...');
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('WebSocket connection opened. Bot is now online.');
        reconnectAttempts = 0;

        // Send ping every 30 seconds to keep connection alive
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log('Sending keep-alive ping...');
                ws.ping();
            }
        }, 30000);
    });

    ws.on('pong', () => {
        console.log('Received pong — connection healthy.');
    });

    ws.on('message', async (data) => {
        try {
            const event = JSON.parse(data.toString());

            // --- Deduplicate by message ID (critical for Revolt duplicates) ---
            if (event.type === 'Message' && event._id) {
                if (processedMessageIds.has(event._id)) {
                    console.log(`Duplicate message ignored (ID: ${event._id})`);
                    return;
                }
                processedMessageIds.add(event._id);
                setTimeout(() => processedMessageIds.delete(event._id), 10000); // Clean up after 10s
            }

            if (isProcessing) {
                console.log('Already processing a command, skipping...');
                return;
            }
            isProcessing = true;

            // --- Only handle new messages with !search ---
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

            console.log(`Searching for: "${query}"`);

            await api.post(`/channels/${message.channel}/messages`, {
                content: `Searching for \`${query}\`... This may take a moment.`
            }).catch(err => console.error('Failed to send searching message:', err));

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

                await page.waitForSelector('#searchInput', { timeout: 10000 });
                await page.type('#searchInput', query);
                await page.keyboard.press('Enter');

                await page.waitForSelector('#results', { timeout: 15000 });
                await new Promise(resolve => setTimeout(resolve, 5000));

                const resultsElement = await page.$('#results');
                if (!resultsElement) {
                    await api.post(`/channels/${message.channel}/messages`, {
                        content: 'Failed to fetch results. Website structure may have changed.'
                    });
                    return;
                }

                const resultsHtml = await page.evaluate(el => el.innerHTML, resultsElement);

                const $ = cheerio.load(resultsHtml);
                const breachSections = $('.breach-section');
                console.log(`Found ${breachSections.length} breach sections.`);

                const previewLines = [];
                let previewCount = 0;
                const fullResultLines = [];

                breachSections.each((i, section) => {
                    try {
                        let dbName = $(section).find('h2').first().text().trim() ||
                                    $(section).find('h3').first().text().trim() ||
                                    $(section).find('.font-bold').first().text().trim();
                        if (!dbName) return;

                        const cleanName = dbName.replace(/\s+/g, ' ').trim();

                        // Preview: first row only, max 10 breaches
                        if (previewCount < 10) {
                            const firstRow = $(section).find('tbody tr').first();
                            const rowData = firstRow.find('td').map((_, cell) => $(cell).text().trim()).get().join(' | ');
                            let line = `**${cleanName}**`;
                            if (rowData) {
                                line += `\n\`${rowData.substring(0, 150)}${rowData.length > 150 ? '...' : ''}\``;
                            }
                            previewLines.push(line);
                            previewCount++;
                        }

                        // Full results: all rows, all breaches
                        fullResultLines.push(`--- ${cleanName} ---`);
                        $(section).find('tbody tr').each((_, row) => {
                            const rowData = $(row).find('td').map((_, cell) => $(cell).text().trim()).get().join(' | ');
                            if (rowData) fullResultLines.push(rowData);
                        });
                        fullResultLines.push('');
                    } catch (err) {
                        console.error(`Error processing section ${i}:`, err);
                    }
                });

                const allResultsText = fullResultLines.join('\n');

                // Send preview embed
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

                await api.post(`/channels/${message.channel}/messages`, { embeds: [embed] });

                // Send download link if results exist
                if (breachSections.length > 0) {
                    const resultId = require('crypto').randomBytes(8).toString('hex');
                    resultsStore.set(resultId, { content: allResultsText });

                    setTimeout(() => resultsStore.delete(resultId), 10 * 60 * 1000); // Expire in 10 min

                    const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;
                    const linkMsg = `**Full results download** (${breachSections.length} breach${breachSections.length === 1 ? '' : 'es'}):\n${downloadUrl}`;

                    await api.post(`/channels/${message.channel}/messages`, { content: linkMsg });
                    console.log(`Download link sent: ${resultId}`);
                }

            } catch (error) {
                console.error('Puppeteer error:', error);
                await api.post(`/channels/${message.channel}/messages`, {
                    content: 'An error occurred while searching. The site may be down or timed out.'
                }).catch(() => {});
            } finally {
                if (browser) await browser.close();
            }
        } catch (err) {
            console.error('Message handler error:', err);
        } finally {
            isProcessing = false;
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
        clearInterval(pingInterval);

        if (code !== 1000) { // Not normal closure
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_BACKOFF);
            reconnectAttempts++;
            console.log(`Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts})`);
            setTimeout(connectWebSocket, delay);
        }
    });
}

// Start the bot
connectWebSocket();
