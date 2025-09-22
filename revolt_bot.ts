"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const handleRevoltCommand = action({
  args: {
    content: v.string(),
    authorId: v.string(),
    channelId: v.string(),
    serverId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      const content = args.content.trim();
      
      // Check if message starts with !breach
      if (!content.startsWith("!breach")) {
        return null; // Not a bot command
      }

      const commandParts = content.split(" ");
      const subCommand = commandParts[1];

      switch (subCommand) {
        case "search": {
          const query = commandParts.slice(2).join(" ");
          
          if (!query) {
            return {
              content: "❌ Please provide a search query! Usage: `!breach search <query>`"
            };
          }

          // Perform the search using the existing breach search function
          const searchResult = await ctx.runAction(api.breaches.searchBreaches, {
            query,
            limit: 100
          });

          // Get the results
          const results = await ctx.runQuery(api.breaches.getSearchResults, {
            searchId: searchResult.searchId
          });

          if (!results || results.results.length === 0) {
            return {
              content: `🔍 **Search Results for "${query}"**\n\n❌ No results found.`
            };
          }

          // Format results for Revolt (limit to first 3 results to avoid message length limits)
          const displayResults = results.results.slice(0, 3);
          let response = `🔍 **Search Results for "${query}"**\n\n`;
          response += `📊 Found ${searchResult.resultCount} total results (showing first ${displayResults.length})\n\n`;

          for (const result of displayResults) {
            response += `**${result.breachName}**\n`;
            if (result.breachDescription) {
              response += `*${result.breachDescription}*\n`;
            }
            response += `🎯 Match: ${result.matchedField}\n`;
            response += `📋 Data Types: ${result.dataTypes.join(", ")}\n`;
            response += `\`\`\`\n${result.content.substring(0, 150)}${result.content.length > 150 ? "..." : ""}\n\`\`\`\n\n`;
          }

          if (searchResult.resultCount > 3) {
            response += `*Use the web interface for all ${searchResult.resultCount} results*`;
          }

          return {
            content: response
          };
        }

        case "stats": {
          const stats: any = await ctx.runQuery(api.bots.getBotStats);
          
          return {
            content: `📊 **Bot Statistics**\n\n🔍 Total Searches: ${stats.totalSearches.toLocaleString()}\n📋 Total Results: ${stats.totalResults.toLocaleString()}`
          };
        }

        case "help": {
          return {
            content: `🤖 **Majic Breaches Bot Help**\n\n**Commands:**\n\`!breach search <query>\` - Search data breaches\n\`!breach stats\` - Show bot statistics\n\`!breach help\` - Show this help message\n\n**Examples:**\n\`!breach search john@example.com\`\n\`!breach search username123\`\n\n⚠️ This bot is for educational and security research purposes only.`
          };
        }

        default:
          return {
            content: "❌ Unknown command. Use `!breach help` for available commands."
          };
      }
    } catch (error) {
      console.error("Revolt command error:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  },
});
