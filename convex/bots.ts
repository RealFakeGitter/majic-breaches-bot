import { v } from "convex/values";
import { action, query } from "./_generated/server";

export const generateDiscordInvite = query({
  args: {},
  handler: async (ctx) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return null;
    }
    
    const permissions = "2048"; // Send Messages permission
    const scopes = "bot%20applications.commands";
    
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;
  },
});

export const generateRevoltInvite = query({
  args: {},
  handler: async (ctx) => {
    const botId = process.env.REVOLT_BOT_ID;
    if (!botId) {
      return null;
    }
    
    return `https://app.revolt.chat/bot/${botId}`;
  },
});

export const getBotStats = query({
  args: {},
  handler: async (ctx) => {
    const totalSearches = await ctx.db
      .query("searches")
      .collect()
      .then(searches => searches.length);
    
    const totalResults = await ctx.db
      .query("breachResults")
      .collect()
      .then(results => results.length);
    
    return {
      totalSearches,
      totalResults,
    };
  },
});
