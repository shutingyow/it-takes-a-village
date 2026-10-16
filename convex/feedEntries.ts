import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTrackerBySecret } from "./lib/caregivers";

const bottleTemperatureValidator = v.union(
  v.literal("room"),
  v.literal("warm40")
);

const bottleMilkValidator = v.union(
  v.literal("formula"),
  v.literal("breastmilk")
);

/** Optional minutes. Non-positive or non-finite values are treated as unset. */
function storedDurationMinutes(
  durationMinutes: number | undefined,
  duration: number | undefined
): number | undefined {
  const raw = durationMinutes ?? duration;
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.min(24 * 60, Math.round(raw));
}

function inferBottleMilkFromNotes(
  notes: string | undefined
): "formula" | "breastmilk" | null {
  if (!notes) return null;
  const lower = notes.toLowerCase();
  if (lower.includes("breastmilk") || lower.includes("breast milk")) {
    return "breastmilk";
  }
  if (lower.includes("formula")) {
    return "formula";
  }
  return null;
}

// Create a feed entry
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("breast"), v.literal("bottle")),
    side: v.optional(v.union(v.literal("left"), v.literal("right"))),
    duration: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    amount: v.optional(v.number()),
    bottleMilk: v.optional(bottleMilkValidator),
    bottleTemperature: v.optional(bottleTemperatureValidator),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("feedEntries"),
  handler: async (ctx, args) => {
    const minutes = storedDurationMinutes(args.durationMinutes, args.duration);
    return await ctx.db.insert("feedEntries", {
      trackerId: args.trackerId,
      caregiverName: args.caregiverName,
      type: args.type,
      side: args.type === "breast" ? args.side : undefined,
      duration: minutes,
      durationMinutes: minutes,
      amount: args.type === "bottle" ? args.amount : undefined,
      bottleMilk: args.type === "bottle" ? args.bottleMilk : undefined,
      bottleTemperature:
        args.type === "bottle" ? args.bottleTemperature : undefined,
      timestamp: args.timestamp,
      notes: args.notes,
      photoIds: args.photoIds,
    });
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

// Update a feed entry (full replace of editable fields)
export const update = mutation({
  args: {
    entryId: v.id("feedEntries"),
    type: v.union(v.literal("breast"), v.literal("bottle")),
    side: v.optional(v.union(v.literal("left"), v.literal("right"))),
    duration: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    amount: v.optional(v.number()),
    bottleMilk: v.optional(bottleMilkValidator),
    bottleTemperature: v.optional(bottleTemperatureValidator),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.entryId);
    if (!existing) {
      throw new Error("Feed entry not found");
    }

    const minutes = storedDurationMinutes(args.durationMinutes, args.duration);

    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      type: args.type,
      side: args.type === "breast" ? args.side : undefined,
      duration: minutes,
      durationMinutes: minutes,
      amount: args.type === "bottle" ? args.amount : undefined,
      bottleMilk: args.type === "bottle" ? args.bottleMilk : undefined,
      bottleTemperature:
        args.type === "bottle" ? args.bottleTemperature : undefined,
      timestamp: args.timestamp,
      notes: args.notes,
      photoIds: args.photoIds,
    });
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

/**
 * One-off: set bottleMilk from notes for bottle feeds missing the field.
 * Pass secretLink to limit to one tracker; omit to backfill all trackers.
 */
export const backfillBottleMilk = mutation({
  args: {
    secretLink: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    bottleMissing: v.number(),
    updated: v.number(),
    formula: v.number(),
    breastmilk: v.number(),
    unmatched: v.number(),
  }),
  handler: async (ctx, args) => {
    let feeds;
    if (args.secretLink) {
      const tracker = await getTrackerBySecret(ctx, args.secretLink);
      if (!tracker) {
        throw new Error("Tracker not found");
      }
      feeds = await ctx.db
        .query("feedEntries")
        .withIndex("by_tracker", (q) => q.eq("trackerId", tracker._id))
        .collect();
    } else {
      feeds = await ctx.db.query("feedEntries").collect();
    }

    let bottleMissing = 0;
    let updated = 0;
    let formula = 0;
    let breastmilk = 0;
    let unmatched = 0;

    for (const feed of feeds) {
      if (feed.type !== "bottle") continue;
      if (feed.bottleMilk === "formula" || feed.bottleMilk === "breastmilk") {
        continue;
      }
      bottleMissing += 1;
      const inferred = inferBottleMilkFromNotes(feed.notes);
      if (!inferred) {
        unmatched += 1;
        continue;
      }
      await ctx.db.patch(feed._id, { bottleMilk: inferred });
      updated += 1;
      if (inferred === "formula") formula += 1;
      else breastmilk += 1;
    }

    return {
      scanned: feeds.length,
      bottleMissing,
      updated,
      formula,
      breastmilk,
      unmatched,
    };
  },
});

/** Count bottle milk kinds for a tracker (post-backfill verification). */
export const bottleMilkStats = query({
  args: {
    secretLink: v.string(),
  },
  returns: v.object({
    bottleTotal: v.number(),
    formula: v.number(),
    breastmilk: v.number(),
    missing: v.number(),
  }),
  handler: async (ctx, args) => {
    const tracker = await getTrackerBySecret(ctx, args.secretLink);
    if (!tracker) {
      throw new Error("Tracker not found");
    }
    const feeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", tracker._id))
      .collect();

    let bottleTotal = 0;
    let formula = 0;
    let breastmilk = 0;
    let missing = 0;
    for (const feed of feeds) {
      if (feed.type !== "bottle") continue;
      bottleTotal += 1;
      if (feed.bottleMilk === "formula") formula += 1;
      else if (feed.bottleMilk === "breastmilk") breastmilk += 1;
      else missing += 1;
    }
    return { bottleTotal, formula, breastmilk, missing };
  },
});
