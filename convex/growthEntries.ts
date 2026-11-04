import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  assertIsoDate,
  assertNotFarFuture,
  assertRange,
} from "./lib/entryValidation";

const measurementSourceValidator = v.union(
  v.literal("home"),
  v.literal("clinic")
);

const growthEntryReturn = v.object({
  _id: v.id("growthEntries"),
  _creationTime: v.number(),
  trackerId: v.id("trackers"),
  caregiverName: v.string(),
  date: v.string(),
  weight: v.optional(v.number()),
  length: v.optional(v.number()),
  headCircumference: v.optional(v.number()),
  measurementSource: v.optional(measurementSourceValidator),
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
    measurementSource: v.optional(measurementSourceValidator),
    notes: v.optional(v.string()),
    timestamp: v.number(),
  },
  returns: v.id("growthEntries"),
  handler: async (ctx, args) => {
    const date = assertIsoDate(args.date, "Measurement date");
    assertNotFarFuture(args.timestamp);

    const hasWeight = args.weight != null;
    const hasLength = args.length != null;
    const hasHead = args.headCircumference != null;

    if (!hasWeight && !hasLength && !hasHead) {
      throw new Error("Enter at least weight, height, or head circumference");
    }
    if (hasWeight) assertRange(args.weight!, 1, 30, "Weight (kg)");
    if (hasLength) assertRange(args.length!, 35, 90, "Height (cm)");
    if (hasHead) {
      assertRange(args.headCircumference!, 28, 55, "Head circumference (cm)");
    }

    return await ctx.db.insert("growthEntries", {
      ...args,
      date,
      measurementSource: args.measurementSource,
    });
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
    measurementSource: v.optional(measurementSourceValidator),
    notes: v.optional(v.string()),
    timestamp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.entryId);
    if (!existing) {
      throw new Error("Growth entry not found");
    }

    const date = assertIsoDate(args.date, "Measurement date");
    assertNotFarFuture(args.timestamp);

    const hasWeight = args.weight != null;
    const hasLength = args.length != null;
    const hasHead = args.headCircumference != null;

    if (!hasWeight && !hasLength && !hasHead) {
      throw new Error("Enter at least weight, height, or head circumference");
    }
    if (hasWeight) assertRange(args.weight!, 1, 30, "Weight (kg)");
    if (hasLength) assertRange(args.length!, 35, 90, "Height (cm)");
    if (hasHead) {
      assertRange(args.headCircumference!, 28, 55, "Head circumference (cm)");
    }

    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      date,
      weight: args.weight,
      length: args.length,
      headCircumference: args.headCircumference,
      measurementSource:
        args.measurementSource ?? existing.measurementSource,
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
