const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio'); // <-- Added Cheerio

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
    console.log(`Logged in as \${client.user.tag}!`);
    console.log('Bot is ready to receive search commands.');
});

client.on('messageCreate', async message => {
    if (message.author.bot && message.author.id !== client.user.id) return;
    if (!message.content.startsWith('!search')) return;

    const query = message.content.substring(7).trim();
    if (!query) {
        return message.reply('Please provide a search term. Example: `!search email@example.com`');
    }

    // Let the user know the bot is working
    await message.reply(`Searching for \`${query}\`... This may take a moment.`);
    console.log(`Received search command for query: "\${query}"`);

    let browser;
    try {
        // --- Launch Puppeteer Browser ---
        browser = await puppeteer.launch({
            headless: true, // Run in the background
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for running on Render
        });

        const page = await browser.newPage();
        await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2' });

        console.log('Navigated to website, waiting for search input...');

        // --- Perform the Search ---
        // Wait for the search input field to be available
        await page.waitForSelector('#searchInput', { timeout: 10000 });
        
        // Type the query and press Enter
        await page.type('#searchInput', query);
        await page.keyboard.press('Enter');

        console.log('Search submitted, waiting for results...');

        // Wait for the results container to appear
        await page.waitForSelector('#results', { timeout: 15000 });
        // Wait a fixed 5 seconds for the JS to populate the results, then check for content
        await new Promise(resolve => setTimeout(resolve, 5000));

        // --- Scrape the Results ---
        // Get the raw HTML of the results container
        const resultsHtml = await page.$eval('#results', el => el.innerHTML);

        console.log('Results found. Parsing HTML...');
        
        // --- DEBUGGING LOGS ---
        console.log('--- RAW HTML SCRAPED ---');
        console.log(resultsHtml);
        console.log('--- END RAW HTML ---');
        // --- END DEBUGGING LOGS ---

        // --- Format and Send the Response ---
        const embed = new EmbedBuilder()
            .setTitle(`Majic Breaches Search Results`)
            .setDescription(`Results for: \`${query}\``)
            .setColor('#00bfff');

        // New parser using Cheerio for Node.js
        const $ = cheerio.load(resultsHtml);
        const breachSections = $('.breach-section');
        let resultCount = 0;

        breachSections.each((i, section) => {
            if (resultCount >= 10) return false; // Limit to 10 results

            const dbName = $(section).find('h2').first().text().trim();
            const description = $(section).find('p').first().text().trim();
            const firstRow = $(section).find('tbody tr').first();

            if (dbName && firstRow.length) {
                const rowData = $(firstRow).find('td').map((i, el) => $(el).text().trim()).get().join(' | ');
                
                // Clean up common HTML entities
                const cleanDescription = description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                
                let fieldText = cleanDescription;
                if (rowData) {
                    fieldText += `\n\n**Sample Data:**\n\`\`\`${rowData.substring(0, 900)}\`\`\``;
                }

                embed.addFields({ name: `🔓 \${dbName}`, value: fieldText.substring(0, 1024), inline: false });
                resultCount++;
            }
        });

        if (resultCount === 0) {
            embed.setDescription(`No results found for \`${query}\`.`).setColor('#FF0000');
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('View Full Results on Majic Breaches')
                    .setStyle(ButtonStyle.Link)
                    .
