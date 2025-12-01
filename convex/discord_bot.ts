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
      type: v.optional(v.number()),
    })),
    userId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("Discord command received:", JSON.stringify(args, null, 2));
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

          console.log("About to call searchBreaches with:", { query, limit });

          // Check if API token is configured
          const apiToken = process.env.LEAKOSINT_API_TOKEN;
          console.log("API token check:", apiToken ? "Token exists" : "Token missing");
          if (!apiToken) {
            console.error("LEAKOSINT_API_TOKEN not configured");
            return {
              type: 4,
              data: {
                content: "❌ API token not configured. Please contact administrator.",
                flags: 64
              }
            };
          }

          console.log("Calling searchBreaches action...");
          // Perform the search using the existing breach search function
          const searchResult = await ctx.runAction(api.breaches.searchBreaches, {
            query
          });
          console.log("searchBreaches completed successfully:", searchResult);

          // Get the results
          const results = await ctx.runQuery(api.breaches.getSearchResults, {
            searchId: searchResult.searchId
          });

          if (!results || results.length === 0) {
            return {
              type: 4,
              data: {
                content: `🔍 **Search Results for "${query}"**\n\n❌ No results found.`,
                flags: 64 // Ephemeral
              }
            };
          }

          // Format results for Discord - consistent with embed version
          const displayResults = results.slice(0, 2); // Match embed version
          let response = `🔍 **Breach Search Results**\n\nFound **${searchResult.resultCount}** results for: **${query.substring(0, 50)}${query.length > 50 ? "..." : ""}**\n\n`;

          for (const result of displayResults) {
            const breachName = result.breachName.length > 200 
              ? result.breachName.substring(0, 200) + '...' 
              : result.breachName;
            
            response += `**${breachName}**\n`;
            response += `🎯 Match: ${result.matchedField}\n`;
            response += `📋 Fields: ${result.dataTypes.join(", ")}\n`;
            
            if (result.content) {
              response += `\n**🔍 Breach Data:**\n`;
              const lines = result.content.split('\n').filter((line: string) => line.trim()).slice(0, 3);
              lines.forEach((line: string) => response += `\`${line}\`\n`);
            }
            response += '\n';
          }

          if (searchResult.resultCount > 2) {
            response += `*... and ${searchResult.resultCount - 2} more results*\n\n`;
          }

          // Add link to view all results on the web
          const siteUrl = "https://insightful-mongoose-187.convex.cloud";
          response += `🔗 **[View Full Results](${siteUrl}/results?id=${searchResult.searchId})**`;

          // Ensure we don't exceed Discord's 2000 character limit
          if (response.length > 1800) {
            response = response.substring(0, 1800) + "...\n\n*Response truncated*";
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
          console.log("Help command executed successfully");
          return {
            type: 4,
            data: {
              content: `🤖 **Majic Breaches Bot Help**\n\n**Commands:**\n\`/search <query> [limit]\` - Search data breaches\n\`/stats\` - Show bot statistics\n\`/help\` - Show this help message\n\n**Examples:**\n\`/search john@example.com\`\n\`/search username123 500\`\n\n⚠️ This bot is for educational and security research purposes only.`,
              flags: 64 // Ephemeral
            }
          };
        }

        case "test": {
          console.log("Test command executed");
          return {
            type: 4,
            data: {
              content: "✅ Discord bot communication with Convex is working!",
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
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Full error details:", JSON.stringify(error, null, 2));
      return {
        type: 4,
        data: {
          content: `❌ Error: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? "..." : ""}`,
          flags: 64 // Ephemeral
        }
      };
    }
  },
});
