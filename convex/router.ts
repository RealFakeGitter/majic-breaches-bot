import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { sign } from "tweetnacl";
import { decodeUTF8 } from "tweetnacl-util";

const http = httpRouter();

// Search API endpoint for traditional bots
http.route({
  path: "/api/search",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { query, limit = 500, platform } = body;
      
      console.log("API search request:", { query, limit, platform });
      
      if (!query) {
        return new Response(JSON.stringify({ error: "Query is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Perform the search using the existing breach search function
      console.log("About to call searchBreaches action...");
      const searchResult = await ctx.runAction(api.breaches.searchBreaches, {
        query,
        limit
      });
      console.log("searchBreaches completed:", searchResult);

      // Get the results
      const results = await ctx.runQuery(api.breaches.getSearchResults, {
        searchId: searchResult.searchId
      });

      return new Response(JSON.stringify({
        success: true,
        resultCount: searchResult.resultCount,
        results: results?.results || []
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Search API error:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Bot stats API endpoint
http.route({
  path: "/api/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const stats = await ctx.runQuery(api.bots.getBotStats);
      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Stats API error:", error);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Discord webhook handler for interactions
http.route({
  path: "/discord/interactions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("Discord webhook received!");
    
    try {
      // Get the raw body and headers for signature verification
      const rawBody = await request.text();
      const signature = request.headers.get("x-signature-ed25519");
      const timestamp = request.headers.get("x-signature-timestamp");
      
      console.log("Discord headers:", { signature, timestamp });
      console.log("Raw body length:", rawBody.length);
      
      // Verify Discord signature
      const publicKey = process.env.DISCORD_PUBLIC_KEY;
      if (!publicKey) {
        console.error("DISCORD_PUBLIC_KEY not set");
        return new Response("Server configuration error", { status: 500 });
      }
      
      if (!signature || !timestamp) {
        console.error("Missing Discord signature headers");
        return new Response("Unauthorized", { status: 401 });
      }

      if (publicKey && signature && timestamp) {
        try {
          // Create the message that Discord signed
          const message = timestamp + rawBody;
          const messageBytes = new TextEncoder().encode(message);
          
          // Convert hex strings to Uint8Arrays
          const signatureBytes = new Uint8Array(
            signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
          );
          const publicKeyBytes = new Uint8Array(
            publicKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
          );
          
          const isValid = sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
          );
          
          if (!isValid) {
            console.error("Invalid Discord signature");
            return new Response("Unauthorized", { status: 401 });
          }
          console.log("Discord signature verified successfully");
        } catch (verifyError) {
          console.error("Signature verification error:", verifyError);
          return new Response("Unauthorized", { status: 401 });
        }
      }
      
      const body = JSON.parse(rawBody);
      console.log("Discord interaction body:", JSON.stringify(body, null, 2));
      
      // Handle ping verification
      if (body.type === 1) {
        console.log("Discord ping verification");
        return new Response(JSON.stringify({ type: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Handle application commands (slash commands)
      if (body.type === 2) {
        console.log("Discord slash command:", body.data?.name);
        
        const result = await ctx.runAction(api.discord_bot.handleDiscordCommand, {
          commandName: body.data?.name || "",
          options: body.data?.options || [],
          userId: body.member?.user?.id || body.user?.id,
          channelId: body.channel_id,
          guildId: body.guild_id,
        });
        
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Unknown interaction type
      console.log("Unknown Discord interaction type:", body.type);
      return new Response(JSON.stringify({ type: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      
    } catch (error) {
      console.error("Discord webhook error:", error);
      return new Response(JSON.stringify({ 
        type: 4,
        data: {
          content: "❌ Internal error occurred",
          flags: 64
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Test endpoint
http.route({
  path: "/test",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response("Discord webhook is working!", { status: 200 });
  }),
});

// Discord interactions endpoint GET handler (for testing)
http.route({
  path: "/discord/interactions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response("Discord interactions endpoint is ready for POST requests", { status: 200 });
  }),
});

// Revolt bot webhook endpoint
http.route({
  path: "/revolt/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    
    // Verify Revolt webhook (simplified for demo)
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.REVOLT_WEBHOOK_TOKEN;
    
    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    // Handle message events
    if (body.type === "Message" && body.content) {
      const result = await ctx.runAction(api.revolt_bot.handleRevoltCommandNew, {
        content: body.content,
        authorId: body.author,
        channelId: body.channel,
        serverId: body.server,
      });
      
      if (result) {
        // Send response back to Revolt
        const revoltToken = process.env.REVOLT_BOT_TOKEN;
        if (revoltToken) {
          await fetch(`https://api.revolt.chat/channels/${body.channel}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Bot-Token": revoltToken,
            },
            body: JSON.stringify(result),
          });
        }
      }
    }
    
    return new Response("OK", { status: 200 });
  }),
});

export default http;
