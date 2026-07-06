import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a health entry
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("temperature"), v.literal("medication"), v.literal("weight")),
    temperature: v.optional(v.number()),
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    weight: v.optional(v.number()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("healthEntries"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("healthEntries", args);
  },
});

// Get recent health entries
export const getRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

// Get recent health entries by type
export const getByType = query({
  args: {
    trackerId: v.id("trackers"),
    type: v.union(v.literal("temperature"), v.literal("medication"), v.literal("weight")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_type", (q) => 
        q.eq("trackerId", args.trackerId).eq("type", args.type)
      )
      .order("desc")
      .take(limit);
  },
});

// Update a health entry
export const update = mutation({
  args: {
    entryId: v.id("healthEntries"),
    type: v.optional(v.union(v.literal("temperature"), v.literal("medication"), v.literal("weight"))),
    temperature: v.optional(v.number()),
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    weight: v.optional(v.number()),
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

// Delete a health entry
export const remove = mutation({
  args: {
    entryId: v.id("healthEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
    return null;
  },
});
