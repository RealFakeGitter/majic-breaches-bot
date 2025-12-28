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
                await api.post(`/channels/${message.channel}/messages`, {
                    content: 'Failed to fetch results. The website structure may have changed or no results were found.'
                });
                return;
            }

            const resultsHtml = await page.$eval('#results', el => el.innerHTML);
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
            let breachSections = $('.breach-section'); // Original selector
            if (breachSections.length === 0) {
                console.log('Original selector .breach-section failed, trying alternatives...');
                breachSections = $('.card'); // Common alternative
            }
            if (breachSections.length === 0) {
                breachSections = $('.result'); // Another common alternative
            }
            if (breachSections.length === 0) {
                breachSections = $('.panel'); // Another common alternative
            }
            if (breachSections.length === 0) {
                breachSections = $('.p-4.mb-4.rounded.border'); // A common Tailwind class pattern
            }
            
            console.log(`Found \${breachSections.length} potential result sections.`);

            let resultCount = 0;
            const fields = [];

            breachSections.each((i, section) => {
                if (resultCount >= 10) return false;

                // Try multiple selectors for the database name
                let dbName = $(section).find('h2').first().text().trim();
                if (!dbName) dbName = $(section).find('h3').first().text().trim();
                if (!dbName) dbName = $(section).find('.font-bold').first().text().trim();

                // Try multiple selectors for the description
                let description = $(section).find('p').first().text().trim();
                if (!description) description = $(section).find('.text-sm').first().text().trim();

                const firstRow = $(section).find('tbody tr').first();

                if (dbName && description) { // Changed condition to be more flexible
                    const rowData = $(firstRow).find('td').map((i, el) => $(el).text().trim()).get().join(' | ');
                    const cleanDescription = description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    
                    let fieldText = cleanDescription;
                    if (rowData) {
                        fieldText += `\n\n**Sample Data:**\n\`\`\`${rowData.substring(0, 900)}\`\`\``;
                    }
                    fields.push({
                        name: `🔓 \${dbName}`,
                        value: fieldText.substring(0, 1024),
                        inline: false
                    });
                    resultCount++;
                }
            });

            if (resultCount === 0) {
                embed.description = `No results found for \`${query}\`. The website may have changed.`;
                embed.colour = '#FF0000';
            } else {
                embed.fields = fields;
            }

            // --- Prepare and send the file attachment ---
            let attachments = [];
            if (resultCount > 0) {
                let fileContent = `Majic Breaches Search Results for: ${query}\n`;
                fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
                fileContent += '==================================================\n\n';

                // Use the same resilient selector for the file generation
                const allBreachSections = breachSections;
                allBreachSections.each((i, section) => {
                    let dbName = $(section).find('h2').first().text().trim();
                    if (!dbName) dbName = $(section).find('h3').first().text().trim();
                    if (!dbName) dbName = $(section).find('.font-bold').first().text().trim();

                    let description = $(section).find('p').first().text().trim();
                    if (!description) description = $(section).find('.text-sm').first().text().trim();
                    
                    const rows = $(section).find('tbody tr');
                    
                    fileContent += `--- Database: ${dbName} ---\n`;
                    fileContent += `${description}\n\n`;

                    if (rows.length > 0) {
                        const headers = $(section).find('thead th').map((i, el) => $(el).text().trim()).get();
                        fileContent += headers.join('\t') + '\n';
                        fileContent += '----------------------------------------\n';
                        
                        rows.each((j, row) => {
                            const rowData = $(row).find('td').map((k, el) => $(el).text().trim()).get().join('\t');
                            fileContent += rowData + '\n';
                        });
                    } else {
                        fileContent += 'No data found in this entry.\n';
                    }
                    fileContent += '\n==================================================\n\n';
                });

                const buffer = Buffer.from(fileContent, 'utf-8');
                const fileSizeInMB = buffer.length / (1024 * 1024);
                if (fileSizeInMB > 20) {
                    console.log(`File is too large (${fileSizeInMB.toFixed(2)}MB), skipping attachment.`);
                } else {
                    const fileName = `majic_results_${query.replace(/[^^a-z0-9]/gi, '_').toLowerCase()}.txt`;

                    try {
                        const { id } = await api.post('/attachments/upload', {
                            files: [{
                                filename: fileName,
                                content: buffer.toString('base64'),
                            }]
                        });
                        attachments = [id];
                    } catch (uploadError) {
                        console.error('!!! FILE UPLOAD ERROR !!!');
                        console.error(uploadError);
                    }
                }
            }

            // Send the final message
            await api.post(`/channels/\${message.channel}/messages`, {
                content: resultCount > 0 ? "Here are your results." : "",
                embeds: [embed],
                attachments: attachments
            });

        } catch (error) {
            console.error('!!! PUPPETEER SEARCH ERROR !!!');
            console.error(error);
