const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ConvexHttpClient } = require('convex/browser');
const http = require('http');

// Health check server
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      bot: client?.user?.tag || 'Not connected'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL;

if (!CONVEX_SITE_URL) {
  console.error('CONVEX_SITE_URL environment variable is required');
  process.exit(1);
}

// Initialize Convex client
const convex = new ConvexHttpClient(CONVEX_SITE_URL);

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for data breaches')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Search term (email, username, etc.)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Maximum number of results (default: 10)')
        .setMinValue(1)
        .setMaxValue(50)),
  
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show bot statistics'),
  
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information'),
];

client.once('ready', async () => {
  console.log(`Discord bot logged in as ${client.user.tag}!`);
  
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
      
      try {
        // Call Convex action directly
        const searchResult = await convex.action("breaches:searchBreaches", {
          query,
          limit: Math.max(100, Math.min(10000, limit))
        });
        
        // Get the results
        const results = await convex.query("breaches:getSearchResults", {
          searchId: searchResult.searchId
        });
        
        if (results && results.results && results.results.length > 0) {
        console.log("Discord bot - First result:", JSON.stringify(results.results[0], null, 2));
        
        const embed = new EmbedBuilder()
          .setTitle(`🔍 Search Results for "${query}"`)
          .setColor(0x0099FF)
          .setDescription(`Found ${results.results.length} result(s) - showing actual breach data`)
          .setTimestamp();
        
        // Add fields for each result (limit to first 5 for embed limits)
        const displayResults = results.results.slice(0, 5);
        displayResults.forEach((result, index) => {
          // Extract the actual breach content (first 200 chars for better visibility)
          const contentPreview = result.content ? result.content.substring(0, 200) + (result.content.length > 200 ? "..." : "") : "No content available";
          
          embed.addFields({
            name: `${index + 1}. ${result.breachName}`,
            value: `**Match:** ${result.matchedField}\n**Data:** ${result.dataTypes.join(', ')}\n\`\`\`\n${contentPreview}\n\`\`\``,
            inline: false
          });
        });
        
        if (results.results.length > 5) {
          embed.setFooter({ text: `Showing first 5 of ${results.results.length} results` });
        }
        
        await interaction.editReply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('🔍 No Results Found')
          .setDescription(`No breaches found for "${query}"`)
          .setColor(0x999999)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      }
      } catch (error) {
        console.error('Search error:', error);
        const embed = new EmbedBuilder()
          .setTitle('❌ Search Error')
          .setDescription('An error occurred while searching. Please try again later.')
          .setColor(0xFF0000)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      }
    } else if (commandName === 'stats') {
      await interaction.deferReply();
      
      try {
        const stats = await convex.query("bots:getBotStats");
        
        const embed = new EmbedBuilder()
          .setTitle('📊 Bot Statistics')
          .setColor(0x00FF00)
          .addFields(
            { name: 'Total Searches', value: stats.totalSearches.toLocaleString(), inline: true },
            { name: 'Total Results', value: stats.totalResults.toLocaleString(), inline: true }
          )
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Stats error:', error);
        const embed = new EmbedBuilder()
          .setTitle('❌ Stats Error')
          .setDescription('An error occurred while fetching statistics.')
          .setColor(0xFF0000)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      }
    } else if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Majic Breaches Bot Help')
        .setDescription('Search data breaches for security research and OSINT')
        .setColor(0x0099FF)
        .addFields(
          { name: '/search <query> [limit]', value: 'Search for breaches by email, username, etc.', inline: false },
          { name: '/stats', value: 'Show bot usage statistics', inline: false },
          { name: '/help', value: 'Show this help message', inline: false }
        )
        .setFooter({ text: 'Use responsibly for educational and security research purposes only' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error handling command:', error);
    const errorMessage = 'An error occurred while processing your request. Please try again later.';
    
    if (interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.DISCORD_BOT_TOKEN);
