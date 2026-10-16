import { v } from "convex/values";
import { query } from "./_generated/server";

const diaperTypeValidator = v.union(
  v.literal("wet"),
  v.literal("dirty"),
  v.literal("both")
);

const dailySummaryValidator = v.object({
  feedCount: v.number(),
  diaperCount: v.number(),
  pumpCount: v.number(),
  sleepMinutes: v.number(),
  napCount: v.number(),
  feedTotalMinutes: v.number(),
  pumpTotalMl: v.number(),
  healthCount: v.number(),
  lastFeedTime: v.optional(v.number()),
  lastDiaperType: v.optional(diaperTypeValidator),
  lastDiaperTime: v.optional(v.number()),
  lastSleepStartTime: v.optional(v.number()),
  lastTemperature: v.optional(v.number()),
  lastTemperatureTime: v.optional(v.number()),
  lastMedicationName: v.optional(v.string()),
  lastMedicationTime: v.optional(v.number()),
  lastHealthTime: v.optional(v.number()),
});

function sleepMinutesInRange(
  startTime: number,
  endTime: number | undefined,
  dayStart: number,
  dayEnd: number,
  now: number
): number {
  const effectiveEnd = endTime ?? now;
  const overlapStart = Math.max(startTime, dayStart);
  const overlapEnd = Math.min(effectiveEnd, dayEnd);
  if (overlapEnd <= overlapStart) return 0;
  return Math.floor((overlapEnd - overlapStart) / (1000 * 60));
}

export const getForDay = query({
  args: {
    trackerId: v.id("trackers"),
    dayStart: v.number(),
    dayEnd: v.number(),
    now: v.number(),
  },
  returns: dailySummaryValidator,
  handler: async (ctx, args) => {
    const feeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", args.dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), args.dayEnd))
      .collect();

    const diapers = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", args.dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), args.dayEnd))
      .collect();

    const pumps = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", args.dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), args.dayEnd))
      .collect();

    const healthEntries = await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", args.dayStart)
      )
      .filter((q) => q.lt(q.field("timestamp"), args.dayEnd))
      .collect();

    const sleepEntries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q
          .eq("trackerId", args.trackerId)
          .gte("startTime", args.dayStart - 24 * 60 * 60 * 1000)
      )
      .collect();

    const sleepMinutes = sleepEntries.reduce(
      (total, entry) =>
        total +
        sleepMinutesInRange(
          entry.startTime,
          entry.endTime,
          args.dayStart,
          args.dayEnd,
          args.now
        ),
      0
    );

    const napCount = sleepEntries.filter(
      (entry) =>
        entry.type === "nap" &&
        entry.startTime >= args.dayStart &&
        entry.startTime < args.dayEnd
    ).length;

    const feedTotalMinutes = feeds.reduce(
      (total, feed) => total + (feed.durationMinutes ?? feed.duration ?? 0),
      0
    );
    const pumpTotalMl = pumps.reduce((total, pump) => total + pump.amount, 0);

    const lastFeed = feeds.length > 0 ? feeds[feeds.length - 1] : undefined;
    const lastDiaper =
      diapers.length > 0 ? diapers[diapers.length - 1] : undefined;
    const todaySleep = sleepEntries.filter(
      (entry) => entry.startTime >= args.dayStart && entry.startTime < args.dayEnd
    );
    const lastSleep =
      todaySleep.length > 0 ? todaySleep[todaySleep.length - 1] : undefined;

    const tempsToday = healthEntries.filter((e) => e.type === "temperature");
    const medsToday = healthEntries.filter((e) => e.type === "medication");
    const lastTemp =
      tempsToday.length > 0 ? tempsToday[tempsToday.length - 1] : undefined;
    const lastMed =
      medsToday.length > 0 ? medsToday[medsToday.length - 1] : undefined;
    const lastHealth =
      healthEntries.length > 0
        ? healthEntries[healthEntries.length - 1]
        : undefined;

    return {
      feedCount: feeds.length,
      diaperCount: diapers.length,
      pumpCount: pumps.length,
      sleepMinutes,
      napCount,
      feedTotalMinutes,
      pumpTotalMl,
      healthCount: healthEntries.length,
      lastFeedTime: lastFeed?.timestamp,
      lastDiaperType: lastDiaper?.type,
      lastDiaperTime: lastDiaper?.timestamp,
      lastSleepStartTime: lastSleep?.startTime,
      lastTemperature: lastTemp?.temperature,
      lastTemperatureTime: lastTemp?.timestamp,
      lastMedicationName: lastMed?.medicationName,
      lastMedicationTime: lastMed?.timestamp,
      lastHealthTime: lastHealth?.timestamp,
    };
  },
});
