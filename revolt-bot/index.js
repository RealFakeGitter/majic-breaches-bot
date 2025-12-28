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

// Connect to the WebSocket using the 'ws' library with a different auth method
const ws = new WebSocket('wss://events.stoat.chat?token=' + BOT_TOKEN);

// --- Event Listeners ---
ws.on('open', () => {
    console.log('WebSocket connection opened. Bot is now online.');
});

ws.on('message', async (data) => {
    try {
        const event = JSON.parse(data.toString());

        // We only care about Message events
        if (event.type !== 'Message') return;

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
            return api.post(`/channels/${message.channel}/messages`, {
                content: 'Please provide a search term. Example: `!search email@example.com`'
            });
        }

        // Let the user know the bot is working
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
        '--no-sandbox', // Add this
        '--disable-setuid-sandbox', // Add this
        '--disable-dev-shm-usage', // Critical for memory issues on Linux
        '--disable-gpu' // We don't need a GPU
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

          // --- Format and Send the Response ---
const embed = {
    title: 'Majic Breaches Search Results',
    colour: '#00bfff'
};
const $ = cheerio.load(resultsHtml);

console.log('Attempting to parse results...');
let breachSections = $('.breach-section');
console.log(`Selector '.breach-section' found: ${breachSections.length} elements.`);

const fields = [];
let resultCount = 0;

// Use a try/catch inside the loop to prevent one bad result from crashing the whole thing
// --- THIS IS THE NEW, SIMPLER BLOCK ---
breachSections.each((i, section) => {
    if (resultCount >= 10) return false;
    try {
        let dbName = $(section).find('h2').first().text().trim();
        if (!dbName) dbName = $(section).find('h3').first().text().trim();
        if (!dbName) dbName = $(section).find('.font-bold').first().text().trim();
        if (dbName) {
            const cleanName = dbName.replace(/\s+/g, ' ').trim();
            if (cleanName) {
                // ABSOLUTE MINIMUM
                fields.push({
                    name: cleanName,
                    value: 'Found'
                });
                resultCount++;
            }
        }
    } catch (fieldError) {
        console.error(`Error processing field ${i}:`, fieldError);
    }
});
console.log(`Successfully built ${resultCount} fields.`);

if (resultCount === 0) {
    embed.description = `No results found for \`${query}\`.`;
    embed.colour = '#FF0000';
} else {
    embed.description = `Found ${resultCount} results for: \`${query}\``;
    embed.fields = fields;
}

// --- Send the Final Message ---
console.log('Preparing to send final message...');
try {
    const payload = { embeds: [embed] };
    // Log the FINAL payload just before it's sent
    console.log('Payload being sent:', JSON.stringify(payload, null, 2));
    await api.post(`/channels/${message.channel}/messages`, payload);
    console.log('!!! API CALL COMPLETED SUCCESSFULLY !!!');
} catch (finalMessageError) {
    console.error('!!! FAILED TO SEND EMBED !!!');
    console.error(finalMessageError.response?.data || finalMessageError); // Log the error response from Revolt if available
}
        } catch (error) {
            console.error('!!! PUPPETEER SEARCH ERROR !!!');
            console.error(error);
            // Send a user-friendly error message
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
        console.error('!!! WEBSOCKET MESSAGE ERROR !!!');
        console.error(err);
    }
});

ws.on('error', (err) => {
    console.error('!!! WEBSOCKET ERROR !!!');
    console.error(err);
});

ws.on('close', (code, reason) => {
    console.log(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
});
