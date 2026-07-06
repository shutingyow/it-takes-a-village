import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a diaper entry
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("diaperEntries"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("diaperEntries", args);
  },
});

// Get recent diaper entries
export const getRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

// Get last diaper entry
export const getLast = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .first();
  },
});

// Update a diaper entry
export const update = mutation({
  args: {
    entryId: v.id("diaperEntries"),
    type: v.optional(v.union(v.literal("wet"), v.literal("dirty"), v.literal("both"))),
    timestamp: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entryId, ...updates } = args;
    
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await ctx.db.patch(entryId, cleanUpdates);
    return null;
  },
});

// Delete a diaper entry
export const remove = mutation({
  args: {
    entryId: v.id("diaperEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
    return null;
  },
});
