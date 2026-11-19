import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifyCaregiver } from "./lib/caregivers";
import {
  clampFeedAtForSkew,
  computeFeedDueAt,
  DEFAULT_FEED_INTERVAL_HOURS,
  parseHhMm,
  resolveNightFeedSettings,
} from "./lib/feedSchedule";
import {
  computeIntervalPumpDueAt,
  computeNextPumpDueAt,
  DEFAULT_PUMP_INTERVAL_HOURS,
  zonedTimeToUtc,
} from "./lib/pumpSchedule";
import {
  computeNextClockDueAt,
  normalizeReminderSchedule,
  resolveReminderMode,
  timesForKind,
} from "./lib/clockSchedule";
import { resolveTrackerTimezone } from "./lib/dayBounds";

const dueItemValidator = v.object({
  type: v.union(
    v.literal("feed"),
    v.literal("medication"),
    v.literal("pump"),
    v.literal("sleep")
  ),
  label: v.string(),
  dueAt: v.number(),
  status: v.union(
    v.literal("ok"),
    v.literal("approaching"),
    v.literal("overdue"),
    v.literal("ongoing")
  ),
  /** For due/approaching/overdue: minutes until (or past) due. For ongoing: minutes elapsed. */
  minutesUntilDue: v.number(),
  caregiverName: v.optional(v.string()),
});

const scheduleSlotValidator = v.object({
  id: v.string(),
  time: v.string(),
  label: v.optional(v.string()),
  kind: v.optional(
    v.union(v.literal("feed"), v.literal("nap"), v.literal("pump"))
  ),
  endTime: v.optional(v.string()),
  period: v.optional(v.union(v.literal("day"), v.literal("night"))),
  note: v.optional(v.string()),
});

/** Interval-from-last-log dues for device notifications / Live Activities. */
const deliveryValidator = v.object({
  feedDueAt: v.union(v.number(), v.null()),
  pumpDueAt: v.union(v.number(), v.null()),
  napDueAt: v.union(v.number(), v.null()),
});

/** Today's bedtime clock (night window start) as UTC ms, or null if unset/invalid. */
function todaysBedtimeMs(
  now: number,
  timeZone: string,
  bedtimeHhMm: string
): number | null {
  const parsed = parseHhMm(bedtimeHhMm);
  if (!parsed) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return zonedTimeToUtc(
    get("year"),
    get("month"),
    get("day"),
    parsed.hour,
    parsed.minute,
    timeZone
  );
}

/**
 * Next sleep target: daytime nap from wake window, then pivot to tonight's
 * bedtime once the nap window is missed or would fall at/after bedtime.
 * Never report a missed nap as "bedtime overdue".
 */
function resolveSleepDue(opts: {
  now: number;
  wakeDueAt: number;
  bedtimeToday: number | null;
}): { dueAt: number; kind: "nap" | "sleep" } | null {
  const { now, wakeDueAt, bedtimeToday } = opts;

  if (bedtimeToday == null) {
    return { dueAt: wakeDueAt, kind: "nap" };
  }

  // Before bedtime: prefer an upcoming nap; if the wake window is already
  // past (or lands at/after bedtime), show sleep approaching at bedtime.
  if (now < bedtimeToday) {
    if (wakeDueAt < bedtimeToday && now < wakeDueAt) {
      return { dueAt: wakeDueAt, kind: "nap" };
    }
    return { dueAt: bedtimeToday, kind: "sleep" };
  }

  // Past bedtime → sleep due at tonight's bedtime (overdue until logged).
  return { dueAt: bedtimeToday, kind: "sleep" };
}

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

type DueItem = {
  type: "feed" | "medication" | "pump" | "sleep";
  label: string;
  dueAt: number;
  status: "ok" | "approaching" | "overdue" | "ongoing";
  minutesUntilDue: number;
  caregiverName?: string;
};

const emptyDelivery = {
  feedDueAt: null as number | null,
  pumpDueAt: null as number | null,
  napDueAt: null as number | null,
};

/**
 * What's due vs device delivery are split on purpose:
 * - `items` + `scheduleSlots`: shared village guide (clock slots in schedule
 *   mode). Every locked caregiver can read this.
 * - `delivery`: always interval-from-last-log (feed hours / wake window /
 *   pump interval) for notifications and lock-screen timers — never stuck on
 *   a missed timetable slot.
 */
export const getDueStatus = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    now: v.number(),
  },
  returns: v.object({
    reminderMode: v.union(v.literal("interval"), v.literal("schedule")),
    feedIntervalHours: v.number(),
    /** Interval actually used for delivery next-feed due (day or night). */
    effectiveFeedIntervalHours: v.number(),
    nightFeedIntervalEnabled: v.boolean(),
    nightFeedIntervalHours: v.number(),
    nightFeedWindowStart: v.string(),
    nightFeedWindowEnd: v.string(),
    usingNightInterval: v.boolean(),
    notifyBeforeMinutes: v.number(),
    /** Shared timetable rows for What's due guide (any caregiver). */
    scheduleSlots: v.array(scheduleSlotValidator),
    /** Interval-based dues for ReminderScheduler / Live Activities. */
    delivery: deliveryValidator,
    items: v.array(dueItemValidator),
  }),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const night = resolveNightFeedSettings(tracker ?? undefined);
    if (!tracker) {
      return {
        reminderMode: "interval" as const,
        feedIntervalHours: DEFAULT_FEED_INTERVAL_HOURS,
        effectiveFeedIntervalHours: DEFAULT_FEED_INTERVAL_HOURS,
        nightFeedIntervalEnabled: night.enabled,
        nightFeedIntervalHours: night.intervalHours,
        nightFeedWindowStart: night.start,
        nightFeedWindowEnd: night.end,
        usingNightInterval: false,
        notifyBeforeMinutes: DEFAULT_NOTIFY_BEFORE_MINUTES,
        scheduleSlots: [],
        delivery: emptyDelivery,
        items: [],
      };
    }

    const reminderMode = resolveReminderMode(tracker.reminderMode);
    // Always normalize so any caregiver can see the village schedule guide,
    // even while viewing What’s due (not only the settings editor).
    const schedule = normalizeReminderSchedule(tracker.reminderSchedule);
    const scheduleSlots =
      reminderMode === "schedule" ? schedule.slots : [];
    const feedIntervalHours =
      tracker.feedIntervalHours ?? DEFAULT_FEED_INTERVAL_HOURS;
    const notifyBeforeMinutes =
      tracker.notifyBeforeMinutes ?? DEFAULT_NOTIFY_BEFORE_MINUTES;
    const items: DueItem[] = [];
    const delivery = { ...emptyDelivery };
    const timeZone = resolveTrackerTimezone(tracker);

    let effectiveFeedIntervalHours = feedIntervalHours;
    let usingNightInterval = false;

    const activeFeed = tracker.activeFeedSession;
    if (activeFeed) {
      // Live feed timer replaces next-feed due until the session ends.
      items.push({
        type: "feed",
        label: "feed",
        dueAt: activeFeed.startedAt,
        status: "ongoing",
        minutesUntilDue: Math.max(
          0,
          Math.floor((args.now - activeFeed.startedAt) / 60_000)
        ),
        caregiverName: activeFeed.caregiverName,
      });
    } else {
      const recentFeeds = await ctx.db
        .query("feedEntries")
        .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", tracker._id))
        .order("desc")
        .take(40);
      const lastFeed = recentFeeds.find(
        (feed) => feed.type === "breast" || feed.type === "bottle"
      );

      if (lastFeed) {
        const feedAt = clampFeedAtForSkew(lastFeed.timestamp, args.now);
        const intervalDueAt = computeFeedDueAt(
          lastFeed.timestamp,
          feedIntervalHours,
          night,
          { now: args.now, timeZone }
        );
        delivery.feedDueAt = intervalDueAt;
        effectiveFeedIntervalHours =
          (intervalDueAt - feedAt) / (60 * 60 * 1000);
        usingNightInterval =
          night.enabled &&
          effectiveFeedIntervalHours > feedIntervalHours + 1e-9;

        let guideDueAt: number | null = intervalDueAt;
        if (reminderMode === "schedule") {
          const feedTimes = timesForKind(schedule.slots, "feed");
          guideDueAt =
            feedTimes.length === 0
              ? null
              : computeNextClockDueAt(
                  feedTimes,
                  timeZone,
                  lastFeed.timestamp,
                  args.now
                );
        }
        if (guideDueAt != null) {
          const due = computeDueStatus(guideDueAt, args.now);
          items.push({
            type: "feed",
            label: "feed",
            dueAt: guideDueAt,
            ...due,
          });
        }
      }
    }

    const medicationReminders = tracker.medicationReminders ?? [];
    for (const reminder of medicationReminders) {
      let lastLoggedAt = reminder.lastLoggedAt;

      if (!lastLoggedAt) {
        const medEntries = await ctx.db
          .query("healthEntries")
          .withIndex("by_tracker_and_type", (q) =>
            q.eq("trackerId", tracker._id).eq("type", "medication")
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
          q.eq("trackerId", tracker._id)
        )
        .order("desc")
        .first();

      const pumpIntervalHours =
        pumpSchedule.intervalHours ?? DEFAULT_PUMP_INTERVAL_HOURS;
      const intervalDueAt = computeIntervalPumpDueAt(
        lastPump?.timestamp,
        pumpIntervalHours,
        args.now
      );

      // Delivery always prefers interval-from-last when schedule mode; in
      // interval mode keep fixed-slot pump if configured.
      if (reminderMode === "schedule") {
        delivery.pumpDueAt = intervalDueAt;
      } else {
        const mode = pumpSchedule.mode ?? "fixed";
        delivery.pumpDueAt =
          mode === "interval"
            ? intervalDueAt
            : computeNextPumpDueAt(
                pumpSchedule,
                lastPump?.timestamp,
                args.now
              );
      }

      let guideDueAt: number | null = delivery.pumpDueAt;
      if (reminderMode === "schedule") {
        const pumpTimes = timesForKind(schedule.slots, "pump");
        const clockTimes =
          pumpTimes.length > 0 ? pumpTimes : pumpSchedule.times;
        guideDueAt =
          clockTimes.length === 0
            ? null
            : computeNextClockDueAt(
                clockTimes,
                timeZone,
                lastPump?.timestamp,
                args.now
              );
      }

      if (guideDueAt !== null) {
        const due = computeDueStatus(guideDueAt, args.now);
        const amount =
          pumpSchedule.amountMl !== undefined
            ? `${pumpSchedule.amountMl}ml`
            : "pump";
        items.push({
          type: "pump",
          label: amount,
          dueAt: guideDueAt,
          ...due,
        });
      }
    }

    const recentSleep = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", tracker._id))
      .order("desc")
      .take(40);
    const activeSleep = recentSleep.find(
      (entry) => entry.endTime === undefined
    );

    if (activeSleep) {
      // Live nap/sleep replaces wake-window due until the session ends.
      items.push({
        type: "sleep",
        label: activeSleep.type === "night" ? "sleep" : "nap",
        dueAt: activeSleep.startTime,
        status: "ongoing",
        minutesUntilDue: Math.max(
          0,
          Math.floor((args.now - activeSleep.startTime) / 60_000)
        ),
        caregiverName: activeSleep.caregiverName,
      });
    } else {
      const napRemindersEnabled = tracker.napRemindersEnabled !== false;
      if (napRemindersEnabled) {
        const lastEnded = recentSleep.find(
          (entry) => entry.endTime !== undefined
        );
        const wakeWindowMinutes = tracker.wakeWindowMinutes;
        const wakeDueAt =
          wakeWindowMinutes != null &&
          wakeWindowMinutes > 0 &&
          lastEnded?.endTime !== undefined
            ? lastEnded.endTime + wakeWindowMinutes * 60_000
            : null;

        let intervalSleepDue: {
          dueAt: number;
          kind: "nap" | "sleep";
        } | null = null;
        if (wakeDueAt != null) {
          const bedtimeToday = todaysBedtimeMs(
            args.now,
            timeZone,
            night.start
          );
          const sleptTonight =
            bedtimeToday != null &&
            recentSleep.some(
              (entry) =>
                entry.startTime >= bedtimeToday && entry.type === "night"
            );
          if (!sleptTonight) {
            intervalSleepDue = resolveSleepDue({
              now: args.now,
              wakeDueAt,
              bedtimeToday,
            });
          }
        }
        if (intervalSleepDue) {
          delivery.napDueAt = intervalSleepDue.dueAt;
        }

        if (reminderMode === "schedule" && lastEnded?.endTime) {
          const napTimes = timesForKind(schedule.slots, "nap");
          if (napTimes.length > 0) {
            const clockDueAt = computeNextClockDueAt(
              napTimes,
              timeZone,
              lastEnded.endTime,
              args.now
            );
            if (clockDueAt != null) {
              const due = computeDueStatus(clockDueAt, args.now);
              items.push({
                type: "sleep",
                label: "nap",
                dueAt: clockDueAt,
                ...due,
              });
            }
          }
        } else if (intervalSleepDue) {
          const due = computeDueStatus(intervalSleepDue.dueAt, args.now);
          items.push({
            type: "sleep",
            label: intervalSleepDue.kind,
            dueAt: intervalSleepDue.dueAt,
            ...due,
          });
        }
      }
    }

    items.sort((a, b) => a.dueAt - b.dueAt);

    return {
      reminderMode,
      feedIntervalHours,
      effectiveFeedIntervalHours,
      nightFeedIntervalEnabled: night.enabled,
      nightFeedIntervalHours: night.intervalHours,
      nightFeedWindowStart: night.start,
      nightFeedWindowEnd: night.end,
      usingNightInterval,
      notifyBeforeMinutes,
      scheduleSlots,
      delivery,
      items,
    };
  },
});
