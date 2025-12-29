// --- Mini Web Server ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.status(200).send('OK'));

const resultsStore = new Map();

app.get('/results/:id', (req, res) => {
    const data = resultsStore.get(req.params.id);
    if (!data) return res.status(404).send('Not found or expired');
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="majic-results-${req.params.id}.txt"`);
    res.send(data.content);
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));

// --- Dependencies ---
const { API } = require('revolt-api');
const WebSocket = require('ws');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const crypto = require('crypto');

// --- Config ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';
const WS_URL = `wss://events.stoat.chat?token=${BOT_TOKEN}`;

const api = new API({
    baseURL: "https://api.stoat.chat",
    authentication: { revolt: BOT_TOKEN }
});

// --- Deduplication: seen message IDs + rate limit per user/channel ---
const seenMessageIds = new Set(); // Instant dup blocker
const lastCommandTime = new Map(); // key: userId_channelId → timestamp (delayed dup blocker)

let ws;
let pingInterval;
let reconnectAttempts = 0;
const MAX_BACKOFF = 60000;

function connectWebSocket() {
    console.log('Connecting to Stoat...');
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('✅ Bot online');
        reconnectAttempts = 0;
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 30000);
    });

    ws.on('message', async (data) => {
        try {
            const event = JSON.parse(data.toString());

            if (event.type !== 'Message') return;
            if (!event.content || !event.author || !event.channel || event.author.bot) return;
            if (!event.content.startsWith('!search')) return;

            // --- Instant dedup by message ID ---
            if (event._id && seenMessageIds.has(event._id)) {
                console.log(`Blocked instant duplicate (ID: ${event._id})`);
                return;
            }
            if (event._id) {
                seenMessageIds.add(event._id);
                setTimeout(() => seenMessageIds.delete(event._id), 60000); // Cleanup after 1 min
            }

            const userId = event.author;
            const channelId = event.channel;
            const rateKey = `${userId}_${channelId}`;
            const now = Date.now();

            // --- Rate limit: 1 command per 60 seconds per user per channel ---
            if (lastCommandTime.has(rateKey) && (now - lastCommandTime.get(rateKey) < 60000)) {
                console.log(`Rate limited user ${userId} in channel ${channelId}`);
                return;
            }
            lastCommandTime.set(rateKey, now);

            const query = event.content.substring(7).trim();
            if (!query) return;

            console.log(`Processing search: "${query}" from user ${userId}`);

            await api.post(`/channels/${channelId}/messages`, {
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

                const resultsHtml = await page.evaluate(() => document.querySelector('#results')?.innerHTML || '');
                const $ = cheerio.load(resultsHtml);
                const breachSections = $('.breach-section');

                const previewLines = [];
                let previewCount = 0;
                const fullLines = [];

                breachSections.each((i, section) => {
                    const dbName = $(section).find('h2, h3, .font-bold').first().text().trim();
                    if (!dbName) return;
                    const cleanName = dbName.replace(/\s+/g, ' ').trim();

                    if (previewCount < 10) {
                        const rowData = $(section).find('tbody tr').first().find('td').map((_, c) => $(c).text().trim()).get().join(' | ');
                        let line = `**${cleanName}**`;
                        if (rowData) line += `\n\`${rowData.substring(0, 150)}${rowData.length > 150 ? '...' : ''}\``;
                        previewLines.push(line);
                        previewCount++;
                    }

                    fullLines.push(`--- ${cleanName} ---`);
                    $(section).find('tbody tr').each((_, row) => {
                        const cells = $(row).find('td').map((_, c) => $(c).text().trim()).get().join(' | ');
                        if (cells) fullLines.push(cells);
                    });
                    fullLines.push('');
                });

                const embed = {
                    title: 'Majic Breaches Search Results',
                    colour: breachSections.length ? '#00bfff' : '#FF0000',
                    description: breachSections.length
                        ? `Found **${breachSections.length}** result${breachSections.length === 1 ? '' : 's'} for \`${query}\`\n\n${previewLines.join('\n\n')}`
                        : `No results found for \`${query}\`.`
                };

                await api.post(`/channels/${channelId}/messages`, { embeds: [embed] });

                if (breachSections.length > 0) {
                    const id = crypto.randomBytes(8).toString('hex');
                    resultsStore.set(id, { content: fullLines.join('\n') });
                    setTimeout(() => resultsStore.delete(id), 600000);

                    await api.post(`/channels/${channelId}/messages`, {
                        content: `**Full results download** (${breachSections.length} breach${breachSections.length === 1 ? '' : 'es'}):\nhttps://majic-breaches-revolt-bot.onrender.com/results/${id}`
                    });
                }

            } catch (err) {
                console.error('Search error:', err);
                await api.post(`/channels/${channelId}/messages`, { content: 'Search failed — try again later.' }).catch(() => {});
            } finally {
                if (browser) await browser.close();
            }
        } catch (err) {
            console.error('Handler error:', err);
        }
    });

    ws.on('close', (code) => {
        console.log(`Closed (${code}) — reconnecting...`);
        clearInterval(pingInterval);
        if (code !== 1000) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), MAX_BACKOFF);
            setTimeout(connectWebSocket, delay);
        }
    });

    ws.on('error', (err) => console.error('WS error:', err));
}

connectWebSocket();
