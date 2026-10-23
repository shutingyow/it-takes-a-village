import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  DEFAULT_TRACKER_TIMEZONE,
  formatWeekdayShortInZone,
  getDayBoundsForDateKey,
  getTodayBoundsInZone,
  shiftDateKey,
} from "./lib/dayBounds";

const pumpSessionValidator = v.object({
  timestamp: v.number(),
  amount: v.number(),
});

const dayStatValidator = v.object({
  date: v.string(),
  label: v.string(),
  feedCount: v.number(),
  breastCount: v.number(),
  bottleCount: v.number(),
  formulaMl: v.number(),
  breastmilkMl: v.number(),
  breastDurationMinutes: v.number(),
  diaperCount: v.number(),
  wetCount: v.number(),
  dirtyCount: v.number(),
  bothCount: v.number(),
  pumpCount: v.number(),
  pumpTotalMl: v.number(),
  pumpSessions: v.array(pumpSessionValidator),
  sleepMinutes: v.number(),
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

/** Prefer stored bottleMilk; fall back to notes for imported rows. */
function bottleMilkKind(feed: {
  bottleMilk?: "formula" | "breastmilk";
  notes?: string;
}): "formula" | "breastmilk" | null {
  if (feed.bottleMilk === "formula" || feed.bottleMilk === "breastmilk") {
    return feed.bottleMilk;
  }
  if (!feed.notes) return null;
  const lower = feed.notes.toLowerCase();
  if (lower.includes("breastmilk") || lower.includes("breast milk")) {
    return "breastmilk";
  }
  if (lower.includes("formula")) {
    return "formula";
  }
  return null;
}

type DayStat = {
  date: string;
  label: string;
  feedCount: number;
  breastCount: number;
  bottleCount: number;
  formulaMl: number;
  breastmilkMl: number;
  breastDurationMinutes: number;
  diaperCount: number;
  wetCount: number;
  dirtyCount: number;
  bothCount: number;
  pumpCount: number;
  pumpTotalMl: number;
  pumpSessions: Array<{ timestamp: number; amount: number }>;
  sleepMinutes: number;
};

function buildDayStat(
  dateKey: string,
  dayStart: number,
  dayEnd: number,
  now: number,
  feeds: Array<{
    timestamp: number;
    type: string;
    amount?: number;
    bottleMilk?: "formula" | "breastmilk";
    notes?: string;
    durationMinutes?: number;
    duration?: number;
  }>,
  diapers: Array<{ timestamp: number; type: string }>,
  pumps: Array<{ timestamp: number; amount: number }>,
  sleepEntries: Array<{
    startTime: number;
    endTime?: number;
  }>
): DayStat {
  const dayFeeds = feeds.filter(
    (f) => f.timestamp >= dayStart && f.timestamp < dayEnd
  );
  const dayDiapers = diapers.filter(
    (d) => d.timestamp >= dayStart && d.timestamp < dayEnd
  );
  const dayPumps = pumps
    .filter((p) => p.timestamp >= dayStart && p.timestamp < dayEnd)
    .sort((a, b) => a.timestamp - b.timestamp);

  let formulaMl = 0;
  let breastmilkMl = 0;
  let breastCount = 0;
  let bottleCount = 0;
  let breastDurationMinutes = 0;
  for (const feed of dayFeeds) {
    if (feed.type === "breast") {
      breastCount += 1;
      const minutes = feed.durationMinutes ?? feed.duration;
      if (minutes != null && minutes > 0 && Number.isFinite(minutes)) {
        breastDurationMinutes += minutes;
      }
    } else if (feed.type === "bottle") {
      bottleCount += 1;
    }

    // Direct breast feeds have no amount — exclude from ml totals
    if (feed.type !== "bottle" || !feed.amount || feed.amount <= 0) {
      continue;
    }
    const kind = bottleMilkKind(feed);
    if (kind === "formula") formulaMl += feed.amount;
    else if (kind === "breastmilk") breastmilkMl += feed.amount;
  }

  // wet/dirty include "both" for weekly stacked charts; bothCount is exclusive.
  const wetCount = dayDiapers.filter(
    (d) => d.type === "wet" || d.type === "both"
  ).length;
  const dirtyCount = dayDiapers.filter(
    (d) => d.type === "dirty" || d.type === "both"
  ).length;
  const bothCount = dayDiapers.filter((d) => d.type === "both").length;

  const pumpSessions = dayPumps.map((p) => ({
    timestamp: p.timestamp,
    amount: p.amount,
  }));
  const pumpTotalMl = pumpSessions.reduce((sum, p) => sum + p.amount, 0);

  const sleepMinutes = sleepEntries.reduce(
    (total, entry) =>
      total +
      sleepMinutesInRange(
        entry.startTime,
        entry.endTime,
        dayStart,
        dayEnd,
        now
      ),
    0
  );

  return {
    date: dateKey,
    label: formatWeekdayShortInZone(dayStart, DEFAULT_TRACKER_TIMEZONE),
    feedCount: dayFeeds.length,
    breastCount,
    bottleCount,
    formulaMl,
    breastmilkMl,
    breastDurationMinutes,
    diaperCount: dayDiapers.length,
    wetCount,
    dirtyCount,
    bothCount,
    pumpCount: dayPumps.length,
    pumpTotalMl,
    pumpSessions,
    sleepMinutes,
  };
}

/**
 * Rolling 7-day window ending on endDateKey (clamped to today).
 * Pass today (or omit) for the current week; earlier end dates for history.
 */
export const getWeeklySummary = query({
  args: {
    trackerId: v.id("trackers"),
    now: v.number(),
    /** Last day of the 7-day window (YYYY-MM-DD). Defaults to today. */
    endDateKey: v.optional(v.string()),
  },
  returns: v.object({
    days: v.array(dayStatValidator),
    endDateKey: v.string(),
    avgSleepMinutesPerDay: v.number(),
    longestStretchMinutes: v.number(),
    timezone: v.string(),
  }),
  handler: async (ctx, args) => {
    const timeZone = DEFAULT_TRACKER_TIMEZONE;
    const { dateKey: todayKey } = getTodayBoundsInZone(args.now, timeZone);
    const endDateKey =
      args.endDateKey && args.endDateKey <= todayKey
        ? args.endDateKey
        : todayKey;
    // Oldest day in the 7-day window (end − 6)
    const rangeStartKey = shiftDateKey(endDateKey, -6);
    const { dayStart: rangeStart } = getDayBoundsForDateKey(
      rangeStartKey,
      timeZone
    );
    const { dayEnd: rangeEnd } = getDayBoundsForDateKey(endDateKey, timeZone);

    const feeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q
          .eq("trackerId", args.trackerId)
          .gte("timestamp", rangeStart)
          .lt("timestamp", rangeEnd)
      )
      .collect();

    const diapers = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q
          .eq("trackerId", args.trackerId)
          .gte("timestamp", rangeStart)
          .lt("timestamp", rangeEnd)
      )
      .collect();

    const pumps = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q
          .eq("trackerId", args.trackerId)
          .gte("timestamp", rangeStart)
          .lt("timestamp", rangeEnd)
      )
      .collect();

    const sleepEntries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q
          .eq("trackerId", args.trackerId)
          .gte("startTime", rangeStart - 24 * 60 * 60 * 1000)
          .lt("startTime", rangeEnd)
      )
      .collect();

    const days: DayStat[] = [];

    for (let i = 6; i >= 0; i--) {
      const dateKey = shiftDateKey(endDateKey, -i);
      const { dayStart, dayEnd } = getDayBoundsForDateKey(dateKey, timeZone);
      days.push(
        buildDayStat(
          dateKey,
          dayStart,
          dayEnd,
          args.now,
          feeds,
          diapers,
          pumps,
          sleepEntries
        )
      );
    }

    const totalSleep = days.reduce((sum, d) => sum + d.sleepMinutes, 0);
    const avgSleepMinutesPerDay = Math.round(totalSleep / 7);

    let longestStretchMinutes = 0;
    for (const entry of sleepEntries) {
      if (entry.endTime) {
        const duration = Math.floor((entry.endTime - entry.startTime) / 60000);
        if (duration > longestStretchMinutes) {
          longestStretchMinutes = duration;
        }
      }
    }

    return {
      days,
      endDateKey,
      avgSleepMinutesPerDay,
      longestStretchMinutes,
      timezone: timeZone,
    };
  },
});

export const getDailyStats = query({
  args: {
    trackerId: v.id("trackers"),
    dateKey: v.string(), // YYYY-MM-DD in Asia/Singapore
    now: v.number(),
  },
  returns: v.object({
    day: dayStatValidator,
    timezone: v.string(),
  }),
  handler: async (ctx, args) => {
    const timeZone = DEFAULT_TRACKER_TIMEZONE;
    const { dayStart, dayEnd } = getDayBoundsForDateKey(args.dateKey, timeZone);

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

    const sleepEntries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q
          .eq("trackerId", args.trackerId)
          .gte("startTime", dayStart - 24 * 60 * 60 * 1000)
      )
      .collect();

    const day = buildDayStat(
      args.dateKey,
      dayStart,
      dayEnd,
      args.now,
      feeds,
      diapers,
      pumps,
      sleepEntries
    );

    return { day, timezone: timeZone };
  },
});

const feedingWindowValidator = v.object({
  feedCount: v.number(),
  bottleCount: v.number(),
  breastCount: v.number(),
  totalMl: v.number(),
  formulaMl: v.number(),
  breastmilkMl: v.number(),
  untypedMl: v.number(),
  avgMl: v.union(v.number(), v.null()),
  avgIntervalMinutes: v.union(v.number(), v.null()),
  avgDurationMinutes: v.union(v.number(), v.null()),
});

const feedDirectionValidator = v.union(
  v.literal("up"),
  v.literal("down"),
  v.literal("same"),
  v.literal("na")
);

type FeedingWindow = {
  feedCount: number;
  bottleCount: number;
  breastCount: number;
  totalMl: number;
  formulaMl: number;
  breastmilkMl: number;
  untypedMl: number;
  avgMl: number | null;
  avgIntervalMinutes: number | null;
  avgDurationMinutes: number | null;
};

type FeedRow = {
  timestamp: number;
  type: string;
  amount?: number;
  bottleMilk?: "formula" | "breastmilk";
  notes?: string;
  durationMinutes?: number;
  duration?: number;
};

function summarizeFeeds(feeds: FeedRow[]): FeedingWindow {
  const sorted = [...feeds].sort((a, b) => a.timestamp - b.timestamp);
  let formulaMl = 0;
  let breastmilkMl = 0;
  let untypedMl = 0;
  let amountFeedCount = 0;
  let bottleCount = 0;
  let breastCount = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const feed of sorted) {
    if (feed.type === "breast") breastCount += 1;
    else if (feed.type === "bottle") bottleCount += 1;

    const minutes = feed.durationMinutes ?? feed.duration;
    if (minutes != null && minutes > 0 && Number.isFinite(minutes)) {
      durationSum += minutes;
      durationCount += 1;
    }

    if (feed.type === "bottle" && feed.amount != null && feed.amount > 0) {
      amountFeedCount += 1;
      const kind = bottleMilkKind(feed);
      if (kind === "formula") formulaMl += feed.amount;
      else if (kind === "breastmilk") breastmilkMl += feed.amount;
      else untypedMl += feed.amount;
    }
  }

  const totalMl = formulaMl + breastmilkMl + untypedMl;
  let avgIntervalMinutes: number | null = null;
  if (sorted.length >= 2) {
    let gapSum = 0;
    let gaps = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      if (!current || !previous) continue;
      const delta = current.timestamp - previous.timestamp;
      if (delta > 0) {
        gapSum += delta / 60000;
        gaps += 1;
      }
    }
    if (gaps > 0) avgIntervalMinutes = Math.round(gapSum / gaps);
  }

  return {
    feedCount: sorted.length,
    bottleCount,
    breastCount,
    totalMl,
    formulaMl,
    breastmilkMl,
    untypedMl,
    avgMl: amountFeedCount > 0 ? Math.round(totalMl / amountFeedCount) : null,
    avgIntervalMinutes,
    avgDurationMinutes:
      durationCount > 0 ? Math.round(durationSum / durationCount) : null,
  };
}

type FeedDirection = "up" | "down" | "same" | "na";

function compareNumber(
  current: number,
  previous: number,
  absoluteSlack: number
): Exclude<FeedDirection, "na"> {
  const diff = current - previous;
  const baseline = Math.max(Math.abs(previous), 1);
  if (Math.abs(diff) <= absoluteSlack || Math.abs(diff) / baseline <= 0.1) {
    return "same";
  }
  return diff > 0 ? "up" : "down";
}

/**
 * Plain-language feeding numbers for Insights.
 * Daily: the selected Singapore day vs the day before.
 * Weekly: the 7 days ending on dateKey vs the previous 7 days.
 */
export const getFeedingTrend = query({
  args: {
    trackerId: v.id("trackers"),
    mode: v.union(v.literal("daily"), v.literal("weekly")),
    dateKey: v.string(),
  },
  returns: v.object({
    mode: v.union(v.literal("daily"), v.literal("weekly")),
    dateKey: v.string(),
    current: feedingWindowValidator,
    previous: feedingWindowValidator,
    countDirection: feedDirectionValidator,
    volumeDirection: feedDirectionValidator,
    intervalDirection: feedDirectionValidator,
  }),
  handler: async (ctx, args) => {
    const timeZone = DEFAULT_TRACKER_TIMEZONE;
    const currentEndKey = args.dateKey;
    const currentStartKey =
      args.mode === "daily"
        ? currentEndKey
        : shiftDateKey(currentEndKey, -6);
    const previousEndKey = shiftDateKey(currentStartKey, -1);
    const previousStartKey =
      args.mode === "daily"
        ? previousEndKey
        : shiftDateKey(previousEndKey, -6);

    const { dayStart: fetchStart } = getDayBoundsForDateKey(
      previousStartKey,
      timeZone
    );
    const { dayEnd: fetchEnd } = getDayBoundsForDateKey(currentEndKey, timeZone);
    const { dayStart: currentStart } = getDayBoundsForDateKey(
      currentStartKey,
      timeZone
    );
    const { dayStart: previousStart } = getDayBoundsForDateKey(
      previousStartKey,
      timeZone
    );
    const { dayEnd: previousEnd } = getDayBoundsForDateKey(
      previousEndKey,
      timeZone
    );

    const feeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q
          .eq("trackerId", args.trackerId)
          .gte("timestamp", fetchStart)
          .lt("timestamp", fetchEnd)
      )
      .collect();

    const current = summarizeFeeds(
      feeds.filter(
        (feed) => feed.timestamp >= currentStart && feed.timestamp < fetchEnd
      )
    );
    const previous = summarizeFeeds(
      feeds.filter(
        (feed) => feed.timestamp >= previousStart && feed.timestamp < previousEnd
      )
    );

    const canCompare = current.feedCount >= 2 && previous.feedCount >= 2;
    const countDirection: FeedDirection = canCompare
      ? compareNumber(current.feedCount, previous.feedCount, 0)
      : "na";
    const volumeDirection: FeedDirection =
      canCompare && (current.totalMl > 0 || previous.totalMl > 0)
        ? compareNumber(current.totalMl, previous.totalMl, 0)
        : "na";
    const intervalDirection: FeedDirection =
      canCompare &&
      current.avgIntervalMinutes != null &&
      previous.avgIntervalMinutes != null
        ? compareNumber(
            current.avgIntervalMinutes,
            previous.avgIntervalMinutes,
            15
          )
        : "na";

    return {
      mode: args.mode,
      dateKey: args.dateKey,
      current,
      previous,
      countDirection,
      volumeDirection,
      intervalDirection,
    };
  },
});
