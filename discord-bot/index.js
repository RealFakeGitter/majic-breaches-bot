// Fixed Discord bot - better error handling and debugging
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  const packageJson = {
    "name": "majic-breaches-discord-bot",
    "version": "1.0.0",
    "description": "Discord bot for Majic Breaches search",
    "main": "index.js",
    "scripts": {
      "start": "node index.js",
      "dev": "node index.js",
      "build": "echo 'No build step required'"
    },
    "dependencies": {
      "discord.js": "^14.22.1",
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
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('./keep-alive');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Use the correct Convex site URL for results links
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || 'https://insightful-mongoose-187.convex.cloud';
const API_BASE_URL = process.env.CONVEX_URL ? process.env.CONVEX_URL.replace('/api', '') : 'https://insightful-mongoose-187.convex.cloud';

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Site URL: ${CONVEX_SITE_URL}`);
  console.log(`Full API URL: ${API_BASE_URL}/api/search`);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('search')
      .setDescription('Search data breaches')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Search term (email, username, etc.)')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Maximum number of results (default: 100)')
          .setRequired(false)),
    
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Show bot statistics'),
    
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show help information'),
  ];

  try {
    console.log('Started refreshing application (/) commands.');
    await client.application.commands.set(commands);
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'search') {
      const query = interaction.options.getString('query');
      const limit = interaction.options.getInteger('limit') || 100;
      
      console.log(`Discord search: ${query} (limit: ${limit})`);
      
      // Respond immediately with a simple message to avoid timeout
      await interaction.reply({
        content: `🔍 Searching for "${query.substring(0, 50)}${query.length > 50 ? "..." : ""}"... Please wait.`,
        ephemeral: true
      });
      
      // Perform the search in the background
      try {
        const searchUrl = `${API_BASE_URL}/api/search`;
        console.log(`Making request to: ${searchUrl}`);
        
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            limit,
            platform: 'discord'
          }),
        });

        console.log(`Response status: ${searchResponse.status}`);
        console.log(`Response headers:`, Object.fromEntries(searchResponse.headers.entries()));

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error('Search API error response:', errorText);
          await interaction.editReply({
            content: `❌ Search failed (${searchResponse.status}): ${errorText.substring(0, 100) || 'Unknown error'}`,
          });
          return;
        }

        const searchData = await searchResponse.json();
        console.log('Search API response received:', JSON.stringify(searchData, null, 2));
        
        if (!searchData.success || !searchData.results || searchData.results.length === 0) {
          await interaction.editReply({
            content: `🔍 **Search Results for "${query}"**\n\n❌ No results found.`,
          });
          return;
        }
        
        // Create a simple text response instead of embed for faster processing
        const preview = searchData.results.slice(0, 2);
        let response = `🔍 **Search Results**\n\nFound **${searchData.resultCount}** results for: **${query.substring(0, 50)}${query.length > 50 ? "..." : ""}**\n\n`;
        
        preview.forEach((breach, index) => {
          const truncatedBreachName = breach.breachName.length > 100 
            ? breach.breachName.substring(0, 100) + '...' 
            : breach.breachName;
          
          response += `**${index + 1}. ${truncatedBreachName}**\n`;
          response += `🎯 Match: ${breach.matchedField}\n`;
          response += `📋 Fields: ${breach.dataTypes.join(', ')}\n`;
          
          if (breach.content) {
            const contentLines = breach.content.split('\n').filter(line => line.trim());
            const limitedLines = contentLines.slice(0, 2);
            limitedLines.forEach(line => {
              response += `\`${line.substring(0, 80)}${line.length > 80 ? "..." : ""}\`\n`;
            });
          }
          response += '\n';
        });
        
        if (searchData.resultCount > 2) {
          response += `*... and ${searchData.resultCount - 2} more results*\n\n`;
        }
        
        // Use the correct site URL for results link
        response += `🔗 **[View Full Results](${CONVEX_SITE_URL}/results?id=${searchData.searchId})**`;
        
        // Ensure we don't exceed Discord's 2000 character limit
        if (response.length > 1900) {
          response = response.substring(0, 1800) + '...\n\n' + `🔗 **[View Full Results](${CONVEX_SITE_URL}/results?id=${searchData.searchId})**`;
        }
        
        await interaction.editReply({
          content: response
        });
        
      } catch (searchError) {
        console.error('Search error details:', searchError);
        console.error('Search error stack:', searchError.stack);
        await interaction.editReply({
          content: `❌ Search failed: ${searchError.message.substring(0, 100)}`,
        });
      }
      
    } else if (commandName === 'stats') {
      // Respond immediately
      await interaction.reply({
        content: '📊 Getting statistics...',
        ephemeral: true
      });
      
      try {
        const statsUrl = `${API_BASE_URL}/api/stats`;
        console.log(`Making stats request to: ${statsUrl}`);
        
        const statsResponse = await fetch(statsUrl);
        console.log(`Stats response status: ${statsResponse.status}`);
        
        if (!statsResponse.ok) {
          throw new Error(`Stats API returned ${statsResponse.status}`);
        }
        
        const stats = await statsResponse.json();
        console.log('Stats received:', stats);
        
        const response = `📊 **Bot Statistics**\n\n🔍 Total Searches: ${stats.totalSearches.toLocaleString()}\n📋 Total Results: ${stats.totalResults.toLocaleString()}`;
        
        await interaction.editReply({
          content: response
        });
      } catch (statsError) {
        console.error('Stats error:', statsError);
        await interaction.editReply({
          content: '❌ Failed to get statistics.',
        });
      }
      
    } else if (commandName === 'help') {
      // Help command can respond immediately since it's static
      const helpText = `🤖 **Majic Breaches Bot Help**

**Commands:**
\`/search <query> [limit]\` - Search breaches
\`/stats\` - Show statistics
\`/help\` - Show this help

**Examples:**
\`/search john@example.com\`
\`/search username123 500\`

⚠️ **Important:** This bot is for educational and security research purposes only. Use responsibly and in accordance with applicable laws.`;

      await interaction.reply({ 
        content: helpText, 
        ephemeral: true 
      });
    }
  } catch (error) {
    console.error('Command error:', error);
    console.error('Command error stack:', error.stack);
    
    // Try to respond if we haven't already
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: '❌ An error occurred while processing your request.', 
          ephemeral: true 
        });
      } else if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ 
          content: '❌ An error occurred while processing your request.' 
        });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN);
