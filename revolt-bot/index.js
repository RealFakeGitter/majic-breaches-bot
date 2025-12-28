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
        const message = JSON.parse(data.toString());

        // We only care about Message events
        if (message.type !== 'Message') return;

        // Ignore messages from bots
        if (message.author.bot) return;

        // Check for the command
        if (!message.content.startsWith('!search')) return;

        const query = message.content.substring(7).trim();
        if (!query) {
            return api.post(`/channels/${message.channel}/messages`, {
                content: 'Please provide a search term. Example: `!search email@example.com`'
            });
        }

        // Let the user know the bot is working
        await api.post(`/channels/${message.channel}/messages`, {
            content: `Searching for \`${query}\`... This may take a moment.`
        });
        console.log(`Received search command for query: "${query}"`);

        let browser;
        try {
            // --- Launch Puppeteer Browser ---
            browser = await puppeteer.launch({
                executablePath: await chromium.executablePath(),
                args: chromium.args,
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
    await api.post(`/channels/${message.channel}/messages`, { content: 'Failed to fetch results. The website structure may have changed or no results were found.' });
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
                description: `Results for: \`${query}\``,
                colour: '#00bfff'
            };

            const $ = cheerio.load(resultsHtml);
            
            // --- TRY MULTIPLE SELECTORS ---
console.log('Attempting to parse results...');
let breachSections = $('.breach-section'); // Original selector
console.log(`Selector '.breach-section' found: ${breachSections.length} elements.`);
if (breachSections.length === 0) {
    console.log('Original selector failed, trying .card...');
    breachSections = $('.card');
    console.log(`Selector '.card' found: ${breachSections.length} elements.`);
}
if (breachSections.length === 0) {
    console.log('Trying .result...');
    breachSections = $('.result');
    console.log(`Selector '.result' found: ${breachSections.length} elements.`);
}
if (breachSections.length === 0) {
    console.log('Trying .panel...');
    breachSections = $('.panel');
    console.log(`Selector '.panel' found: ${breachSections.length} elements.`);
}
if (breachSections.length === 0) {
    console.log('Trying .p-4.mb-4.rounded.border...');
    breachSections = $('.p-4.mb-4.rounded.border');
    console.log(`Selector '.p-4.mb-4.rounded.border' found: ${breachSections.length} elements.`);
}
console.log(`Final count of potential result sections: ${breachSections.length}.`);
                       let resultCount = 0;
            // NEW CODE - MUCH SMALLER
// NEW CODE - DRASTICALLY SMALLER
const fields = [];
try {
    breachSections.each((i, section) => {
        if (resultCount >= 10) return false; // *** DRASTICALLY REDUCED LIMIT ***
        let dbName = $(section).find('h2').first().text().trim();
        if (!dbName) dbName = $(section).find('h3').first().text().trim();
        if (!dbName) dbName = $(section).find('.font-bold').first().text().trim();
        if (dbName) {
            fields.push({ name: `🔓 ${dbName}`, value: `Found in database.`, inline: false });
            resultCount++;
        }
    });
} catch (embedError) {
    console.error('!!! ERROR WHILE BUILDING EMBED FIELDS !!!');
    console.error(embedError);
    console.log('A single bad result was skipped to prevent a crash.');
}
            if (resultCount === 0) {
                embed.description = `No results found for \`${query}\`. The website may have changed.`;
                embed.colour = '#FF0000';
            } else {
                embed.fields = fields;
            }

                        // --- File Upload Section ---
            // File upload is currently failing on Revolt's end (502 Bad Gateway).
            // We will skip the upload to ensure the main results are still delivered.
            const attachments = []; // Always empty until the file upload is fixed.
            console.log('Skipping file upload due to known API issues.');

           // Send the final message
console.log('Preparing to send final message...');
await api.post(`/channels/${message.channel}/messages`, { content: resultCount > 0 ? "Here are your results." : "", embeds: [embed], attachments: attachments })
    .catch(finalMessageError => {
        console.error('!!! FAILED TO SEND FINAL MESSAGE !!!');
        console.error('This is the real error. The API call to send the message failed.');
        console.error(finalMessageError);
    });
console.log('Final message API call has finished (either succeeded or failed).');

        } catch (error) {
            console.error('!!! PUPPETEER SEARCH ERROR !!!');
            console.error(error);
            // Send a user-friendly error message
            await api.post(`/channels/${message.channel}/messages`, {
                content: 'An error occurred while trying to fetch results. The website may be down or the search timed out.'
            });

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
