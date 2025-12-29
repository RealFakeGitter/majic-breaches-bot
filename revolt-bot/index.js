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

// --- Config ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';
const WS_URL = `wss://events.stoat.chat?token=${BOT_TOKEN}`;

const api = new API({
    baseURL: "https://api.stoat.chat",
    authentication: { revolt: BOT_TOKEN }
});

// --- Strong deduplication ---
const seenMessageIds = new Set(); // Block instant duplicates by ID
const lastCommandTime = new Map(); // Block delayed duplicates (60s cooldown)

let ws;
let pingInterval;
let reconnectAttempts = 0;
const MAX_BACKOFF = 60000;

function connectWebSocket() {
    console.log('Connecting to Stoat events...');
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('✅ Connected and online');
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

            const msgId = event._id || 'unknown';

            // --- Block by message ID ---
            if (seenMessageIds.has(msgId)) {
                console.log(`🚫 BLOCKED INSTANT DUPLICATE - Message ID: ${msgId}`);
                return;
            }
            seenMessageIds.add(msgId);
            setTimeout(() => seenMessageIds.delete(msgId), 120000); // Cleanup after 2 min

            const userId = event.author;
            const channelId = event.channel;
            const rateKey = `${userId}_${channelId}`;
            const now = Date.now();

            // --- Block by rate limit ---
            if (lastCommandTime.has(rateKey) && (now - lastCommandTime.get(rateKey) < 60000)) {
                console.log(`🚫 BLOCKED DELAYED DUPLICATE - User: ${userId} in Channel: ${channelId} (within 60s)`);
                return;
            }
            lastCommandTime.set(rateKey, now);

            console.log(`✅ Processing unique !search from user ${userId} (Msg ID: ${msgId})`);

            const query = event.content.substring(7).trim();
            if (!query) return;

            await api.post(`/channels/${channelId}/messages`, { content: `Searching for \`${query}\`... This may take a moment.` });

            // ... [rest of your search logic unchanged - puppeteer, scraping, embed, download link] ...

            // (I've omitted the long search block here for brevity - copy it from previous version)

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
