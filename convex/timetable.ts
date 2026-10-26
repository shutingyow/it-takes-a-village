import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  DEFAULT_TRACKER_TIMEZONE,
  getDayBoundsForDateKey,
  shiftDateKey,
} from "./lib/dayBounds";

const eventKindValidator = v.union(
  v.literal("feed"),
  v.literal("diaper"),
  v.literal("pump"),
  v.literal("nap")
);

const timetableEventValidator = v.object({
  id: v.string(),
  kind: eventKindValidator,
  startMs: v.number(),
  endMs: v.optional(v.number()),
  label: v.optional(v.string()),
  caregiverName: v.optional(v.string()),
});

/**
 * Day / week timetable events for Insights (feed, diaper, pump, nap only).
 */
export const getSchedule = query({
  args: {
    trackerId: v.id("trackers"),
    /** Inclusive start date key YYYY-MM-DD (tracker TZ). */
    startDateKey: v.string(),
    /** Number of calendar days (1 = day view, 7 = week). */
    dayCount: v.number(),
    now: v.number(),
  },
  returns: v.object({
    days: v.array(
      v.object({
        dateKey: v.string(),
        dayStart: v.number(),
        dayEnd: v.number(),
        events: v.array(timetableEventValidator),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const dayCount = Math.min(7, Math.max(1, Math.floor(args.dayCount)));
    const tz = DEFAULT_TRACKER_TIMEZONE;
    const days: Array<{
      dateKey: string;
      dayStart: number;
      dayEnd: number;
      events: Array<{
        id: string;
        kind: "feed" | "diaper" | "pump" | "nap";
        startMs: number;
        endMs?: number;
        label?: string;
        caregiverName?: string;
      }>;
    }> = [];

    for (let i = 0; i < dayCount; i++) {
      const dateKey = shiftDateKey(args.startDateKey, i);
      const { dayStart, dayEnd } = getDayBoundsForDateKey(dateKey, tz);

      const feeds = await ctx.db
        .query("feedEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
        )
        .filter((q) => q.lt(q.field("timestamp"), dayEnd))
        .collect();

      const diapers = await ctx.db
        .query("diaperEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
        )
        .filter((q) => q.lt(q.field("timestamp"), dayEnd))
        .collect();

      const pumps = await ctx.db
        .query("pumpEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", args.trackerId).gte("timestamp", dayStart)
        )
        .filter((q) => q.lt(q.field("timestamp"), dayEnd))
        .collect();

      // Include naps that start in-day or overlap the day window.
      const sleepLookback = await ctx.db
        .query("sleepEntries")
        .withIndex("by_tracker_and_start", (q) =>
          q
            .eq("trackerId", args.trackerId)
            .gte("startTime", dayStart - 24 * 60 * 60 * 1000)
        )
        .collect();

      const naps = sleepLookback.filter((entry) => {
        if (entry.type !== "nap") return false;
        const end = entry.endTime ?? args.now;
        return entry.startTime < dayEnd && end > dayStart;
      });

      const events = [
        ...feeds.map((e) => ({
          id: e._id,
          kind: "feed" as const,
          startMs: e.timestamp,
          caregiverName: e.caregiverName,
          ...(e.amount !== undefined ? { label: `${e.amount} ml` } : {}),
        })),
        ...diapers.map((e) => ({
          id: e._id,
          kind: "diaper" as const,
          startMs: e.timestamp,
          label: e.type,
          caregiverName: e.caregiverName,
        })),
        ...pumps.map((e) => ({
          id: e._id,
          kind: "pump" as const,
          startMs: e.timestamp,
          label: `${e.amount} ml`,
          caregiverName: e.caregiverName,
        })),
        ...naps.map((e) => ({
          id: e._id,
          kind: "nap" as const,
          startMs: e.startTime,
          endMs: e.endTime ?? args.now,
          caregiverName: e.caregiverName,
        })),
      ].sort((a, b) => a.startMs - b.startMs);

      days.push({ dateKey, dayStart, dayEnd, events });
    }

    return { days };
  },
});
