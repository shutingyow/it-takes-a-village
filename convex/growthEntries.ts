import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const growthEntryReturn = v.object({
  _id: v.id("growthEntries"),
  _creationTime: v.number(),
  trackerId: v.id("trackers"),
  caregiverName: v.string(),
  date: v.string(),
  weight: v.optional(v.number()),
  length: v.optional(v.number()),
  headCircumference: v.optional(v.number()),
  notes: v.optional(v.string()),
  timestamp: v.number(),
});

export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    date: v.string(),
    weight: v.optional(v.number()),
    length: v.optional(v.number()),
    headCircumference: v.optional(v.number()),
    notes: v.optional(v.string()),
    timestamp: v.number(),
  },
  returns: v.id("growthEntries"),
  handler: async (ctx, args) => {
    const hasWeight = args.weight != null;
    const hasLength = args.length != null;
    const hasHead = args.headCircumference != null;

    if (!hasWeight && !hasLength && !hasHead) {
      throw new Error("Enter at least weight, height, or head circumference");
    }
    if (hasWeight && (args.weight! < 1 || args.weight! > 30)) {
      throw new Error("Weight must be between 1 kg and 30 kg");
    }
    // Infant-focused ranges (cm); slightly wider than typical for preemies / toddlers
    if (hasLength && (args.length! < 35 || args.length! > 90)) {
      throw new Error("Height must be between 35 cm and 90 cm");
    }
    if (hasHead && (args.headCircumference! < 28 || args.headCircumference! > 55)) {
      throw new Error("Head circumference must be between 28 cm and 55 cm");
    }

    return await ctx.db.insert("growthEntries", args);
  },
});

export const list = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  returns: v.array(growthEntryReturn),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("growthEntries")
      .withIndex("by_tracker_and_date", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

export const getLatest = query({
  args: { trackerId: v.id("trackers") },
  returns: v.union(growthEntryReturn, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("growthEntries")
      .withIndex("by_tracker_and_date", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .first();
  },
});

export const update = mutation({
  args: {
    entryId: v.id("growthEntries"),
    date: v.string(),
    weight: v.optional(v.number()),
    length: v.optional(v.number()),
    headCircumference: v.optional(v.number()),
    notes: v.optional(v.string()),
    timestamp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.entryId);
    if (!existing) {
      throw new Error("Growth entry not found");
    }

    const hasWeight = args.weight != null;
    const hasLength = args.length != null;
    const hasHead = args.headCircumference != null;

    if (!hasWeight && !hasLength && !hasHead) {
      throw new Error("Enter at least weight, height, or head circumference");
    }
    if (hasWeight && (args.weight! < 1 || args.weight! > 30)) {
      throw new Error("Weight must be between 1 kg and 30 kg");
    }
    if (hasLength && (args.length! < 35 || args.length! > 90)) {
      throw new Error("Height must be between 35 cm and 90 cm");
    }
    if (hasHead && (args.headCircumference! < 28 || args.headCircumference! > 55)) {
      throw new Error("Head circumference must be between 28 cm and 55 cm");
    }

    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      date: args.date,
      weight: args.weight,
      length: args.length,
      headCircumference: args.headCircumference,
      notes: args.notes,
      timestamp: args.timestamp,
    });
    return null;
  },
});

export const remove = mutation({
  args: { entryId: v.id("growthEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
    return null;
  },
});

/**
 * One-time: convert legacy inch values to cm.
 * Heuristic — length &lt; 35 and HC &lt; 25 are treated as inches.
 */
export const migrateInchesToCm = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const entries = await ctx.db.query("growthEntries").take(500);
    let updated = 0;
    for (const entry of entries) {
      const patch: { length?: number; headCircumference?: number } = {};
      if (entry.length != null && entry.length < 35) {
        patch.length = Math.round(entry.length * 2.54 * 10) / 10;
      }
      if (entry.headCircumference != null && entry.headCircumference < 25) {
        patch.headCircumference =
          Math.round(entry.headCircumference * 2.54 * 10) / 10;
      }
      if (patch.length != null || patch.headCircumference != null) {
        await ctx.db.patch(entry._id, patch);
        updated += 1;
      }
    }
    return { scanned: entries.length, updated };
  },
});
