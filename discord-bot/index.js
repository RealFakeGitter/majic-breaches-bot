import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActivityType } from 'discord.js';
import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Environment variables loaded:');
console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set');
console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? 'Set' : 'Not set');
console.log('CONVEX_URL:', process.env.CONVEX_URL);

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  console.error('❌ DISCORD_CLIENT_ID is required');
  process.exit(1);
}

if (!process.env.CONVEX_URL) {
  console.error('❌ CONVEX_URL is required');
  process.exit(1);
}

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

// Register slash commands globally
async function registerCommands() {
  try {
    const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
    console.log('Started refreshing application (/) commands.');

    // Register commands globally (not guild-specific)
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', async () => {
  console.log(`✅ Discord bot logged in as ${client.user.tag}!`);
  console.log(`Bot is in ${client.guilds.cache.size} guilds`);
  
  // Set bot status - Updated for Discord.js v14
  client.user.setActivity('🔍 Searching breaches', { type: ActivityType.Watching });
  
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

      console.log(`Search command: query="${query}", limit=${limit}`);

      try {
        // Use the dedicated Discord command handler
        const commandOptions = [
          { name: 'query', value: query },
          { name: 'limit', value: limit }
        ];

        console.log('Calling Convex action with:', {
          commandName: 'search',
          options: commandOptions,
          userId: interaction.user.id,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
        });

        const result = await convex.action('discord_bot:handleDiscordCommand', {
          commandName: 'search',
          options: commandOptions,
          userId: interaction.user.id,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
        });

        console.log('Convex action result:', result);

        // The result contains the Discord response format
        if (result.data && result.data.content) {
          await interaction.editReply({
            content: result.data.content,
          });
        } else {
          await interaction.editReply({
            content: "❌ Unexpected response format",
          });
        }

      } catch (error) {
        console.error('Search error:', error);
        await interaction.editReply({
          content: `❌ Search failed: ${error.message || "Unknown error"}`,
        });
      }
    }

    if (commandName === 'help') {
      try {
        const result = await convex.action('discord_bot:handleDiscordCommand', {
          commandName: 'help',
          options: [],
          userId: interaction.user.id,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
        });

        await interaction.reply({
          content: result.data.content,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Help error:', error);
        await interaction.reply({
          content: "❌ Failed to show help",
          ephemeral: true,
        });
      }
    }

    if (commandName === 'stats') {
      try {
        const result = await convex.action('discord_bot:handleDiscordCommand', {
          commandName: 'stats',
          options: [],
          userId: interaction.user.id,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
        });

        await interaction.reply({
          content: result.data.content,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Stats error:', error);
        await interaction.reply({
          content: "❌ Failed to fetch statistics",
          ephemeral: true,
        });
      }
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

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Login with error handling
console.log('Attempting to login to Discord...');
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('Failed to login to Discord:', error);
  process.exit(1);
});
