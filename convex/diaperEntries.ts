import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a diaper entry
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
    colour: v.optional(
      v.union(
        v.literal("yellow"),
        v.literal("green"),
        v.literal("brown"),
        v.literal("black"),
        v.literal("red"),
        v.literal("white"),
        v.literal("other")
      )
    ),
    consistency: v.optional(
      v.union(
        v.literal("seedy"),
        v.literal("loose"),
        v.literal("firm"),
        v.literal("watery"),
        v.literal("mucous"),
        v.literal("other")
      )
    ),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
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

// Update a diaper entry (full replace of editable fields)
export const update = mutation({
  args: {
    entryId: v.id("diaperEntries"),
    type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
    colour: v.optional(
      v.union(
        v.literal("yellow"),
        v.literal("green"),
        v.literal("brown"),
        v.literal("black"),
        v.literal("red"),
        v.literal("white"),
        v.literal("other")
      )
    ),
    consistency: v.optional(
      v.union(
        v.literal("seedy"),
        v.literal("loose"),
        v.literal("firm"),
        v.literal("watery"),
        v.literal("mucous"),
        v.literal("other")
      )
    ),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.entryId);
    if (!existing) {
      throw new Error("Diaper entry not found");
    }

    const hasStool = args.type === "dirty" || args.type === "both";
    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      type: args.type,
      colour: hasStool ? args.colour : undefined,
      consistency: hasStool ? args.consistency : undefined,
      timestamp: args.timestamp,
      notes: args.notes,
      photoIds: args.photoIds,
    });
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
