import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifyCaregiver } from "./lib/caregivers";

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
    secretLink: v.string(),
    actingCaregiverName: v.string(),
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
        active: v.optional(v.boolean()),
        caregiverName: v.optional(v.string()),
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
        type: v.optional(v.union(v.literal("nap"), v.literal("night"))),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const recentFeeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .take(40);
    const lastFeed = recentFeeds.find(
      (feed) => feed.type === "breast" || feed.type === "bottle"
    );
    const activeFeed = tracker.activeFeedSession;

    const lastDiaper = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .first();

    const pumpsToday = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id).gte("timestamp", args.dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), args.dayEnd))
      .collect();

    const lastPump = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .first();

    const activeSleepRows = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_active", (q) =>
        q.eq("trackerId", tracker._id).eq("endTime", undefined)
      )
      .collect();
    activeSleepRows.sort((a, b) => b.startTime - a.startTime);
    const activeSleep = activeSleepRows[0] ?? null;

    const recentSleep = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .take(40);

    const lastNap = recentSleep.find((entry) => entry.type === "nap");
    const sleepForTile = activeSleep ?? lastNap;

    let nap: {
      startTime: number;
      endTime?: number;
      active: boolean;
      durationMinutes?: number;
      type?: "nap" | "night";
    } | null = null;

    if (sleepForTile) {
      const active =
        sleepForTile.endTime === undefined || sleepForTile.endTime > args.now;
      const durationMinutes = active
        ? Math.max(
            0,
            Math.round((args.now - sleepForTile.startTime) / 60_000)
          )
        : sleepForTile.durationMinutes ??
          (sleepForTile.endTime !== undefined
            ? Math.max(
                0,
                Math.round(
                  (sleepForTile.endTime - sleepForTile.startTime) / 60_000
                )
              )
            : undefined);
      nap = {
        startTime: sleepForTile.startTime,
        ...(sleepForTile.endTime !== undefined
          ? { endTime: sleepForTile.endTime }
          : {}),
        active,
        type: sleepForTile.type,
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      };
    }

    return {
      feed: activeFeed
        ? {
            timestamp: activeFeed.startedAt,
            active: true,
            caregiverName: activeFeed.caregiverName,
          }
        : lastFeed
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
