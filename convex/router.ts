import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { sign } from "tweetnacl";

// Create a new HTTP router instance
const router = httpRouter();

// Search API endpoint for traditional bots
router.route({
  path: "/api/search",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { query, limit = 500, platform } = body;
      
      // Ensure limit is within LeakOSINT API requirements (100-10000)
      const validLimit = Math.max(100, Math.min(10000, limit));
      
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
        limit: validLimit
      });
      console.log("searchBreaches completed:", searchResult);

      // Get the results
      const results = await ctx.runQuery(api.breaches.getSearchResults, {
        searchId: searchResult.searchId
      });

      return new Response(JSON.stringify({
        success: true,
        resultCount: searchResult.resultCount,
        results: results?.results || [],
        searchId: searchResult.searchId // Include searchId for full results link
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

// Full results viewer endpoint
router.route({
  path: "/results/:searchId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const searchId = url.pathname.split('/').pop();
      
      if (!searchId) {
        return new Response("Search ID is required", { status: 400 });
      }

      // Get the search results
      const results = await ctx.runQuery(api.breaches.getSearchResults, {
        searchId: searchId as any
      });

      if (!results || !results.results || results.results.length === 0) {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Search Results - Majic Breaches</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .no-results { text-align: center; color: #666; font-size: 18px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔍 Majic Breaches - Search Results</h1>
              </div>
              <div class="no-results">
                <p>No results found or search has expired.</p>
              </div>
            </div>
          </body>
          </html>
        `, {
          status: 404,
          headers: { "Content-Type": "text/html" }
        });
      }

      // Generate HTML page with all results
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Search Results - Majic Breaches</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: #f5f5f5; 
              line-height: 1.6;
            }
            .container { 
              max-width: 1000px; 
              margin: 0 auto; 
              background: white; 
              padding: 30px; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #eee; 
              padding-bottom: 20px;
            }
            .result { 
              margin-bottom: 25px; 
              padding: 20px; 
              border: 1px solid #ddd; 
              border-radius: 6px; 
              background: #fafafa;
            }
            .result-title { 
              font-size: 18px; 
              font-weight: bold; 
              color: #333; 
              margin-bottom: 10px;
            }
            .result-meta { 
              color: #666; 
              margin-bottom: 15px; 
              font-size: 14px;
            }
            .result-content { 
              background: #f8f8f8; 
              padding: 15px; 
              border-radius: 4px; 
              font-family: monospace; 
              font-size: 13px; 
              white-space: pre-wrap; 
              word-break: break-all;
              max-height: 300px;
              overflow-y: auto;
              border: 1px solid #e0e0e0;
            }
            .stats { 
              background: #e8f4fd; 
              padding: 15px; 
              border-radius: 6px; 
              margin-bottom: 25px; 
              text-align: center;
            }
            .disclaimer { 
              background: #fff3cd; 
              border: 1px solid #ffeaa7; 
              padding: 15px; 
              border-radius: 6px; 
              margin-top: 30px; 
              text-align: center; 
              color: #856404;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔍 Majic Breaches - Full Search Results</h1>
              <p>Query: <strong>"${results.search?.query || 'Unknown'}"</strong></p>
            </div>
            
            <div class="stats">
              <strong>Total Results Found: ${results.results.length}</strong>
            </div>
            
            ${results.results.map((result, index) => `
              <div class="result">
                <div class="result-title">
                  ${index + 1}. ${result.breachName || 'Unknown Breach'}
                </div>
                <div class="result-meta">
                  <strong>Date:</strong> ${result.breachDate || 'Unknown'} | 
                  <strong>Matched Field:</strong> ${result.matchedField || 'Unknown'} | 
                  <strong>Data Types:</strong> ${(result.dataTypes || []).join(', ') || 'Unknown'}
                </div>
                <div class="result-content">${result.content || 'No content available'}</div>
              </div>
            `).join('')}
            
            <div class="disclaimer">
              ⚠️ <strong>Disclaimer:</strong> This data is for educational and security research purposes only. 
              Use responsibly and in accordance with applicable laws and regulations.
            </div>
          </div>
        </body>
        </html>
      `;

      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    } catch (error) {
      console.error("Full results viewer error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }),
});

// Bot stats API endpoint
router.route({
  path: "/api/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    console.log("Stats API endpoint hit!");
    try {
      const stats = await ctx.runQuery(api.bots.getBotStats);
      console.log("Stats retrieved:", stats);
      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
    } catch (error) {
      console.error("Stats API error:", error);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }
  }),
});

// Discord webhook handler for interactions
router.route({
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
        
        const result = await ctx.runAction(api.discord_minimal.handleDiscordCommand, {
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
router.route({
  path: "/test",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    console.log("Test endpoint hit!");
    return new Response("API Router is working!", { 
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }),
});

// Discord interactions endpoint GET handler (for testing)
router.route({
  path: "/discord/interactions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    console.log("Discord interactions GET endpoint hit!");
    return new Response("Discord interactions endpoint is ready for POST requests", { status: 200 });
  }),
});

// Revolt bot webhook endpoint
router.route({
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

// Simple test endpoint
router.route({
  path: "/simple-test",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response("Simple test working!", { 
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }),
});

export default router;
