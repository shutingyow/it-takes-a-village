import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const IMPORT_TAG = "import:baby_log_23aug_5sep";
const PUMP_IMPORT_TAG = "import:pump_schedule_23aug_5sep";

const feedEntryValidator = v.object({
  type: v.union(v.literal("breast"), v.literal("bottle")),
  amount: v.optional(v.number()),
  bottleMilk: v.optional(
    v.union(v.literal("formula"), v.literal("breastmilk"))
  ),
  timestamp: v.number(),
  notes: v.string(),
  caregiverName: v.string(),
});

const diaperEntryValidator = v.object({
  type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
  timestamp: v.number(),
  notes: v.string(),
  caregiverName: v.string(),
});

const tempEntryValidator = v.object({
  temperature: v.number(),
  timestamp: v.number(),
  notes: v.string(),
  caregiverName: v.string(),
});

const pumpEntryValidator = v.object({
  amount: v.number(),
  side: v.optional(
    v.union(v.literal("left"), v.literal("right"), v.literal("both"))
  ),
  timestamp: v.number(),
  notes: v.string(),
  caregiverName: v.string(),
});

function feedSignature(e: {
  type: "breast" | "bottle" | "solids";
  amount?: number;
  timestamp: number;
  notes: string;
}): string {
  return `feed|${e.type}|${e.timestamp}|${e.amount ?? ""}|${e.notes}`;
}

/** Idempotency key ignores type so re-imports after type correction do not duplicate. */
function diaperSignature(e: {
  timestamp: number;
  notes: string;
}): string {
  return `diaper|${e.timestamp}|${e.notes}`;
}

function tempSignature(e: {
  temperature: number;
  timestamp: number;
  notes: string;
}): string {
  return `temp|${e.temperature}|${e.timestamp}|${e.notes}`;
}

function pumpSignature(e: {
  amount: number;
  timestamp: number;
  notes: string;
}): string {
  return `pump|${e.timestamp}|${e.amount}|${e.notes}`;
}

/**
 * Batch-import parsed baby log rows into an existing tracker.
 * Idempotent: skips rows whose signature already exists (same timestamp + notes + type).
 */
export const importBatch = mutation({
  args: {
    trackerId: v.id("trackers"),
    feeds: v.optional(v.array(feedEntryValidator)),
    diapers: v.optional(v.array(diaperEntryValidator)),
    temps: v.optional(v.array(tempEntryValidator)),
    pumps: v.optional(v.array(pumpEntryValidator)),
  },
  returns: v.object({
    feedsInserted: v.number(),
    feedsSkipped: v.number(),
    diapersInserted: v.number(),
    diapersSkipped: v.number(),
    tempsInserted: v.number(),
    tempsSkipped: v.number(),
    pumpsInserted: v.number(),
    pumpsSkipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    const existingFeeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();
    const existingDiapers = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();
    const existingHealth = await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();
    const existingPumps = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();

    const feedSigs = new Set(
      existingFeeds
        .filter((e) => e.notes?.includes(IMPORT_TAG))
        .map((e) =>
          feedSignature({
            type: e.type,
            amount: e.amount,
            timestamp: e.timestamp,
            notes: e.notes ?? "",
          })
        )
    );
    const diaperSigs = new Set(
      existingDiapers
        .filter((e) => e.notes?.includes(IMPORT_TAG))
        .map((e) =>
          diaperSignature({
            timestamp: e.timestamp,
            notes: e.notes ?? "",
          })
        )
    );
    const tempSigs = new Set(
      existingHealth
        .filter(
          (e) => e.type === "temperature" && e.notes?.includes(IMPORT_TAG)
        )
        .map((e) =>
          tempSignature({
            temperature: e.temperature ?? 0,
            timestamp: e.timestamp,
            notes: e.notes ?? "",
          })
        )
    );
    const pumpSigs = new Set(
      existingPumps
        .filter((e) => e.notes?.includes(PUMP_IMPORT_TAG))
        .map((e) =>
          pumpSignature({
            amount: e.amount,
            timestamp: e.timestamp,
            notes: e.notes ?? "",
          })
        )
    );

    let feedsInserted = 0;
    let feedsSkipped = 0;
    for (const feed of args.feeds ?? []) {
      if (!feed.notes.includes(IMPORT_TAG)) {
        throw new Error("Feed notes must include import tag");
      }
      const sig = feedSignature(feed);
      if (feedSigs.has(sig)) {
        feedsSkipped += 1;
        continue;
      }
      await ctx.db.insert("feedEntries", {
        trackerId: args.trackerId,
        caregiverName: feed.caregiverName,
        type: feed.type,
        amount: feed.amount,
        bottleMilk: feed.bottleMilk,
        timestamp: feed.timestamp,
        notes: feed.notes,
      });
      feedSigs.add(sig);
      feedsInserted += 1;
    }

    let diapersInserted = 0;
    let diapersSkipped = 0;
    for (const diaper of args.diapers ?? []) {
      if (!diaper.notes.includes(IMPORT_TAG)) {
        throw new Error("Diaper notes must include import tag");
      }
      const sig = diaperSignature(diaper);
      if (diaperSigs.has(sig)) {
        diapersSkipped += 1;
        continue;
      }
      await ctx.db.insert("diaperEntries", {
        trackerId: args.trackerId,
        caregiverName: diaper.caregiverName,
        type: diaper.type,
        timestamp: diaper.timestamp,
        notes: diaper.notes,
      });
      diaperSigs.add(sig);
      diapersInserted += 1;
    }

    let tempsInserted = 0;
    let tempsSkipped = 0;
    for (const temp of args.temps ?? []) {
      if (!temp.notes.includes(IMPORT_TAG)) {
        throw new Error("Temp notes must include import tag");
      }
      if (temp.temperature < 35 || temp.temperature > 42) {
        throw new Error(
          `Temperature out of range: ${temp.temperature} (must be 35–42°C)`
        );
      }
      const sig = tempSignature(temp);
      if (tempSigs.has(sig)) {
        tempsSkipped += 1;
        continue;
      }
      await ctx.db.insert("healthEntries", {
        trackerId: args.trackerId,
        caregiverName: temp.caregiverName,
        type: "temperature",
        temperature: temp.temperature,
        timestamp: temp.timestamp,
        notes: temp.notes,
      });
      tempSigs.add(sig);
      tempsInserted += 1;
    }

    let pumpsInserted = 0;
    let pumpsSkipped = 0;
    for (const pump of args.pumps ?? []) {
      if (!pump.notes.includes(PUMP_IMPORT_TAG)) {
        throw new Error("Pump notes must include import tag");
      }
      const sig = pumpSignature(pump);
      if (pumpSigs.has(sig)) {
        pumpsSkipped += 1;
        continue;
      }
      await ctx.db.insert("pumpEntries", {
        trackerId: args.trackerId,
        caregiverName: pump.caregiverName,
        amount: pump.amount,
        side: pump.side,
        timestamp: pump.timestamp,
        notes: pump.notes,
      });
      pumpSigs.add(sig);
      pumpsInserted += 1;
    }

    return {
      feedsInserted,
      feedsSkipped,
      diapersInserted,
      diapersSkipped,
      tempsInserted,
      tempsSkipped,
      pumpsInserted,
      pumpsSkipped,
    };
  },
});

/** Verify import counts for a tracker (tagged rows only). */
export const verifyImport = query({
  args: {
    trackerId: v.id("trackers"),
    importTag: v.optional(v.string()),
    pumpImportTag: v.optional(v.string()),
  },
  returns: v.object({
    babyName: v.optional(v.string()),
    secretLink: v.string(),
    feeds: v.number(),
    bottleFeeds: v.number(),
    breastFeeds: v.number(),
    diapers: v.number(),
    diaperWet: v.number(),
    diaperDirty: v.number(),
    diaperBoth: v.number(),
    temps: v.number(),
    pumps: v.number(),
    tinyBottles: v.number(),
    samplePumpTimestamps: v.array(v.number()),
  }),
  handler: async (ctx, args) => {
    const tag = args.importTag ?? IMPORT_TAG;
    const pumpTag = args.pumpImportTag ?? PUMP_IMPORT_TAG;
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    const feeds = (
      await ctx.db
        .query("feedEntries")
        .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
        .collect()
    ).filter((e) => e.notes?.includes(tag));

    const diapers = (
      await ctx.db
        .query("diaperEntries")
        .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
        .collect()
    ).filter((e) => e.notes?.includes(tag));

    const temps = (
      await ctx.db
        .query("healthEntries")
        .withIndex("by_tracker_and_type", (q) =>
          q.eq("trackerId", args.trackerId).eq("type", "temperature")
        )
        .collect()
    ).filter((e) => e.notes?.includes(tag));

    const pumps = (
      await ctx.db
        .query("pumpEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", args.trackerId)
        )
        .order("asc")
        .collect()
    ).filter((e) => e.notes?.includes(pumpTag));

    return {
      babyName: tracker.babyName,
      secretLink: tracker.secretLink,
      feeds: feeds.length,
      bottleFeeds: feeds.filter((e) => e.type === "bottle").length,
      breastFeeds: feeds.filter((e) => e.type === "breast").length,
      diapers: diapers.length,
      diaperWet: diapers.filter((e) => e.type === "wet").length,
      diaperDirty: diapers.filter((e) => e.type === "dirty").length,
      diaperBoth: diapers.filter((e) => e.type === "both").length,
      temps: temps.length,
      pumps: pumps.length,
      tinyBottles: feeds.filter(
        (e) => e.type === "bottle" && e.amount !== undefined && e.amount > 0 && e.amount < 5
      ).length,
      samplePumpTimestamps: pumps.slice(0, 6).map((e) => e.timestamp),
    };
  },
});

/** Look up tracker by id for scripts. */
export const getTrackerMeta = query({
  args: { trackerId: v.id("trackers") },
  returns: v.union(
    v.object({
      trackerId: v.id("trackers"),
      secretLink: v.string(),
      babyName: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) return null;
    return {
      trackerId: tracker._id as Id<"trackers">,
      secretLink: tracker.secretLink,
      babyName: tracker.babyName,
    };
  },
});

const diaperTypeValidator = v.union(
  v.literal("wet"),
  v.literal("dirty"),
  v.literal("both")
);

/**
 * Patch imported diaper types by timestamp.
 * Matches trackerId + timestamp (+ optional import notes tag).
 * Used to correct a prior wet-only import (Diaper+Poop → both, etc.).
 */
export const fixDiaperTypes = mutation({
  args: {
    trackerId: v.id("trackers"),
    importTag: v.optional(v.string()),
    corrections: v.array(
      v.object({
        timestamp: v.number(),
        type: diaperTypeValidator,
      })
    ),
  },
  returns: v.object({
    secretLink: v.string(),
    updated: v.number(),
    alreadyCorrect: v.number(),
    missing: v.number(),
    ambiguous: v.number(),
    byType: v.object({
      wet: v.number(),
      dirty: v.number(),
      both: v.number(),
    }),
    missingTimestamps: v.array(v.number()),
  }),
  handler: async (ctx, args) => {
    const tag = args.importTag ?? IMPORT_TAG;
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    const imported = (
      await ctx.db
        .query("diaperEntries")
        .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
        .collect()
    ).filter((e) => e.notes?.includes(tag));

    const byTimestamp = new Map<number, typeof imported>();
    for (const entry of imported) {
      const list = byTimestamp.get(entry.timestamp) ?? [];
      list.push(entry);
      byTimestamp.set(entry.timestamp, list);
    }

    let updated = 0;
    let alreadyCorrect = 0;
    let missing = 0;
    let ambiguous = 0;
    const missingTimestamps: number[] = [];

    for (const correction of args.corrections) {
      const matches = byTimestamp.get(correction.timestamp) ?? [];
      if (matches.length === 0) {
        missing += 1;
        if (missingTimestamps.length < 20) {
          missingTimestamps.push(correction.timestamp);
        }
        continue;
      }
      if (matches.length > 1) {
        ambiguous += 1;
      }
      // Patch all matches at this timestamp (should usually be one).
      for (const entry of matches) {
        if (entry.type === correction.type) {
          alreadyCorrect += 1;
          continue;
        }
        await ctx.db.patch(entry._id, { type: correction.type });
        updated += 1;
      }
    }

    const after = (
      await ctx.db
        .query("diaperEntries")
        .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
        .collect()
    ).filter((e) => e.notes?.includes(tag));

    return {
      secretLink: tracker.secretLink,
      updated,
      alreadyCorrect,
      missing,
      ambiguous,
      byType: {
        wet: after.filter((e) => e.type === "wet").length,
        dirty: after.filter((e) => e.type === "dirty").length,
        both: after.filter((e) => e.type === "both").length,
      },
      missingTimestamps,
    };
  },
});

/** Count imported diaper entries by type for a tracker (via secretLink). */
export const countDiaperTypesBySecret = query({
  args: {
    secretLink: v.string(),
    importTag: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      trackerId: v.id("trackers"),
      secretLink: v.string(),
      babyName: v.optional(v.string()),
      total: v.number(),
      wet: v.number(),
      dirty: v.number(),
      both: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tag = args.importTag ?? IMPORT_TAG;
    const tracker = await ctx.db
      .query("trackers")
      .withIndex("by_secret", (q) => q.eq("secretLink", args.secretLink))
      .unique();
    if (!tracker) return null;

    const diapers = (
      await ctx.db
        .query("diaperEntries")
        .withIndex("by_tracker", (q) => q.eq("trackerId", tracker._id))
        .collect()
    ).filter((e) => e.notes?.includes(tag));

    return {
      trackerId: tracker._id as Id<"trackers">,
      secretLink: tracker.secretLink,
      babyName: tracker.babyName,
      total: diapers.length,
      wet: diapers.filter((e) => e.type === "wet").length,
      dirty: diapers.filter((e) => e.type === "dirty").length,
      both: diapers.filter((e) => e.type === "both").length,
    };
  },
});
