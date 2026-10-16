import { v } from "convex/values";
import { query } from "./_generated/server";

const diaperTypeValidator = v.union(
  v.literal("wet"),
  v.literal("dirty"),
  v.literal("both")
);

/**
 * Compact Home tile summaries — last timing/status only, not full lists.
 */
export const getTileSummaries = query({
  args: {
    trackerId: v.id("trackers"),
    dayStart: v.number(),
    dayEnd: v.number(),
    now: v.number(),
  },
  returns: v.object({
    feed: v.union(
      v.null(),
      v.object({
        timestamp: v.number(),
        amountMl: v.optional(v.number()),
      })
    ),
    diaper: v.union(
      v.null(),
      v.object({
        timestamp: v.number(),
        type: diaperTypeValidator,
      })
    ),
    pump: v.union(
      v.null(),
      v.object({
        timestamp: v.number(),
        amountMl: v.number(),
        sessionsToday: v.number(),
        totalMlToday: v.number(),
      })
    ),
    nap: v.union(
      v.null(),
      v.object({
        startTime: v.number(),
        endTime: v.optional(v.number()),
        active: v.boolean(),
        durationMinutes: v.optional(v.number()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const lastFeed = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId)
      )
      .order("desc")
      .first();

    const lastDiaper = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId)
      )
      .order("desc")
      .first();

    const pumpsToday = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", args.dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), args.dayEnd))
      .collect();

    const lastPump = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId)
      )
      .order("desc")
      .first();

    const recentSleep = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q.eq("trackerId", args.trackerId)
      )
      .order("desc")
      .take(40);

    const lastNap = recentSleep.find((entry) => entry.type === "nap");

    let nap: {
      startTime: number;
      endTime?: number;
      active: boolean;
      durationMinutes?: number;
    } | null = null;

    if (lastNap) {
      const active =
        lastNap.endTime === undefined || lastNap.endTime > args.now;
      const durationMinutes = active
        ? Math.max(
            0,
            Math.round((args.now - lastNap.startTime) / 60_000)
          )
        : lastNap.durationMinutes ??
          (lastNap.endTime !== undefined
            ? Math.max(
                0,
                Math.round((lastNap.endTime - lastNap.startTime) / 60_000)
              )
            : undefined);
      nap = {
        startTime: lastNap.startTime,
        ...(lastNap.endTime !== undefined ? { endTime: lastNap.endTime } : {}),
        active,
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      };
    }

    return {
      feed: lastFeed
        ? {
            timestamp: lastFeed.timestamp,
            ...(lastFeed.amount !== undefined
              ? { amountMl: lastFeed.amount }
              : {}),
          }
        : null,
      diaper: lastDiaper
        ? { timestamp: lastDiaper.timestamp, type: lastDiaper.type }
        : null,
      pump: lastPump
        ? {
            timestamp: lastPump.timestamp,
            amountMl: lastPump.amount,
            sessionsToday: pumpsToday.length,
            totalMlToday: pumpsToday.reduce((sum, p) => sum + p.amount, 0),
          }
        : null,
      nap,
    };
  },
});
