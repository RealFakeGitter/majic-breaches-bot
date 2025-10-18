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
const { Client, GatewayIntentBits, SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionType } = require('discord.js');

// Start health server for Render
const http = require('http');
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'Discord bot running', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));
});
server.listen(PORT, () => {
  console.log(`Health server running on port ${PORT}`);
});

require('./keep-alive');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Fixed URL construction - API calls go to Convex, web interface goes to Vercel
const CONVEX_API_URL = process.env.CONVEX_URL || 'https://insightful-mongoose-187.convex.site';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://majic-breaches-bot.vercel.app';

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Convex API URL: ${CONVEX_API_URL}`);
  console.log(`Web App URL: ${WEB_APP_URL}`);
  console.log(`Search API URL: ${CONVEX_API_URL}/api/search`);
  console.log(`Stats API URL: ${CONVEX_API_URL}/api/stats`);
  
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
          .setRequired(false))
      .addStringOption(option =>
        option.setName('format')
          .setDescription('Output format (preview, json, txt, html)')
          .setRequired(false)
          .addChoices(
            { name: 'Preview (default)', value: 'preview' },
            { name: 'JSON File', value: 'json' },
            { name: 'Text File', value: 'txt' },
            { name: 'HTML File', value: 'html' }
          )),
    
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
      const format = interaction.options.getString('format') || 'preview';
      
      console.log(`Discord search: ${query} (limit: ${limit}, format: ${format})`);
      
      // Use deferReply instead of reply to give us more time
      await interaction.deferReply({ ephemeral: true });
      
      // Perform the search
      try {
        const searchUrl = `${CONVEX_API_URL}/api/search`;
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
          
          let errorMessage = 'Unknown error';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorText;
          } catch (e) {
            errorMessage = errorText;
          }
          
          await interaction.editReply({
            content: `❌ Search failed (${searchResponse.status}): ${errorMessage.substring(0, 200)}`,
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
        
        // Handle different output formats
        if (format === 'preview') {
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
          
          // Ensure we don't exceed Discord's 2000 character limit
          if (response.length > 1800) {
            response = response.substring(0, 1700) + '...\n\n*Use the button below to view all results*';
          }
          
          // Create button for full results
          const viewButton = new ButtonBuilder()
            .setLabel('🔗 View Full Results')
            .setStyle(ButtonStyle.Link)
            .setURL(`${WEB_APP_URL}/results?id=${searchData.searchId}`);
          
          const row = new ActionRowBuilder().addComponents(viewButton);
          
          await interaction.editReply({
            content: response,
            components: [row]
          });
        } else {
          // File attachment
          const fileContent = format === 'json' ? JSON.stringify(searchData, null, 2) : 
            format === 'html' ? `<html><body><h1>Results: ${searchData.resultCount}</h1>${searchData.results.map((b, i) => `<div><h3>${i+1}. ${b.breachName}</h3><pre>${b.content}</pre></div>`).join('')}</body></html>` :
            `Results: ${searchData.resultCount}\n\n${searchData.results.map((b, i) => `${i+1}. ${b.breachName}\n${b.content}`).join('\n\n---\n\n')}`;
          const fileName = `breach-results-${Date.now()}.${format === 'json' ? 'json' : format === 'html' ? 'html' : 'txt'}`;
          const attachment = new AttachmentBuilder(Buffer.from(fileContent, 'utf8'), { name: fileName });
          
          const viewButton = new ButtonBuilder()
            .setLabel('🔗 View Online')
            .setStyle(ButtonStyle.Link)
            .setURL(`${WEB_APP_URL}/results?id=${searchData.searchId}`);
          
          const row = new ActionRowBuilder().addComponents(viewButton);
          
          await interaction.editReply({
            content: `🔍 Found **${searchData.resultCount}** results\n\n📎 File: ${fileName}\n\n🔗 Use button to view online`,
            files: [attachment],
            components: [row]
          });
        }
        
      } catch (searchError) {
        console.error('Search error details:', searchError);
        console.error('Search error stack:', searchError.stack);
        await interaction.editReply({
          content: `❌ Search failed: ${searchError.message.substring(0, 100)}`,
        });
      }
      
    } else if (commandName === 'stats') {
      // Use deferReply for stats too
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const statsUrl = `${CONVEX_API_URL}/api/stats`;
        console.log(`Making stats request to: ${statsUrl}`);
        
        const statsResponse = await fetch(statsUrl);
        console.log(`Stats response status: ${statsResponse.status}`);
        
        if (!statsResponse.ok) {
          const errorText = await statsResponse.text();
          console.error('Stats API error:', errorText);
          throw new Error(`Stats API returned ${statsResponse.status}: ${errorText}`);
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
          content: `❌ Failed to get statistics: ${statsError.message}`,
        });
      }
      
    } else if (commandName === 'help') {
      // Help command can respond immediately since it's static
      const helpText = `🤖 **Majic Breaches Bot Help**

**Commands:**
\`/search <query> [limit] [format]\` - Search breaches
\`/stats\` - Show statistics
\`/help\` - Show this help

**Format Options:**
• \`preview\` - Show preview in Discord (default)
• \`json\` - Download results as JSON file
• \`txt\` - Download results as text file
• \`html\` - Download results as HTML file

**Examples:**
\`/search john@example.com\`
\`/search username123 500 json\`
\`/search password123 100 txt\`

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
      } else if (interaction.deferred) {
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
