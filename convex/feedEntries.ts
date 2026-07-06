import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a feed entry
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("breast"), v.literal("bottle")),
    side: v.optional(v.union(v.literal("left"), v.literal("right"))),
    duration: v.optional(v.number()),
    amount: v.optional(v.number()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("feedEntries"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedEntries", args);
  },
});

// Get recent feed entries for a tracker
export const getRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

// Get last feed entry
export const getLast = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .first();
  },
});

// Update a feed entry
export const update = mutation({
  args: {
    entryId: v.id("feedEntries"),
    type: v.optional(v.union(v.literal("breast"), v.literal("bottle"))),
    side: v.optional(v.union(v.literal("left"), v.literal("right"))),
    duration: v.optional(v.number()),
    amount: v.optional(v.number()),
    timestamp: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entryId, ...updates } = args;
    
    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await ctx.db.patch(entryId, cleanUpdates);
    return null;
  },
});

// Delete a feed entry
export const remove = mutation({
  args: {
    entryId: v.id("feedEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
    return null;
  },
});
