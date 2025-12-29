// --- Mini Web Server for Render Health Check ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
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

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// --- Dependencies ---
const { API } = require('revolt-api');
const WebSocket = require('ws');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');

// --- Config ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';
const WS_URL = `wss://events.stoat.chat?token=${BOT_TOKEN}`;

const api = new API({
    baseURL: "https://api.stoat.chat",
    authentication: { revolt: BOT_TOKEN }
});

// --- State ---
let isProcessing = false;
let ws;
let pingInterval;
let reconnectAttempts = 0;
const MAX_BACKOFF = 60000;

// --- Strong deduplication: track recent commands by user + channel + query ---
const recentCommands = new Map(); // key: `${author}_${channel}_${queryHash}`, value: timestamp

function getCommandKey(author, channel, query) {
    const normalized = query.toLowerCase().trim();
    return `${author}_${channel}_${normalized}`;
}

// --- WebSocket ---
function connectWebSocket() {
    console.log('Connecting to Revolt...');
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('✅ Bot online');
        reconnectAttempts = 0;
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, 30000);
    });

    ws.on('pong', () => { /* keep alive */ });

    ws.on('message', async (data) => {
        try {
            const event = JSON.parse(data.toString());

            if (event.type !== 'Message') return;
            if (!event.content || !event.author || !event.channel || event.author.bot) return;
            if (!event.content.startsWith('!search')) return;

            const message = event;
            const query = message.content.substring(7).trim();
            if (!query) return;

            // --- Bulletproof deduplication ---
            const cmdKey = getCommandKey(message.author, message.channel, query);
            const now = Date.now();
            const recent = recentCommands.get(cmdKey);

            if (recent && (now - recent < 15000)) { // Same command in last 15 seconds
                console.log(`🛡️ Blocked duplicate/triplicate command: "${query}" from ${message.author}`);
                return;
            }
            recentCommands.set(cmdKey, now);

            // Optional: clean old entries
            if (recentCommands.size > 1000) recentCommands.clear();

            if (isProcessing) {
                console.log('Busy, skipping...');
                return;
            }
            isProcessing = true;

            console.log(`Search: "${query}" from ${message.author}`);

            await api.post(`/channels/${message.channel}/messages`, {
                content: `Searching for \`${query}\`... This may take a moment.`
            }).catch(() => {});

            let browser;
            try {
                browser = await puppeteer.launch({
                    executablePath: await chromium.executablePath(),
                    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                    headless: chromium.headless,
                });

                const page = await browser.newPage();
                await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2' });
                await page.waitForSelector('#searchInput', { timeout: 10000 });
                await page.type('#searchInput', query);
                await page.keyboard.press('Enter');
                await page.waitForSelector('#results', { timeout: 15000 });
                await new Promise(r => setTimeout(r, 5000));

                const resultsElement = await page.$('#results');
                if (!resultsElement) {
                    await api.post(`/channels/${message.channel}/messages`, { content: 'No results element found.' });
                    return;
                }

                const resultsHtml = await page.evaluate(el => el.innerHTML, resultsElement);
                const $ = cheerio.load(resultsHtml);
                const breachSections = $('.breach-section');

                const previewLines = [];
                let previewCount = 0;
                const fullResultLines = [];

                breachSections.each((i, section) => {
                    try {
                        let dbName = $(section).find('h2, h3, .font-bold').first().text().trim();
                        if (!dbName) return;
                        const cleanName = dbName.replace(/\s+/g, ' ').trim();

                        if (previewCount < 10) {
                            const firstRow = $(section).find('tbody tr').first();
                            const rowData = firstRow.find('td').map((_, c) => $(c).text().trim()).get().join(' | ');
                            let line = `**${cleanName}**`;
                            if (rowData) line += `\n\`${rowData.substring(0, 150)}${rowData.length > 150 ? '...' : ''}\``;
                            previewLines.push(line);
                            previewCount++;
                        }

                        fullResultLines.push(`--- ${cleanName} ---`);
                        $(section).find('tbody tr').each((_, row) => {
                            const rowData = $(row).find('td').map((_, c) => $(c).text().trim()).get().join(' | ');
                            if (rowData) fullResultLines.push(rowData);
                        });
                        fullResultLines.push('');
                    } catch (e) {}
                });

                const allResultsText = fullResultLines.join('\n');

                const embed = {
                    title: 'Majic Breaches Search Results',
                    colour: breachSections.length === 0 ? '#FF0000' : '#00bfff',
                    description: breachSections.length === 0
                        ? `No results found for \`${query}\`.`
                        : `Found **${breachSections.length}** result${breachSections.length === 1 ? '' : 's'} for \`${query}\`\n\n${previewLines.join('\n\n')}`
                };

                await api.post(`/channels/${message.channel}/messages`, { embeds: [embed] });

                if (breachSections.length > 0) {
                    const resultId = require('crypto').randomBytes(8).toString('hex');
                    resultsStore.set(resultId, { content: allResultsText });
                    setTimeout(() => resultsStore.delete(resultId), 600000);

                    const downloadUrl = `https://majic-breaches-revolt-bot.onrender.com/results/${resultId}`;
                    await api.post(`/channels/${message.channel}/messages`, {
                        content: `**Full results download** (${breachSections.length} breach${breachSections.length === 1 ? '' : 'es'}):\n${downloadUrl}`
                    });
                }

            } catch (error) {
                console.error('Search failed:', error);
                await api.post(`/channels/${message.channel}/messages`, {
                    content: 'Search failed — site may be down or timed out.'
                }).catch(() => {});
            } finally {
                if (browser) await browser.close();
                isProcessing = false;
            }
        } catch (err) {
            console.error('Message handler error:', err);
            isProcessing = false;
        }
    });

    ws.on('close', (code) => {
        console.log(`WebSocket closed (code ${code}) — reconnecting...`);
        clearInterval(pingInterval);
        if (code !== 1000) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), MAX_BACKOFF);
            setTimeout(connectWebSocket, delay);
        }
    });

    ws.on('error', (err) => console.error('WS error:', err));
}

connectWebSocket();
