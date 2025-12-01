import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Discord bot search endpoint
http.route({
  path: "/discord/search",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { query, userId, platform } = await request.json();
      
      if (!query || typeof query !== 'string') {
        return new Response(JSON.stringify({ error: "Query is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const results = await ctx.runAction(api.breaches.searchBreaches, {
        query,
        userId,
        platform: platform || "discord",
      });

      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Discord search error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Revolt bot search endpoint
http.route({
  path: "/revolt/search",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { query, userId, platform } = await request.json();
      
      if (!query || typeof query !== 'string') {
        return new Response(JSON.stringify({ error: "Query is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const results = await ctx.runAction(api.breaches.searchBreaches, {
        query,
        userId,
        platform: platform || "revolt",
      });

      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Revolt search error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Bot stats endpoint
http.route({
  path: "/bot/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const stats = await ctx.runQuery(api.bots.getBotStats);
      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Stats error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Download results endpoint
http.route({
  path: "/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const searchId = url.searchParams.get("searchId");
    const format = url.searchParams.get("format") || "txt";

    if (!searchId) {
      return new Response("Missing searchId parameter", { status: 400 });
    }

    try {
      // Get all results for this search from the database
      const results = await ctx.runQuery(api.breaches.getSearchResults, { 
        searchId: searchId as any 
      });

      if (!results || results.length === 0) {
        return new Response("No results found", { status: 404 });
      }

      let content: string;
      let contentType: string;
      let filename: string;

      switch (format.toLowerCase()) {
        case "json":
          content = JSON.stringify(results, null, 2);
          contentType = "application/json";
          filename = `breach_results_${searchId}.json`;
          break;

        case "html":
          content = generateHtmlReport(results);
          contentType = "text/html";
          filename = `breach_results_${searchId}.html`;
          break;

        case "txt":
        default:
          content = generateTextReport(results);
          contentType = "text/plain";
          filename = `breach_results_${searchId}.txt`;
          break;
      }

      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Download error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }),
});

function generateTextReport(results: any[]): string {
  let report = `Breach Search Results\n`;
  report += `Total Results: ${results.length}\n`;
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `${"=".repeat(50)}\n\n`;

  results.forEach((result, index) => {
    report += `Result #${index + 1}\n`;
    report += `Breach: ${result.breachName}\n`;
    if (result.breachDate) {
      report += `Date: ${result.breachDate}\n`;
    }
    report += `Matched Field: ${result.matchedField}\n`;
    report += `Content: ${result.content}\n`;
    if (result.dataTypes && result.dataTypes.length > 0) {
      report += `Data Types: ${result.dataTypes.join(", ")}\n`;
    }
    report += `${"-".repeat(30)}\n\n`;
  });

  return report;
}

function generateHtmlReport(results: any[]): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Breach Search Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .result { border: 1px solid #ddd; margin-bottom: 15px; padding: 15px; border-radius: 5px; }
        .breach-name { font-weight: bold; color: #d32f2f; font-size: 1.1em; }
        .field { margin: 5px 0; }
        .label { font-weight: bold; }
        .content { background: #f9f9f9; padding: 10px; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Breach Search Results</h1>
        <p><strong>Total Results:</strong> ${results.length}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
    </div>`;

  results.forEach((result, index) => {
    html += `
    <div class="result">
        <div class="breach-name">Result #${index + 1}: ${result.breachName}</div>
        ${result.breachDate ? `<div class="field"><span class="label">Date:</span> ${result.breachDate}</div>` : ''}
        <div class="field"><span class="label">Matched Field:</span> ${result.matchedField}</div>
        <div class="field"><span class="label">Content:</span></div>
        <div class="content">${result.content}</div>
        ${result.dataTypes && result.dataTypes.length > 0 ? 
          `<div class="field"><span class="label">Data Types:</span> ${result.dataTypes.join(", ")}</div>` : ''}
    </div>`;
  });

  html += `
</body>
</html>`;

  return html;
}

export default http;
