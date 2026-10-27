import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  clampFeedAtForSkew,
  computeFeedDueAt,
  DEFAULT_FEED_INTERVAL_HOURS,
  effectiveFeedIntervalHours as resolveEffectiveFeedIntervalHours,
  resolveNightFeedSettings,
} from "./lib/feedSchedule";
import {
  computeIntervalPumpDueAt,
  computeNextPumpDueAt,
  DEFAULT_PUMP_INTERVAL_HOURS,
} from "./lib/pumpSchedule";

const dueItemValidator = v.object({
  type: v.union(
    v.literal("feed"),
    v.literal("medication"),
    v.literal("pump")
  ),
  label: v.string(),
  dueAt: v.number(),
  status: v.union(
    v.literal("ok"),
    v.literal("approaching"),
    v.literal("overdue")
  ),
  minutesUntilDue: v.number(),
});

const APPROACHING_THRESHOLD_MS = 30 * 60 * 1000;
const DEFAULT_NOTIFY_BEFORE_MINUTES = 10;

function computeDueStatus(dueAt: number, now: number) {
  const msUntil = dueAt - now;
  if (msUntil < 0) {
    return {
      status: "overdue" as const,
      minutesUntilDue: Math.floor(msUntil / 60000),
    };
  }
  if (msUntil <= APPROACHING_THRESHOLD_MS) {
    return {
      status: "approaching" as const,
      minutesUntilDue: Math.ceil(msUntil / 60000),
    };
  }
  return {
    status: "ok" as const,
    minutesUntilDue: Math.ceil(msUntil / 60000),
  };
}

export const getDueStatus = query({
  args: {
    trackerId: v.id("trackers"),
    now: v.number(),
  },
  returns: v.object({
    feedIntervalHours: v.number(),
    /** Interval actually used for the current next-feed due (day or night). */
    effectiveFeedIntervalHours: v.number(),
    nightFeedIntervalEnabled: v.boolean(),
    nightFeedIntervalHours: v.number(),
    nightFeedWindowStart: v.string(),
    nightFeedWindowEnd: v.string(),
    usingNightInterval: v.boolean(),
    notifyBeforeMinutes: v.number(),
    items: v.array(dueItemValidator),
  }),
  handler: async (ctx, args) => {
    const tracker = await ctx.db.get("trackers", args.trackerId);
    const night = resolveNightFeedSettings(tracker ?? undefined);
    if (!tracker) {
      return {
        feedIntervalHours: DEFAULT_FEED_INTERVAL_HOURS,
        effectiveFeedIntervalHours: DEFAULT_FEED_INTERVAL_HOURS,
        nightFeedIntervalEnabled: night.enabled,
        nightFeedIntervalHours: night.intervalHours,
        nightFeedWindowStart: night.start,
        nightFeedWindowEnd: night.end,
        usingNightInterval: false,
        notifyBeforeMinutes: DEFAULT_NOTIFY_BEFORE_MINUTES,
        items: [],
      };
    }

    const feedIntervalHours =
      tracker.feedIntervalHours ?? DEFAULT_FEED_INTERVAL_HOURS;
    const notifyBeforeMinutes =
      tracker.notifyBeforeMinutes ?? DEFAULT_NOTIFY_BEFORE_MINUTES;
    const items: Array<{
      type: "feed" | "medication" | "pump";
      label: string;
      dueAt: number;
      status: "ok" | "approaching" | "overdue";
      minutesUntilDue: number;
    }> = [];

    let effectiveFeedIntervalHours = feedIntervalHours;
    let usingNightInterval = false;

    const recentFeeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(40);
    const lastFeed = recentFeeds.find(
      (feed) => feed.type === "breast" || feed.type === "bottle"
    );

    if (lastFeed) {
      // last feed + day or night interval (never a hardcoded 3h).
      const feedAt = clampFeedAtForSkew(lastFeed.timestamp, args.now);
      effectiveFeedIntervalHours = resolveEffectiveFeedIntervalHours(
        feedAt,
        feedIntervalHours,
        night
      );
      usingNightInterval =
        night.enabled && effectiveFeedIntervalHours > feedIntervalHours + 1e-9;
      const dueAt = computeFeedDueAt(
        lastFeed.timestamp,
        feedIntervalHours,
        night,
        { now: args.now }
      );
      const due = computeDueStatus(dueAt, args.now);
      items.push({
        type: "feed",
        label: "feed",
        dueAt,
        ...due,
      });
    }

    const medicationReminders = tracker.medicationReminders ?? [];
    for (const reminder of medicationReminders) {
      let lastLoggedAt = reminder.lastLoggedAt;

      if (!lastLoggedAt) {
        const medEntries = await ctx.db
          .query("healthEntries")
          .withIndex("by_tracker_and_type", (q) =>
            q.eq("trackerId", args.trackerId).eq("type", "medication")
          )
          .order("desc")
          .take(50);

        const match = medEntries.find(
          (e) =>
            e.medicationName?.toLowerCase() === reminder.name.toLowerCase()
        );
        lastLoggedAt = match?.timestamp;
      }

      if (lastLoggedAt) {
        const dueAt = lastLoggedAt + reminder.intervalHours * 60 * 60 * 1000;
        const due = computeDueStatus(dueAt, args.now);
        items.push({
          type: "medication",
          label: reminder.name,
          dueAt,
          ...due,
        });
      }
    }

    const pumpSchedule = tracker.pumpSchedule;
    if (pumpSchedule?.enabled) {
      const lastPump = await ctx.db
        .query("pumpEntries")
        .withIndex("by_tracker_and_time", (q) =>
          q.eq("trackerId", args.trackerId)
        )
        .order("desc")
        .first();

      const mode = pumpSchedule.mode ?? "fixed";
      let dueAt: number | null = null;

      if (mode === "interval") {
        dueAt = computeIntervalPumpDueAt(
          lastPump?.timestamp,
          pumpSchedule.intervalHours ?? DEFAULT_PUMP_INTERVAL_HOURS,
          args.now
        );
      } else {
        dueAt = computeNextPumpDueAt(
          pumpSchedule,
          lastPump?.timestamp,
          args.now
        );
      }

      if (dueAt !== null) {
        const due = computeDueStatus(dueAt, args.now);
        const amount =
          pumpSchedule.amountMl !== undefined
            ? `${pumpSchedule.amountMl}ml`
            : "pump";
        items.push({
          type: "pump",
          label: amount,
          dueAt,
          ...due,
        });
      }
    }

    items.sort((a, b) => a.dueAt - b.dueAt);

    return {
      feedIntervalHours,
      effectiveFeedIntervalHours,
      nightFeedIntervalEnabled: night.enabled,
      nightFeedIntervalHours: night.intervalHours,
      nightFeedWindowStart: night.start,
      nightFeedWindowEnd: night.end,
      usingNightInterval,
      notifyBeforeMinutes,
      items,
    };
  },
});
