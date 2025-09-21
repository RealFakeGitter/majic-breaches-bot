import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } from 'discord.js';
import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Environment variables loaded:');
console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set');
console.log('CONVEX_URL:', process.env.CONVEX_URL);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const convex = new ConvexHttpClient(process.env.CONVEX_URL);

// Add error handling for the Discord client
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('Discord client warning:', warning);
});

client.on('debug', (info) => {
  console.log('Discord debug:', info);
});

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for breaches')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Search query (email, username, etc.)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Maximum number of results (default: 100)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10000)),
  
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show bot statistics'),
  
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information'),
].map(command => command.toJSON());

// Register slash commands
async function registerCommands() {
  try {
    const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', async () => {
  console.log(`✅ Discord bot logged in as ${client.user.tag}!`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  try {
    if (commandName === 'search') {
      await interaction.deferReply({ ephemeral: true });

      const query = options.getString('query');
      const limit = options.getInteger('limit') || 100;

      try {
        // Call your existing Convex action
        const result = await convex.action('breaches:searchBreaches', {
          query,
          limit,
        });

        // Get the results
        const searchResults = await convex.query('breaches:getSearchResults', {
          searchId: result.searchId,
        });

        if (!searchResults || searchResults.results.length === 0) {
          await interaction.editReply({
            content: `❌ No results found for "${query}"`,
          });
          return;
        }

        // Format results for Discord
        const resultText = searchResults.results.slice(0, 5).map((result, index) => {
          const truncatedContent = result.content.length > 200 
            ? result.content.substring(0, 200) + "..." 
            : result.content;
          
          return `**${index + 1}. ${result.breachName}**\n` +
                 `Match: \`${result.matchedField}\`\n` +
                 `\`\`\`\n${truncatedContent}\n\`\`\``;
        }).join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle(`🔍 Search Results for "${query}"`)
          .setDescription(`Found ${result.resultCount} total results. Showing first 5:`)
          .setColor(0x3B82F6)
          .addFields({
            name: "Results",
            value: resultText.length > 4000 ? resultText.substring(0, 4000) + "..." : resultText,
          })
          .setFooter({
            text: `Total: ${result.resultCount} results | Use with caution - for educational purposes only`,
          });

        await interaction.editReply({
          embeds: [embed],
        });

      } catch (error) {
        await interaction.editReply({
          content: `❌ Search failed: ${error.message || "Unknown error"}`,
        });
      }
    }

    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle("🔍 Majic Breaches Bot")
        .setDescription("Search across data breaches for security research purposes.")
        .setColor(0x3B82F6)
        .addFields(
          {
            name: "/search <query> [limit]",
            value: "Search for breaches containing the specified query\n" +
                   "Examples: `/search john@example.com`, `/search username123`",
          },
          {
            name: "/stats",
            value: "Show bot usage statistics",
          },
          {
            name: "/help",
            value: "Show this help message",
          }
        )
        .setFooter({
          text: "⚠️ For educational and security research purposes only",
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    if (commandName === 'stats') {
      const stats = await convex.query('bots:getBotStats');

      const embed = new EmbedBuilder()
        .setTitle("📊 Bot Statistics")
        .setColor(0x10B981)
        .addFields(
          {
            name: "Total Searches",
            value: stats.totalSearches.toString(),
            inline: true,
          },
          {
            name: "Total Results Found",
            value: stats.totalResults.toString(),
            inline: true,
          }
        )
        .setFooter({
          text: "Majic Breaches Bot",
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

  } catch (error) {
    console.error('Error handling interaction:', error);
    const errorMessage = "❌ An error occurred while processing your request.";
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Login with error handling
console.log('Attempting to login to Discord...');
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('Failed to login to Discord:', error);
  process.exit(1);
});
