// Auto-generate package.json if it doesn't exist
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
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ConvexHttpClient } = require('convex/browser');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const convex = new ConvexHttpClient(process.env.CONVEX_URL);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Register slash commands
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
          .setDescription('Maximum number of results (default: 10)')
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
      await interaction.deferReply();
      
      const query = interaction.options.getString('query');
      const limit = interaction.options.getInteger('limit') || 10;
      
      console.log(`Discord search: ${query} (limit: ${limit})`);
      
      const searchResult = await convex.action('breaches:searchBreaches', {
        query,
        limit,
      });
      
      const result = await convex.query('breaches:getSearchResults', {
        searchId: searchResult.searchId,
      });
      
      if (!result) {
        await interaction.editReply({
          content: `❌ Error: Search results not found`,
          ephemeral: true
        });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🔍 Breach Search Results')
        .setColor(0x3B82F6)
        .setTimestamp();
      
      if (result.results.length === 0) {
        embed.setDescription(`No results found for: **${query}**`);
      } else {
        const preview = result.results.slice(0, 3);
        let description = `Found **${result.results.length}** results for: **${query}**\n\n`;
        
        preview.forEach((breach, index) => {
          description += `**${index + 1}. ${breach.breachName}**\n`;
          if (breach.breachDate) {
            description += `📅 Date: ${breach.breachDate}\n`;
          }
          description += `🎯 Matched Field: ${breach.matchedField}\n`;
          description += `📋 Data Types: ${breach.dataTypes.join(', ')}\n`;
          
          // Show the actual breach content (email, password, etc.)
          if (breach.content) {
            const contentLines = breach.content.split('\n').filter(line => line.trim());
            contentLines.forEach(line => {
              description += `${line}\n`;
            });
          }
          
          if (breach.recordCount) {
            description += `📊 Records: ${breach.recordCount.toLocaleString()}\n`;
          }
          description += '\n';
        });
        
        if (result.results.length > 3) {
          description += `*... and ${result.results.length - 3} more results*\n\n`;
        }
        
        // Use the corrected URL format with query parameter
        description += `[🔗 **View Full Results**](${process.env.CONVEX_SITE_URL}/results?id=${searchResult.searchId})`;
        
        embed.setDescription(description);
        embed.setFooter({ 
          text: `${result.results.length} total results • Use responsibly` 
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } else if (commandName === 'stats') {
      await interaction.deferReply();
      
      const stats = await convex.query('bots:getBotStats');
      
      const embed = new EmbedBuilder()
        .setTitle('📊 Bot Statistics')
        .setColor(0x10B981)
        .addFields(
          { name: '🔍 Total Searches', value: stats.totalSearches.toLocaleString(), inline: true },
          { name: '📋 Total Results', value: stats.totalResults.toLocaleString(), inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
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
            name: '⚠️ Important', 
            value: 'This bot is for educational and security research purposes only. Use responsibly and in accordance with applicable laws.', 
            inline: false 
          }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Command error:', error);
    const errorMessage = '❌ An error occurred while processing your request.';
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN);

/*
PACKAGE.JSON CONTENT FOR DISCORD BOT:
{
  "name": "majic-breaches-discord-bot",
  "version": "1.0.0",
  "description": "Discord bot for Majic Breaches search",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "discord.js": "^14.22.1",
    "convex": "^1.28.0",
    "dotenv": "^16.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
*/
