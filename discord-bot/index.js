require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const express = require('express');

// === Startup Debug ===
console.log('🚀 Bot starting...');
console.log('Node version:', process.version);
console.log('🔑 DISCORD_BOT_TOKEN loaded?', !!process.env.DISCORD_BOT_TOKEN ? 'YES' : 'NO');

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ MISSING TOKEN! Check Render env vars.');
  process.exit(1);
}

// === Keep-alive server ===
const app = express();
app.get('/', (req, res) => res.status(200).send('Bot alive!'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ping server on port ${PORT}`);
});

// === Deduplication ===
const processedMessageIds = new Set();
const lastCommandTime = new Map(); // userID_channelID → timestamp

// === Client ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// === Debug Listeners ===
client.on('debug', (info) => console.log('[DEBUG]', info));
client.on('error', (err) => console.error('[CLIENT ERROR]', err));
client.ws.on('open', () => console.log('[WS] Connection opened'));
client.ws.on('close', (code, reason) => console.log('[WS] Closed:', code, reason || 'no reason'));
client.ws.on('error', (err) => console.error('[WS ERROR]', err));

client.once('ready', () => {
  console.log(`✅ READY! Logged in as ${client.user.tag} | Guilds: ${client.guilds.cache.size}`);
});

// === Message Handler ===
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!search')) return;

  // Dedup by message ID
  if (processedMessageIds.has(message.id)) {
    console.log(`Duplicate ignored (ID: ${message.id})`);
    return;
  }
  processedMessageIds.add(message.id);
  setTimeout(() => processedMessageIds.delete(message.id), 120000);

  const rateKey = `${message.author.id}_${message.channel.id}`;
  const now = Date.now();

  // Rate limit + polite reply for near-duplicates
  if (lastCommandTime.has(rateKey)) {
    const timeSince = now - lastCommandTime.get(rateKey);
    if (timeSince < 60000) {
      console.log(`Rate-limited user ${message.author.tag} (${timeSince}ms ago)`);
      message.reply('⏳ Chill! I\'m already searching or just finished. Wait a moment.')
        .catch(() => {});
      return;
    }
  }
  lastCommandTime.set(rateKey, now);

  const query = message.content.substring(7).trim();
  if (!query) return message.reply('Provide a search term. E.g. `!search email@example.com`');

  await message.reply(`Searching for \`${query}\`... This may take a moment.`);
  console.log(`Search command: "${query}" from ${message.author.tag}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: chromium.headless,
      executablePath: await chromium.executablePath(),
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
    });

    const page = await browser.newPage();
    await page.goto('https://majicbreaches.iceiy.com/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#searchInput', { timeout: 10000 });
    await page.type('#searchInput', query);
    await page.keyboard.press('Enter');
    await page.waitForSelector('#results', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 5000));

    const resultsHtml = await page.$eval('#results', el => el.innerHTML);
    console.log('Results parsed.');

    const embed = new EmbedBuilder()
      .setTitle('Majic Breaches Search Results')
      .setDescription(`For: \`${query}\``)
      .setColor('#00bfff');

    const $ = cheerio.load(resultsHtml);
    const sections = $('.breach-section');
    let count = 0;

    sections.each((i, sec) => {
      if (count >= 10) return false;
      const dbName = $(sec).find('h2').first().text().trim();
      const desc = $(sec).find('p').first().text().trim();
      const firstRow = $(sec).find('tbody tr').first();

      if (dbName && firstRow.length) {
        const rowData = firstRow.find('td').map((_, el) => $(el).text().trim()).get().join(' | ');
        const cleanDesc = desc.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        let field = cleanDesc;
        if (rowData) field += `\n\n**Sample:**\n\`\`\`${rowData.substring(0, 900)}\`\`\``;
        embed.addFields({ name: `🔓 ${dbName}`, value: field.substring(0, 1024), inline: false });
        count++;
      }
    });

    if (count === 0) {
      embed.setDescription('No results found.').setColor('#FF0000');
    }

    if (count > 0) {
      let txt = `Results for ${query}\nGenerated: ${new Date().toLocaleString()}\n\n`;
      $('.breach-section').each((_, sec) => {
        const db = $(sec).find('h2').first().text().trim();
        const d = $(sec).find('p').first().text().trim();
        const rows = $(sec).find('tbody tr');
        txt += `--- ${db} ---\n${d}\n\n`;
        if (rows.length) {
          const headers = $(sec).find('thead th').map((_, el) => $(el).text().trim()).get();
          txt += headers.join('\t') + '\n----------------------------------------\n';
          rows.each((_, row) => {
            const data = $(row).find('td').map((_, el) => $(el).text().trim()).get().join('\t');
            txt += data + '\n';
          });
        } else txt += 'No data.\n';
        txt += '\n==================================================\n\n';
      });

      const buffer = Buffer.from(txt, 'utf-8');
      const filename = `results_${query.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
      const attach = new AttachmentBuilder(buffer, { name: filename });

      await message.channel.send({ embeds: [embed], files: [attach] });
    } else {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('!!! SEARCH ERROR !!!', err);
    await message.reply('Search failed (site may be down or timed out).');
  } finally {
    if (browser) await browser.close();
  }
});

// === Login with retry ===
async function loginWithRetry(attempt = 1, maxAttempts = 3) {
  console.log(`[LOGIN] Attempt ${attempt}/${maxAttempts}...`);
  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('[LOGIN] Success!');
  } catch (err) {
    console.error('[LOGIN FAIL]', err.message || err);
    if (attempt < maxAttempts) {
      console.log('[LOGIN] Retrying in 10s...');
      await new Promise(r => setTimeout(r, 10000));
      return loginWithRetry(attempt + 1, maxAttempts);
    } else {
      console.error('[LOGIN] Max attempts reached. Exiting.');
      process.exit(1);
    }
  }
}

console.log('[START] Initiating login...');
loginWithRetry();
