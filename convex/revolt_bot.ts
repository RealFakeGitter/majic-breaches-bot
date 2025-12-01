"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const handleRevoltCommandNew = action({
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

          // Check if API token is configured
          const apiToken = process.env.LEAKOSINT_API_TOKEN;
          if (!apiToken) {
            return {
              content: "❌ API token not configured. Please contact administrator."
            };
          }

          // Perform the search using the existing breach search function
          const searchResult = await ctx.runAction(api.breaches.searchBreaches, {
            query
          });

          // Get the results
          const results = await ctx.runQuery(api.breaches.getSearchResults, {
            searchId: searchResult.searchId
          });

          if (!results || results.length === 0) {
            return {
              content: `🔍 **Search Results for "${query}"**\n\n❌ No results found.`
            };
          }

          // If we have more than 3 results, create a text file
          if (searchResult.resultCount > 3) {
            // Create detailed text file content
            let fileContent = `Search Results for: ${query}\n`;
            fileContent += `Total Results Found: ${searchResult.resultCount}\n`;
            fileContent += `Search Date: ${new Date().toISOString()}\n`;
            fileContent += `${"=".repeat(60)}\n\n`;

            for (let i = 0; i < results.length; i++) {
              const result = results[i];
              fileContent += `Result #${i + 1}\n`;
              fileContent += `Breach: ${result.breachName}\n`;
              fileContent += `Matched Field: ${result.matchedField}\n`;
              fileContent += `Data Types: ${result.dataTypes.join(", ")}\n`;
              fileContent += `Content: ${result.content}\n`;
              if (result.breachDate) {
                fileContent += `Breach Date: ${result.breachDate}\n`;
              }
              if (result.breachDescription) {
                fileContent += `Description: ${result.breachDescription}\n`;
              }
              fileContent += `${"-".repeat(40)}\n\n`;
            }

            // Store the file in Convex storage
            const blob = new Blob([fileContent], { type: 'text/plain' });
            const storageId = await ctx.storage.store(blob);

            // Get the URL - note this will be a temporary signed URL
            let fileUrl: string | null = null;
            try {
              fileUrl = await ctx.storage.getUrl(storageId);
            } catch (error) {
              console.error("Error getting storage URL:", error);
              fileUrl = null;
            }

            // Format brief response message
            const displayResults = results.slice(0, 3);
            let response = `🔍 **Search Results for "${query.substring(0, 50)}${query.length > 50 ? "..." : ""}"**\n`;
            response += `📊 Found ${searchResult.resultCount} total results (showing first ${displayResults.length})\n\n`;

            for (const result of displayResults) {
              response += `**${result.breachName}**\n`;
              response += `🎯 ${result.matchedField} | `;
              response += `📋 ${result.dataTypes.slice(0, 3).join(", ")}\n`;
              response += `\`\`\`\n${result.content.substring(0, 120)}${result.content.length > 120 ? "..." : ""}\n\`\`\`\n\n`;
            }

            if (fileUrl) {
              response += `📎 **Complete results:** ${fileUrl}`;
              
              return {
                content: response,
                fileUrl: fileUrl,
                fileName: `breach_search_${query.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`
              };
            } else {
              response += `📎 **Complete results file created but URL unavailable**`;
              
              return {
                content: response
              };
            }
          } else {
            // Format results for Revolt (3 or fewer results)
            const displayResults = results;
            let response = `🔍 **Search Results for "${query}"**\n\n`;
            response += `📊 Found ${searchResult.resultCount} total results\n\n`;

            for (const result of displayResults) {
              response += `**${result.breachName}**\n`;
              if (result.breachDescription) {
                response += `*${result.breachDescription}*\n`;
              }
              response += `🎯 Match: ${result.matchedField}\n`;
              response += `📋 Data Types: ${result.dataTypes.join(", ")}\n`;
              response += `\`\`\`\n${result.content.substring(0, 150)}${result.content.length > 150 ? "..." : ""}\n\`\`\`\n\n`;
            }

            return {
              content: response
            };
          }
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

        case "test": {
          return {
            content: "✅ Revolt bot communication with Convex is working!"
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
