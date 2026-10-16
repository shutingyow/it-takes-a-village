import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  DEFAULT_TRACKER_TIMEZONE,
  getDayBoundsForDateKey,
} from "./lib/dayBounds";

/**
 * Minutes since the previous feed in `feeds`.
 * When `includePrior` is set, the first feed also measures the gap back to the
 * last feed before this set (overnight included). Otherwise the first feed
 * has no interval — used for a single calendar day.
 */
async function feedIntervalMinutesById(
  ctx: QueryCtx,
  trackerId: Id<"trackers">,
  feeds: Array<{ _id: Id<"feedEntries">; timestamp: number }>,
  includePrior: boolean
): Promise<Map<Id<"feedEntries">, number | null>> {
  const result = new Map<Id<"feedEntries">, number | null>();
  if (feeds.length === 0) return result;

  const sorted = [...feeds].sort((a, b) => a.timestamp - b.timestamp);
  let prev: number | undefined;
  if (includePrior) {
    const prior = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", trackerId).lt("timestamp", sorted[0].timestamp)
      )
      .order("desc")
      .first();
    prev = prior?.timestamp;
  }

  for (const feed of sorted) {
    result.set(
      feed._id,
      prev === undefined ? null : Math.round((feed.timestamp - prev) / 60000)
    );
    prev = feed.timestamp;
  }
  return result;
}

/**
 * Minutes awake from the previous nap's end until this nap's start.
 * Looks back before the first nap so an overnight window is included.
 */
async function napWakeWindowBeforeMinutes(
  ctx: QueryCtx,
  trackerId: Id<"trackers">,
  naps: Array<{
    _id: Id<"sleepEntries">;
    startTime: number;
    endTime?: number;
    type: "nap" | "night";
  }>
): Promise<Map<Id<"sleepEntries">, number | null>> {
  const result = new Map<Id<"sleepEntries">, number | null>();
  const sorted = naps
    .filter((entry) => entry.type === "nap")
    .sort((a, b) => a.startTime - b.startTime);
  const first = sorted[0];
  if (!first) return result;

  const earlier = await ctx.db
    .query("sleepEntries")
    .withIndex("by_tracker_and_start", (q) =>
      q.eq("trackerId", trackerId).lt("startTime", first.startTime)
    )
    .order("desc")
    .take(40);

  let prevEnd: number | undefined;
  for (const entry of earlier) {
    if (entry.type !== "nap") continue;
    prevEnd = entry.endTime;
    break;
  }

  for (const nap of sorted) {
    if (prevEnd === undefined || nap.startTime < prevEnd) {
      result.set(nap._id, null);
    } else {
      result.set(nap._id, Math.round((nap.startTime - prevEnd) / 60000));
    }
    prevEnd = nap.endTime;
  }
  return result;
}

// Get all recent activity for history view
export const getActivity = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
    type: v.optional(v.union(
      v.literal("all"),
      v.literal("feed"),
      v.literal("sleep"),
      v.literal("nap"),
      v.literal("diaper"),
      v.literal("pump"),
      v.literal("health"),
      v.literal("growth"),
      v.literal("activity"),
      v.literal("moment")
    )),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const filterType = args.type ?? "all";
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Fetch all entry types
    const feedEntries = filterType === "all" || filterType === "feed"
      ? await ctx.db
          .query("feedEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const sleepEntries = filterType === "all" || filterType === "sleep" || filterType === "nap"
      ? await ctx.db
          .query("sleepEntries")
          .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("startTime"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const diaperEntries = filterType === "all" || filterType === "diaper"
      ? await ctx.db
          .query("diaperEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const pumpEntries = filterType === "all" || filterType === "pump"
      ? await ctx.db
          .query("pumpEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const healthEntries = filterType === "all" || filterType === "health"
      ? await ctx.db
          .query("healthEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const growthEntries =
      filterType === "all" || filterType === "growth"
        ? await ctx.db
            .query("growthEntries")
            .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
            .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
            .order("desc")
            .take(limit)
        : [];

    const activityEntries =
      filterType === "all" || filterType === "activity"
        ? await ctx.db
            .query("activityEntries")
            .withIndex("by_tracker_and_time", (q) =>
              q.eq("trackerId", args.trackerId).gte("timestamp", sevenDaysAgo)
            )
            .order("desc")
            .take(limit)
        : [];

    const momentEntries =
      filterType === "all" || filterType === "moment"
        ? await ctx.db
            .query("momentEntries")
            .withIndex("by_tracker_and_time", (q) =>
              q.eq("trackerId", args.trackerId).gte("timestamp", sevenDaysAgo)
            )
            .order("desc")
            .take(limit)
        : [];

    const feedIntervals = await feedIntervalMinutesById(
      ctx,
      args.trackerId,
      feedEntries,
      true
    );

    // Combine and sort by timestamp
    const allEntries = [
      ...feedEntries.map(e => ({
        ...e,
        entryType: "feed" as const,
        time: e.timestamp,
        intervalMinutes: feedIntervals.get(e._id) ?? null,
      })),
      ...sleepEntries
        .filter((e) => filterType !== "nap" || e.type === "nap")
        .map((e) =>
          e.type === "nap"
            ? {
                ...e,
                entryType: "nap" as const,
                time: e.startTime,
                wakeWindowBeforeMinutes: null as number | null,
              }
            : {
                ...e,
                entryType: "sleep" as const,
                time: e.startTime,
              }
        ),
      ...diaperEntries.map(e => ({ ...e, entryType: "diaper" as const, time: e.timestamp })),
      ...pumpEntries.map(e => ({ ...e, entryType: "pump" as const, time: e.timestamp })),
      ...healthEntries.map(e => ({ ...e, entryType: "health" as const, time: e.timestamp })),
      ...growthEntries.map(e => ({ ...e, entryType: "growth" as const, time: e.timestamp })),
      ...activityEntries.map(e => ({ ...e, entryType: "activity" as const, time: e.timestamp })),
      ...momentEntries.map(e => ({ ...e, entryType: "moment" as const, time: e.timestamp })),
    ];

    // Sort by time descending
    allEntries.sort((a, b) => b.time - a.time);

    return allEntries.slice(0, limit);
  },
});

/** Chronological activity for one Asia/Singapore calendar day (Insights Daily). */
export const getActivityForDay = query({
  args: {
    trackerId: v.id("trackers"),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { dayStart, dayEnd } = getDayBoundsForDateKey(
      args.dateKey,
      DEFAULT_TRACKER_TIMEZONE
    );

    const feedEntries = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), dayEnd))
      .collect();

    const sleepEntries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q.eq("trackerId", args.trackerId).gte("startTime", dayStart)
      )
      .filter((q) => q.lt(q.field("startTime"), dayEnd))
      .collect();

    const diaperEntries = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), dayEnd))
      .collect();

    const pumpEntries = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), dayEnd))
      .collect();

    const healthEntries = await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), dayEnd))
      .collect();

    const growthEntries = await ctx.db
      .query("growthEntries")
      .withIndex("by_tracker_and_date", (q) =>
        q.eq("trackerId", args.trackerId).eq("date", args.dateKey)
      )
      .collect();

    const activityEntries = await ctx.db
      .query("activityEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), dayEnd))
      .collect();

    const momentEntries = await ctx.db
      .query("momentEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), dayEnd))
      .collect();

    const feedIntervals = await feedIntervalMinutesById(
      ctx,
      args.trackerId,
      feedEntries,
      false
    );
    const napWakeWindows = await napWakeWindowBeforeMinutes(
      ctx,
      args.trackerId,
      sleepEntries
    );

    const allEntries = [
      ...feedEntries.map((e) => ({
        ...e,
        entryType: "feed" as const,
        time: e.timestamp,
        intervalMinutes: feedIntervals.get(e._id) ?? null,
      })),
      ...sleepEntries.map((e) =>
        e.type === "nap"
          ? {
              ...e,
              entryType: "nap" as const,
              time: e.startTime,
              wakeWindowBeforeMinutes: napWakeWindows.get(e._id) ?? null,
            }
          : {
              ...e,
              entryType: "sleep" as const,
              time: e.startTime,
            }
      ),
      ...diaperEntries.map((e) => ({
        ...e,
        entryType: "diaper" as const,
        time: e.timestamp,
      })),
      ...pumpEntries.map((e) => ({
        ...e,
        entryType: "pump" as const,
        time: e.timestamp,
      })),
      ...healthEntries.map((e) => ({
        ...e,
        entryType: "health" as const,
        time: e.timestamp,
      })),
      ...growthEntries.map((e) => ({
        ...e,
        entryType: "growth" as const,
        time: e.timestamp,
      })),
      ...activityEntries.map((e) => ({
        ...e,
        entryType: "activity" as const,
        time: e.timestamp,
      })),
      ...momentEntries.map((e) => ({
        ...e,
        entryType: "moment" as const,
        time: e.timestamp,
      })),
    ];

    // Chronological: earliest first for a day diary feel
    allEntries.sort((a, b) => a.time - b.time);
    return allEntries;
  },
});
