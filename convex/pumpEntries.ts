import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a pump entry
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    amount: v.number(),
    side: v.optional(v.union(v.literal("left"), v.literal("right"), v.literal("both"))),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("pumpEntries"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("pumpEntries", args);
  },
});

// Get recent pump entries
export const getRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

// Get last pump entry
export const getLast = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .first();
  },
});

// Update a pump entry (full replace of editable fields)
export const update = mutation({
  args: {
    entryId: v.id("pumpEntries"),
    amount: v.number(),
    side: v.optional(v.union(v.literal("left"), v.literal("right"), v.literal("both"))),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.entryId);
    if (!existing) {
      throw new Error("Pump entry not found");
    }

    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      amount: args.amount,
      side: args.side,
      timestamp: args.timestamp,
      notes: args.notes,
      photoIds: args.photoIds,
    });
    return null;
  },
});

// Delete a pump entry
export const remove = mutation({
  args: {
    entryId: v.id("pumpEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
    return null;
  },
});
