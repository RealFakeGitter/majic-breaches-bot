import { Client } from 'revolt.js';
import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client();
const convex = new ConvexHttpClient(process.env.CONVEX_URL);

client.on('ready', async () => {
  console.log(`✅ Revolt bot logged in as ${client.user.username}!`);
});

client.on('message', async (message) => {
  // Ignore messages from the bot itself
  if (message.author_id === client.user._id) return;

  const content = message.content?.trim();
  if (!content || !content.startsWith('!breach')) return;

  const parts = content.split(' ');
  const command = parts[1]?.toLowerCase();

  try {
    if (command === 'search') {
      const query = parts.slice(2).join(' ');
      
      if (!query) {
        await message.reply({
          content: "❌ Please provide a search query!\nUsage: `!breach search <query>`",
        });
        return;
      }

      // Send initial "searching" message
      const searchingMsg = await message.reply({
        content: "🔍 Searching breaches...",
      });

      try {
        // Call your existing Convex action
        const result = await convex.action('breaches:searchBreaches', {
          query,
          limit: 100,
        });

        // Get the results
        const searchResults = await convex.query('breaches:getSearchResults', {
          searchId: result.searchId,
        });

        if (!searchResults || searchResults.results.length === 0) {
          await searchingMsg.edit({
            content: `❌ No results found for "${query}"`,
          });
          return;
        }

        // Format results for Revolt
        const resultText = searchResults.results.slice(0, 3).map((result, index) => {
          const truncatedContent = result.content.length > 150 
            ? result.content.substring(0, 150) + "..." 
            : result.content;
          
          return `**${index + 1}. ${result.breachName}**\n` +
                 `Match: \`${result.matchedField}\`\n` +
                 `\`\`\`\n${truncatedContent}\n\`\`\``;
        }).join("\n\n");

        await searchingMsg.edit({
          content: `🔍 **Search Results for "${query}"**\n\n` +
                   `Found ${result.resultCount} total results. Showing first 3:\n\n` +
                   resultText +
                   `\n\n⚠️ For educational purposes only`,
        });

      } catch (error) {
        await searchingMsg.edit({
          content: `❌ Search failed: ${error.message || "Unknown error"}`,
        });
      }
    }

    else if (command === 'help') {
      await message.reply({
        content: `🔍 **Majic Breaches Bot**\n\n` +
                 `**Commands:**\n` +
                 `\`!breach search <query>\` - Search for breaches\n` +
                 `\`!breach stats\` - Show bot statistics\n` +
                 `\`!breach help\` - Show this help message\n\n` +
                 `**Examples:**\n` +
                 `\`!breach search john@example.com\`\n` +
                 `\`!breach search username123\`\n\n` +
                 `⚠️ For educational and security research purposes only`,
      });
    }

    else if (command === 'stats') {
      const stats = await convex.query('bots:getBotStats');
      
      await message.reply({
        content: `📊 **Bot Statistics**\n\n` +
                 `**Total Searches:** ${stats.totalSearches}\n` +
                 `**Total Results Found:** ${stats.totalResults}`,
      });
    }

    else {
      await message.reply({
        content: "❌ Unknown command. Use `!breach help` for available commands.",
      });
    }

  } catch (error) {
    console.error('Error handling message:', error);
    await message.reply({
      content: "❌ An error occurred while processing your request.",
    });
  }
});

client.loginBot(process.env.REVOLT_BOT_TOKEN);
