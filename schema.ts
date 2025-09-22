import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  searches: defineTable({
    query: v.string(),
    userId: v.optional(v.id("users")),
    timestamp: v.number(),
    resultCount: v.number(),
  }).index("by_user", ["userId"]),
  
  breachResults: defineTable({
    searchId: v.id("searches"),
    breachName: v.string(),
    breachDate: v.optional(v.string()),
    breachDescription: v.optional(v.string()),
    dataTypes: v.array(v.string()),
    content: v.string(), // The actual breach content
    matchedField: v.string(), // Which field matched the search
    recordCount: v.optional(v.number()),
  }).index("by_search", ["searchId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
