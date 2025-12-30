require('dotenv').config(); // Load .env file if present (optional for Render)

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const express = require('express');

// === Debug logging at startup ===
console.log('🚀 Starting bot...');
console.log('Node version:', process.version);
console.log('🔑 DISCORD_BOT_TOKEN loaded?', !!process.env.DISCORD_BOT_TOKEN ? 'YES' : 'NO (MISSING!)');
if (process.env.DISCORD_BOT_TOKEN) {
  console.log('Token preview (first 10 chars):', process.env.DISCORD_BOT_TOKEN.slice(0, 10) + '...');
} else {
  console.error('❌ No token found! Check Render Environment Variables.');
}

// === Keep-alive HTTP server for Render Web Service ===
const app = express();
app.get('/', (req, res) => res.status(200).send('Bot alive!'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ping server listening on port ${PORT}`);
});

// === Discord Client ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// === Event Listeners ===
client.once('ready', () => {
  console.log(`✅ Bot ready! Logged in as ${client.user.tag} | Guilds: ${client.guilds.cache.size}`);
  console.log('Bot is ready to receive !search commands.');
});

client.on('error', (err) => {
  console.error('❌ Client error:', err.message || err);
});

client.ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message || err);
});

// === Message handling ===
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!search')) return;

  const query = message.content.substring(7).trim();
  if (!query) {
    return message.reply('Please provide a search term. Example: `!search email@example.com`');
  }

  await message.reply(`Searching for \`${query}\`... This may take a moment.`);
  console.log(`Received search command for query: "${query}"`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://majicbreaches.iceiy.com/', { waitUntil: 'networkidle2' });
    console.log('Navigated to website, waiting for search input...');

    await page.waitForSelector('#searchInput', { timeout: 10000 });
    await page.type('#searchInput', query);
    await page.keyboard.press('Enter');
    console.log('Search submitted, waiting for results...');

    await page.waitForSelector('#results', { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for JS

    const resultsHtml = await page.$eval('#results', el => el.innerHTML);
    console.log('Results found. Parsing HTML...');

    const embed = new EmbedBuilder()
      .setTitle(`Majic Breaches Search Results`)
      .setDescription(`Results for: \`${query}\``)
      .setColor('#00bfff');

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

    if (resultCount > 0) {
      let fileContent = `Majic Breaches Search Results for: ${query}\n`;
      fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
      fileContent += '==================================================\n\n';

      $('.breach-section').each((i, section) => {
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
      const fileName = `majic_results_${query.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
      const attachment = new AttachmentBuilder(buffer, { name: fileName });

      await message.channel.send({ embeds: [embed], files: [attachment] });
    } else {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('!!! PUPPETEER SEARCH ERROR !!!', error);
    await message.reply('Failed to fetch results. The website may be down or the search timed out.');
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
});

// === Login with better error handling ===
console.log('🔄 Attempting Discord login...');
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    console.log('🎉 Login promise resolved successfully');
  })
  .catch((err) => {
    console.error('💥 Login FAILED:', err.message || err);
    // Optional: process.exit(1); // Uncomment if you want Render to restart on token failure
  });
