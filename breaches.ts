import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

export const searchBreaches = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ searchId: any; resultCount: number }> => {
    const userId = await getAuthUserId(ctx);
    const limit = args.limit || 100;
    
    // Create search record
    const searchId: any = await ctx.runMutation(api.breaches.createSearch, {
      query: args.query,
      userId: userId || undefined,
    });

    try {
      // Make API call to LeakOSINT
      const apiToken = process.env.LEAKOSINT_API_TOKEN;
      if (!apiToken) {
        throw new Error("LeakOSINT API token not configured");
      }

      const requestData = {
        token: apiToken,
        request: args.query,
        limit: limit,
        lang: "en",
        type: "json"
      };

      const response = await fetch("https://leakosintapi.com/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data["Error code"]) {
        throw new Error(`API Error: ${data["Error code"]}`);
      }

      // Process and store results
      let totalResults = 0;
      const breachList = data["List"] || {};

      for (const [breachName, breachData] of Object.entries(breachList)) {
        if (breachName === "No results found") {
          continue;
        }

        const breachInfo = breachData as any;
        const breachRecords = breachInfo["Data"] || [];
        
        for (const record of breachRecords) {
          // Format the breach content
          let content = "";
          let matchedField = "";
          
          for (const [fieldName, fieldValue] of Object.entries(record)) {
            content += `${fieldName}: ${fieldValue}\n`;
            
            // Check if this field contains our search query
            if (String(fieldValue).toLowerCase().includes(args.query.toLowerCase())) {
              matchedField = fieldName;
            }
          }

          await ctx.runMutation(api.breaches.createBreachResult, {
            searchId,
            breachName,
            breachDescription: breachInfo["InfoLeak"] || "",
            content: content.trim(),
            matchedField: matchedField || "unknown",
            dataTypes: Object.keys(record),
          });

          totalResults++;
        }
      }

      // Update search with result count
      await ctx.runMutation(api.breaches.updateSearchCount, {
        searchId,
        resultCount: totalResults,
      });

      return { searchId, resultCount: totalResults };

    } catch (error) {
      console.error("Search error:", error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

export const createSearch = mutation({
  args: {
    query: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("searches", {
      query: args.query,
      userId: args.userId,
      timestamp: Date.now(),
      resultCount: 0,
    });
  },
});

export const updateSearchCount = mutation({
  args: {
    searchId: v.id("searches"),
    resultCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.searchId, {
      resultCount: args.resultCount,
    });
  },
});

export const createBreachResult = mutation({
  args: {
    searchId: v.id("searches"),
    breachName: v.string(),
    breachDescription: v.optional(v.string()),
    content: v.string(),
    matchedField: v.string(),
    dataTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("breachResults", {
      searchId: args.searchId,
      breachName: args.breachName,
      breachDescription: args.breachDescription,
      content: args.content,
      matchedField: args.matchedField,
      dataTypes: args.dataTypes,
    });
  },
});

export const getSearchResults = query({
  args: {
    searchId: v.id("searches"),
  },
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId);
    if (!search) {
      return null;
    }

    const results = await ctx.db
      .query("breachResults")
      .withIndex("by_search", (q) => q.eq("searchId", args.searchId))
      .collect();

    return {
      search,
      results,
    };
  },
});

export const getUserSearches = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("searches")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});
