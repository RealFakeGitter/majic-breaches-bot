const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const puppeteer = require('puppeteer');

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
        await page.waitForSelector('#results', { timeout: 15000 }); // <-- CORRECTED ID

        // --- Scrape the Results ---
        // Get the raw HTML of the results container
        const resultsHtml = await page.$eval('#results', el => el.innerHTML); // <-- CORRECTED ID

        console.log('Results found. Parsing HTML...');

        // --- Format and Send the Response ---
        const embed = new EmbedBuilder()
            .setTitle(`Majic Breaches
