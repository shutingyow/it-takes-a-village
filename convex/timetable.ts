import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifyCaregiver } from "./lib/caregivers";
import {
  resolveTrackerTimezone,
  getDayBoundsForDateKey,
  shiftDateKey,
} from "./lib/dayBounds";

const eventKindValidator = v.union(
  v.literal("feed"),
  v.literal("diaper"),
  v.literal("pump"),
  v.literal("sleep")
);

const timetableEventValidator = v.object({
  id: v.string(),
  kind: eventKindValidator,
  startMs: v.number(),
  endMs: v.optional(v.number()),
  label: v.optional(v.string()),
  caregiverName: v.optional(v.string()),
  /** Solids stay under kind "feed" but use a distinct tone in the UI. */
  tone: v.optional(v.literal("solids")),
});

/**
 * Day / week timetable events for Insights (feed, diaper, pump, sleep).
 */
export const getSchedule = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
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
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const dayCount = Math.min(7, Math.max(1, Math.floor(args.dayCount)));
    const tz = resolveTrackerTimezone(tracker);
    const days: Array<{
      dateKey: string;
      dayStart: number;
      dayEnd: number;
      events: Array<{
        id: string;
        kind: "feed" | "diaper" | "pump" | "sleep";
        startMs: number;
        endMs?: number;
        label?: string;
        caregiverName?: string;
        tone?: "solids";
      }>;
    }> = [];

    for (let i = 0; i < dayCount; i++) {
      const dateKey = shiftDateKey(args.startDateKey, i);
      const { dayStart, dayEnd } = getDayBoundsForDateKey(dateKey, tz);

      const feeds = await ctx.db
        .query("feedEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", tracker._id).gte("timestamp", dayStart)
        )
        .filter((q) => q.lt(q.field("timestamp"), dayEnd))
        .collect();

      const diapers = await ctx.db
        .query("diaperEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", tracker._id).gte("timestamp", dayStart)
        )
        .filter((q) => q.lt(q.field("timestamp"), dayEnd))
        .collect();

      const pumps = await ctx.db
        .query("pumpEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", tracker._id).gte("timestamp", dayStart)
        )
        .filter((q) => q.lt(q.field("timestamp"), dayEnd))
        .collect();

      // Include naps + bedtime that start in-day or overlap the day window.
      const sleepLookback = await ctx.db
        .query("sleepEntries")
        .withIndex("by_tracker_and_start", (q) =>
          q
            .eq("trackerId", tracker._id)
            .gte("startTime", dayStart - 24 * 60 * 60 * 1000)
        )
        .collect();

      const sleeps = sleepLookback.filter((entry) => {
        const end = entry.endTime ?? args.now;
        return entry.startTime < dayEnd && end > dayStart;
      });

      const events = [
        ...feeds.map((e) => {
          if (e.type === "solids") {
            const bits = [
              e.foodName?.trim() || "Solids",
              e.amountGrams != null ? `${e.amountGrams}g` : null,
            ].filter(Boolean);
            return {
              id: e._id,
              kind: "feed" as const,
              startMs: e.timestamp,
              caregiverName: e.caregiverName,
              label: bits.join(" · "),
              tone: "solids" as const,
            };
          }
          return {
            id: e._id,
            kind: "feed" as const,
            startMs: e.timestamp,
            caregiverName: e.caregiverName,
            ...(e.amount !== undefined ? { label: `${e.amount} ml` } : {}),
          };
        }),
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
        ...sleeps.map((e) => ({
          id: e._id,
          kind: "sleep" as const,
          startMs: e.startTime,
          endMs: e.endTime ?? args.now,
          label: e.type,
          caregiverName: e.caregiverName,
        })),
      ].sort((a, b) => a.startMs - b.startMs);

      days.push({ dateKey, dayStart, dayEnd, events });
    }

    return { days };
  },
});
