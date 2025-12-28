const { Client } = require('revolt.js');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios'); // Needed for file uploads

// --- Configuration ---
const BOT_TOKEN = process.env.REVOLT_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';

// --- Initialize Client ---
const client = new Client({
    intents: ['Messages', 'MessageContent']
});

// Use the Stoat.chat URLs
client.api.options.baseURL = "https://api.stoat.chat";
client.api.options.wsURL = "wss://events.stoat.chat";

// --- Event Listeners ---
client.once('ready', () => {
    console.log(`Logged in as ${client.user.username}!`);
    console.log('Revolt bot is ready to receive search commands.');
});

client.on('message', async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check for the command
    if (!message.content.startsWith('!search')) return;

    const query = message.content.substring(7).trim();
    if (!query) {
        return message.reply('Please provide a search term. Example: `!search email@example.com`');
    }

    // Let the user know the bot is working
    await message.reply(`Searching for \`${query}\`... This may take a moment.`);
    console.log(`Received search command for query: "${query}"`);

    let browser;
    try {
        // --- Launch Puppeteer Browser ---
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        const resultsHtml = await page.$eval('#results', el => el.innerHTML);
        console.log('Results found. Parsing HTML...');

        // --- Format and Send the Response ---
        // Revolt uses a different embed structure
        const embed = {
            title: 'Majic Breaches Search Results',
            description: `Results for: \`${query}\``,
            colour: '#00bfff' // Use 'colour' for Revolt
        };

        // Parser for the preview embed (max 10 results)
        const $ = cheerio.load(resultsHtml);
        const breachSections = $('.breach-section');
        let resultCount = 0;
        const fields = [];

        breachSections.each((i, section) => {
            if (resultCount >= 10) return false;

            const dbName = $(section).find('h2').first().text().trim();
            const description = $(section).find('p').first().text().trim();
            const firstRow = $(section).find('tbody tr').first();

            if (dbName && firstRow.length) {
                const rowData = $(firstRow).find('td').map((i, el) => $(el).text().trim()).get().join(' | ');
                const cleanDescription = description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                
                let fieldText = cleanDescription;
                if (rowData) {
                    fieldText += `\n\n**Sample Data:**\n\`\`\`${rowData.substring(0, 900)}\`\`\``;
                }
                fields.push({
                    name: `🔓 ${dbName}`,
                    value: fieldText.substring(0, 1024),
                    inline: false
                });
                resultCount++;
            }
        });

        if (resultCount === 0) {
            embed.description = `No results found for \`${query}\`.`;
            embed.colour = '#FF0000';
        } else {
            embed.fields = fields;
        }

        // --- Prepare and send the file attachment ---
        if (resultCount > 0) {
            let fileContent = `Majic Breaches Search Results for: ${query}\n`;
            fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
            fileContent += '==================================================\n\n';

            const allBreachSections = $('.breach-section');
            allBreachSections.each((i, section) => {
                const dbName = $(section).find('h2').first().text().trim();
                const description = $(section).find('p').first().text().trim();
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
            const fileName = `majic_results_${query.replace(/[^^a-z0-9]/gi, '_').toLowerCase()}.txt`;

            // Revolt requires uploading the file first to get an ID
            const { id } = await client.rest.post('/attachments/upload', {
                files: [
                    {
                        filename: fileName,
                        content: buffer.toString('base64'), // Upload as base64
                    }
                ]
            });

            // Now send the message with the embed and the attachment ID
            await message.channel.sendMessage({
                content: "Here are your results.",
                embeds: [embed],
                attachments: [id] // Use the attachment ID
            });

        } else {
            // If no results, just send the embed
            await message.channel.sendMessage({ embeds: [embed] });
        }

    } catch (error) {
        console.error('!!! PUPPETEER SEARCH ERROR !!!');
        console.error(error);
        await message.reply('Failed to fetch results. The website may be down or the search timed out.');
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed.');
        }
    }
});

// --- Login ---
client.login(BOT_TOKEN).catch(error => {
    console.error('Failed to start bot. Check your token and connection.');
    console.error(error);
    process.exit(1);
});

// --- Simple Ping Server for Uptime Monitoring ---
const express = require('express');
const pingApp = express();
const port = process.env.PORT || 3000;

pingApp.get('/', (req, res) => {
  res.status(200).send('OK');
});

pingApp.listen(port, () => {
  console.log(`Ping server listening on port ${port}`);
});
