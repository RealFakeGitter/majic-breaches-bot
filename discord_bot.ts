"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const handleDiscordCommand = action({
  args: {
    commandName: v.string(),
    options: v.array(v.object({
      name: v.string(),
      value: v.union(v.string(), v.number(), v.boolean()),
    })),
    userId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      switch (args.commandName) {
        case "search": {
          const queryOption = args.options.find(opt => opt.name === "query");
          const limitOption = args.options.find(opt => opt.name === "limit");
          
          if (!queryOption || typeof queryOption.value !== "string") {
            return {
              type: 4,
              data: {
                content: "❌ Please provide a search query!",
                flags: 64 // Ephemeral
              }
            };
          }

          const query = queryOption.value;
          const limit = limitOption && typeof limitOption.value === "number" ? limitOption.value : 100;

          // Perform the search using the existing breach search function
          const searchResult = await ctx.runAction(api.breaches.searchBreaches, {
            query,
            limit
          });

          // Get the results
          const results = await ctx.runQuery(api.breaches.getSearchResults, {
            searchId: searchResult.searchId
          });

          if (!results || results.results.length === 0) {
            return {
              type: 4,
              data: {
                content: `🔍 **Search Results for "${query}"**\n\n❌ No results found.`,
                flags: 64 // Ephemeral
              }
            };
          }

          // Format results for Discord (limit to first 5 results to avoid message length limits)
          const displayResults = results.results.slice(0, 5);
          let response = `🔍 **Search Results for "${query}"**\n\n`;
          response += `📊 Found ${searchResult.resultCount} total results (showing first ${displayResults.length})\n\n`;

          for (const result of displayResults) {
            response += `**${result.breachName}**\n`;
            if (result.breachDescription) {
              response += `*${result.breachDescription}*\n`;
            }
            response += `🎯 Match: ${result.matchedField}\n`;
            response += `📋 Data Types: ${result.dataTypes.join(", ")}\n`;
            response += `\`\`\`\n${result.content.substring(0, 200)}${result.content.length > 200 ? "..." : ""}\n\`\`\`\n\n`;
          }

          if (searchResult.resultCount > 5) {
            response += `*Use the web interface for all ${searchResult.resultCount} results*`;
          }

          return {
            type: 4,
            data: {
              content: response,
              flags: 64 // Ephemeral
            }
          };
        }

        case "stats": {
          const stats: any = await ctx.runQuery(api.bots.getBotStats);
          
          return {
            type: 4,
            data: {
              content: `📊 **Bot Statistics**\n\n🔍 Total Searches: ${stats.totalSearches.toLocaleString()}\n📋 Total Results: ${stats.totalResults.toLocaleString()}`,
              flags: 64 // Ephemeral
            }
          };
        }

        case "help": {
          return {
            type: 4,
            data: {
              content: `🤖 **Majic Breaches Bot Help**\n\n**Commands:**\n\`/search <query> [limit]\` - Search data breaches\n\`/stats\` - Show bot statistics\n\`/help\` - Show this help message\n\n**Examples:**\n\`/search john@example.com\`\n\`/search username123 500\`\n\n⚠️ This bot is for educational and security research purposes only.`,
              flags: 64 // Ephemeral
            }
          };
        }

        default:
          return {
            type: 4,
            data: {
              content: "❌ Unknown command. Use `/help` for available commands.",
              flags: 64 // Ephemeral
            }
          };
      }
    } catch (error) {
      console.error("Discord command error:", error);
      return {
        type: 4,
        data: {
          content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          flags: 64 // Ephemeral
        }
      };
    }
  },
});
