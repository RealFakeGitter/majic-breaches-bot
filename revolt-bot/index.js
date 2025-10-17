// Auto-generate package.json if it doesn't exist
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  const packageJson = {
    "name": "majic-breaches-revolt-bot",
    "version": "1.0.0",
    "description": "Revolt bot for Majic Breaches search",
    "main": "index.js",
    "scripts": {
      "start": "node index.js",
      "dev": "node index.js",
      "build": "echo 'No build step required'"
    },
    "dependencies": {
      "revolt.js": "^7.2.0",
      "convex": "^1.28.0",
      "dotenv": "^16.6.1"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  };
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Generated package.json');
}

require('dotenv').config();
const { Client } = require('revolt.js');
const { ConvexHttpClient } = require('convex');

const convex = new ConvexHttpClient(process.env.CONVEX_URL);

const client = new Client();

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.username}!`);
});

client.on('message', async (message) => {
  // Ignore messages from bots
  if (message.author?.bot) return;
  
  // Only respond to messages that start with !breach
  if (!message.content?.startsWith('!breach')) return;
  
  const args = message.content.slice(7).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  
  try {
    if (command === 'search') {
      if (args.length === 0) {
        await message.reply('❌ Please provide a search query. Usage: `!breach search <query>`');
        return;
      }
      
      const query = args.join(' ');
      console.log(`Revolt search: ${query}`);
      
      const result = await convex.action('revolt-bot:search', {
        query,
        limit: 10,
        platform: 'revolt',
        userId: message.author?._id,
        username: message.author?.username,
        channelId: message.channel?._id,
        serverId: message.channel?.server?._id
      });
      
      if (!result.success) {
        await message.reply(`❌ Error: ${result.error}`);
        return;
      }
      
      if (result.results.length === 0) {
        await message.reply(`🔍 No results found for: **${query}**`);
        return;
      }
      
      const preview = result.results.slice(0, 3);
      let response = `🔍 **Breach Search Results**\n\nFound **${result.results.length}** results for: **${query}**\n\n`;
      
      preview.forEach((breach, index) => {
        response += `**${index + 1}. ${breach.breachName}**\n`;
        if (breach.breachDate) {
          response += `📅 ${breach.breachDate}\n`;
        }
        response += `🎯 Matched: ${breach.matchedField}\n`;
        if (breach.recordCount) {
          response += `📊 Records: ${breach.recordCount.toLocaleString()}\n`;
        }
        response += '\n';
      });
      
      if (result.results.length > 3) {
        response += `*... and ${result.results.length - 3} more results*\n\n`;
      }
      
      // Use the corrected URL format with query parameter
      response += `🔗 **[View Full Results](${process.env.CONVEX_SITE_URL}/results?id=${result.searchId})**\n\n`;
      response += `⚠️ *Use responsibly for security research purposes only*`;
      
      await message.reply(response);
      
    } else if (command === 'stats') {
      const stats = await convex.query('bots:getBotStats');
      
      const response = `📊 **Bot Statistics**\n\n🔍 Total Searches: **${stats.totalSearches.toLocaleString()}**\n📋 Total Results: **${stats.totalResults.toLocaleString()}**`;
      
      await message.reply(response);
      
    } else if (command === 'help') {
      const response = `🤖 **Majic Breaches Bot Help**\n\nSearch data breaches for security research and OSINT purposes.\n\n**Commands:**\n\`!breach search <query>\` - Search breaches\n\`!breach stats\` - Show statistics\n\`!breach help\` - Show this help\n\n⚠️ **Important:** This bot is for educational and security research purposes only. Use responsibly and in accordance with applicable laws.`;
      
      await message.reply(response);
    } else {
      await message.reply('❌ Unknown command. Use `!breach help` for available commands.');
    }
  } catch (error) {
    console.error('Command error:', error);
    await message.reply('❌ An error occurred while processing your request.');
  }
});

client.loginBot(process.env.REVOLT_TOKEN);

/*
PACKAGE.JSON CONTENT FOR REVOLT BOT:
{
  "name": "majic-breaches-revolt-bot",
  "version": "1.0.0",
  "description": "Revolt bot for Majic Breaches search",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "revolt.js": "^7.2.0",
    "convex": "^1.28.0",
    "dotenv": "^16.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
*/
