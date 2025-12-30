const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// At top of index.js, right after requires
require('dotenv').config(); // If using dotenv
console.log('🚀 Starting bot... Node version:', process.version);
console.log('🔑 Token loaded?', !!process.env.DISCORD_TOKEN ? 'YES' : 'NO (MISSING!)');
console.log('Token preview (first 10 chars):', process.env.DISCORD_TOKEN?.slice(0, 10) + '...');

// Your existing ping server code...
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot alive!'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log('Ping server listening on port 10000'); // Your existing log
});

// Discord client setup
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] // Add yours
});

client.on('ready', () => {
  console.log(`✅ Bot ready! Logged in as ${client.user.tag} | Guilds: ${client.guilds.cache.size}`);
});

client.on('error', (err) => {
  console.error('❌ Client error:', err.message || err);
});

client.ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message || err);
});

// Login with FAILSAFE logging
console.log('🔄 Attempting Discord login...');
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('🎉 Login promise resolved'))
  .catch(err => {
    console.error('💥 Login FAILED:', err.message || err);
    process.exit(1); // Crash so Render restarts/logs it
  });

// --- Configuration ---
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBSITE_URL = 'https://majicbreaches.iceiy.com/';

// --- Initialize Client ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- Event Listeners ---
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Bot is ready to receive search commands.');
});

client.on('messageCreate', async message => {
    // Ignore messages from all bots, including this one
    if (message.author.bot) return; 
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
        const embed = new EmbedBuilder()
            .setTitle(`Majic Breaches Search Results`)
            .setDescription(`Results for: \`${query}\``)
            .setColor('#00bfff');

        // Parser for the preview embed (max 10 results)
        const $ = cheerio.load(resultsHtml);
        const breachSections = $('.breach-section');
        let resultCount = 0;

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
                embed.addFields({ name: `🔓 ${dbName}`, value: fieldText.substring(0, 1024), inline: false });
                resultCount++;
            }
        });

        if (resultCount === 0) {
            embed.setDescription(`No results found for \`${query}\`.`).setColor('#FF0000');
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
            const attachment = new AttachmentBuilder(buffer, { name: fileName });

            await message.channel.send({ embeds: [embed], files: [attachment] });

        } else {
            await message.channel.send({ embeds: [embed] });
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
client.login(BOT_TOKEN);

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
