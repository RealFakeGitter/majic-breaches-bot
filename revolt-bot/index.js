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


// --- TEMPORARY SIMPLE MESSAGE HANDLER ---
client.on('message', async (message) => {
    console.log('DEBUG: Raw message object received:', message); // This will log the entire message object
    if (message.content && message.content === '!ping') {
        console.log('DEBUG: !ping command detected!');
        await message.channel.sendMessage('Pong!').catch(e => console.error('Error sending pong:', e));
    }
});

// --- Start the Bot ---
client.loginBot(BOT_TOKEN);
