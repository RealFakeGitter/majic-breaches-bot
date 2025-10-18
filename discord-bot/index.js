// Fixed Discord bot - faster responses and correct URLs
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
const API_BASE_URL = process.env.CONVEX_URL.replace('/api', '');

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Site URL: ${CONVEX_SITE_URL}`);
  
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
      // Respond immediately to avoid timeout
      await interaction.reply({
        content: '🔍 Searching breaches... Please wait.',
        ephemeral: true
      });
      
      const query = interaction.options.getString('query');
      const limit = interaction.options.getInteger('limit') || 100;
      
      console.log(`Discord search: ${query} (limit: ${limit})`);
      
      try {
        const searchResponse = await fetch(`${API_BASE_URL}/api/search`, {
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

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error('Search API error:', errorText);
          await interaction.editReply({
            content: `❌ Search failed: ${errorText}`,
          });
          return;
        }

        const searchData = await searchResponse.json();
        console.log('Search API response received');
        
        if (!searchData.success || !searchData.results || searchData.results.length === 0) {
          await interaction.editReply({
            content: `🔍 **Search Results for "${query}"**\n\n❌ No results found.`,
          });
          return;
        }
        
        const embed = new EmbedBuilder()
          .setTitle('🔍 Breach Search Results')
          .setColor(0x3B82F6)
          .setTimestamp();
        
        const preview = searchData.results.slice(0, 2);
        let description = `Found **${searchData.resultCount}** results for: **${query.substring(0, 50)}${query.length > 50 ? "..." : ""}**\n\n`;
        
        preview.forEach((breach, index) => {
          const truncatedBreachName = breach.breachName.length > 200 
            ? breach.breachName.substring(0, 200) + '...' 
            : breach.breachName;
          
          description += `**${index + 1}. ${truncatedBreachName}**\n`;
          if (breach.breachDate) {
            description += `📅 Date: ${breach.breachDate}\n`;
          }
          description += `🎯 Matched Field: ${breach.matchedField}\n`;
          description += `📋 Data Types: ${breach.dataTypes.join(', ')}\n`;
          
          if (breach.content) {
            description += `\n**🔍 Breach Data:**\n`;
            const contentLines = breach.content.split('\n').filter(line => line.trim());
            const limitedLines = contentLines.slice(0, 3);
            limitedLines.forEach(line => {
              description += `\`${line}\`\n`;
            });
            if (contentLines.length > 3) {
              description += `*... and ${contentLines.length - 3} more lines*\n`;
            }
          }
          
          if (breach.recordCount) {
            description += `📊 Records: ${breach.recordCount.toLocaleString()}\n`;
          }
          description += '\n';
        });
        
        if (searchData.resultCount > 2) {
          description += `*... and ${searchData.resultCount - 2} more results*\n\n`;
        }
        
        // Use the correct site URL for results link
        description += `[🔗 **View Full Results**](${CONVEX_SITE_URL}/results?id=${searchData.searchId})`;
        
        if (description.length > 4000) {
          description = description.substring(0, 3900) + '...\n\n' + `[🔗 **View Full Results**](${CONVEX_SITE_URL}/results?id=${searchData.searchId})`;
        }
        
        embed.setDescription(description);
        embed.setFooter({ 
          text: `${searchData.resultCount} total results • Use responsibly` 
        });
        
        await interaction.editReply({ 
          content: null, // Clear the "searching..." message
          embeds: [embed] 
        });
        
      } catch (searchError) {
        console.error('Search error:', searchError);
        await interaction.editReply({
          content: `❌ Search failed: ${searchError.message}`,
        });
      }
      
    } else if (commandName === 'stats') {
      await interaction.reply({
        content: '📊 Getting statistics...',
        ephemeral: true
      });
      
      try {
        const statsResponse = await fetch(`${API_BASE_URL}/api/stats`);
        const stats = await statsResponse.json();
        
        const embed = new EmbedBuilder()
          .setTitle('📊 Bot Statistics')
          .setColor(0x10B981)
          .addFields(
            { name: '🔍 Total Searches', value: stats.totalSearches.toLocaleString(), inline: true },
            { name: '📋 Total Results', value: stats.totalResults.toLocaleString(), inline: true }
          )
          .setTimestamp();
        
        await interaction.editReply({ 
          content: null,
          embeds: [embed] 
        });
      } catch (statsError) {
        console.error('Stats error:', statsError);
        await interaction.editReply({
          content: '❌ Failed to get statistics.',
        });
      }
      
    } else if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Majic Breaches Bot Help')
        .setColor(0x6366F1)
        .setDescription('Search data breaches for security research and OSINT purposes.')
        .addFields(
          { 
            name: '🔍 Commands', 
            value: '`/search <query> [limit]` - Search breaches\n`/stats` - Show statistics\n`/help` - Show this help', 
            inline: false 
          },
          { 
            name: '📋 Examples', 
            value: '`/search john@example.com`\n`/search username123 500`', 
            inline: false 
          },
          { 
            name: '⚠️ Important', 
            value: 'This bot is for educational and security research purposes only. Use responsibly and in accordance with applicable laws.', 
            inline: false 
          }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error('Command error:', error);
    
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

client.login(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN);
