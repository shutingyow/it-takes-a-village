import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Start a sleep session
export const start = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("nap"), v.literal("night")),
    startTime: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("sleepEntries"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("sleepEntries", {
      trackerId: args.trackerId,
      caregiverName: args.caregiverName,
      type: args.type,
      startTime: args.startTime,
      endTime: undefined, // Active sleep
      notes: args.notes,
    });
  },
});

// End a sleep session
export const end = mutation({
  args: {
    entryId: v.id("sleepEntries"),
    endTime: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entryId, {
      endTime: args.endTime,
    });
    return null;
  },
});

// Create a completed sleep entry (retrospective logging)
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("nap"), v.literal("night")),
    startTime: v.number(),
    endTime: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("sleepEntries"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("sleepEntries", args);
  },
});

// Get active sleep session
export const getActive = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    // Find sleep entry where endTime is not set
    const allSleep = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();
    
    return allSleep.find(sleep => sleep.endTime === undefined) ?? null;
  },
});

// Get recent sleep entries
export const getRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

// Get last completed sleep entry
export const getLast = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(10);
    
    // Find the most recent completed sleep
    return entries.find(entry => entry.endTime !== undefined) ?? null;
  },
});

// Update a sleep entry
export const update = mutation({
  args: {
    entryId: v.id("sleepEntries"),
    type: v.optional(v.union(v.literal("nap"), v.literal("night"))),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
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

// Delete a sleep entry
export const remove = mutation({
  args: {
    entryId: v.id("sleepEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
    return null;
  },
});
