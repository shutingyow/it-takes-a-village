"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatTime } from "@/app/lib/utils";
import {
  computeIntervalPumpDueAt,
  DEFAULT_PUMP_INTERVAL_HOURS,
  listUpcomingPumpDueAts,
} from "@/convex/lib/pumpSchedule";
import {
  DEFAULT_NOTIFY_BEFORE_MINUTES,
  getDeviceRemindersEnabled,
  syncDueNotifications,
} from "@/app/lib/deviceNotifications";
import { syncFeedLiveActivity } from "@/app/lib/feedLiveActivity";
import { isFeedTimerRecording } from "@/app/lib/feedTimer";

interface ReminderSchedulerProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  feedIntervalHours?: number;
  notifyBeforeMinutes?: number;
  wakeWindowMinutes?: number;
  pumpSchedule?: {
    enabled: boolean;
    times: string[];
    amountMl?: number;
    timezone?: string;
    mode?: "fixed" | "interval";
    intervalHours?: number;
  };
}

/**
 * Keeps local/device notifications in sync with last feed + pump schedule + nap wake window.
 * Mount once on the open tracker (caregiver unlocked). Opt-in is localStorage.
 * Feed (and pump-in-interval-mode) fire at due − notifyBeforeMinutes.
 * Feed countdown is suppressed while a feed timer is actively recording.
 *
 * Resyncs when due timestamps / status / settings change — not every clock tick —
 * so cancel+reschedule does not eat an overdue ASAP alert.
 */
export function ReminderScheduler({
  trackerId,
  secretLink,
  feedIntervalHours,
  notifyBeforeMinutes: notifyBeforeProp,
  wakeWindowMinutes,
  pumpSchedule,
}: ReminderSchedulerProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-check opt-in / feed-timer when returning to the tab (settings may have changed).
  const [optInTick, setOptInTick] = useState(0);
  useEffect(() => {
    const onFocus = () => setOptInTick((n) => n + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "deviceRemindersEnabled") onFocus();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("deviceRemindersChanged", onFocus);
    window.addEventListener("feedTimerChanged", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("deviceRemindersChanged", onFocus);
      window.removeEventListener("feedTimerChanged", onFocus);
    };
  }, []);

  const dueStatus = useQuery(api.reminders.getDueStatus, {
    trackerId,
    now,
  });
  const lastPump = useQuery(api.pumpEntries.getLast, { trackerId });
  const recentSleep = useQuery(api.sleepEntries.getRecent, {
    trackerId,
    limit: 10,
  });

  const feedItem = dueStatus?.items.find((item) => item.type === "feed");
  const feedDueKey = feedItem
    ? `${feedItem.dueAt}:${feedItem.status}`
    : "none";
  const hourBucket = Math.floor(now / 3_600_000);

  useEffect(() => {
    if (!dueStatus) return;

    const enabled = getDeviceRemindersEnabled();
    const lead =
      notifyBeforeProp ??
      dueStatus.notifyBeforeMinutes ??
      DEFAULT_NOTIFY_BEFORE_MINUTES;

    let pumpDueAts: number[] = [];
    if (enabled && pumpSchedule?.enabled) {
      const mode = pumpSchedule.mode ?? "fixed";
      if (mode === "interval") {
        const dueAt = computeIntervalPumpDueAt(
          lastPump?.timestamp,
          pumpSchedule.intervalHours ?? DEFAULT_PUMP_INTERVAL_HOURS,
          Date.now()
        );
        if (dueAt !== null) pumpDueAts = [dueAt];
      } else {
        pumpDueAts = listUpcomingPumpDueAts(
          {
            enabled: true,
            times: pumpSchedule.times,
            amountMl: pumpSchedule.amountMl,
            timezone: pumpSchedule.timezone,
          },
          lastPump?.timestamp,
          Date.now(),
          6
        );
      }
    }

    const recording = isFeedTimerRecording(secretLink);
    const feedDueAt =
      enabled && feedItem && !recording ? feedItem.dueAt : null;

    let napDueAt: number | null = null;
    if (enabled && wakeWindowMinutes != null && wakeWindowMinutes > 0) {
      const lastNap = recentSleep?.find(
        (entry) => entry.type === "nap" && entry.endTime !== undefined
      );
      if (lastNap?.endTime !== undefined) {
        napDueAt = lastNap.endTime + wakeWindowMinutes * 60_000;
      }
    }

    const feedOverdue =
      feedItem != null && feedItem.status === "overdue" && feedDueAt !== null;

    void syncDueNotifications({
      feedDueAt,
      pumpDueAts,
      napDueAt,
      notifyBeforeMinutes: lead,
      feedTitle: t("nextFeedDue"),
      feedTitleOverdue: t("feedOverdueTitle"),
      feedBodyLead: (minutes) =>
        t("deviceNotifFeedLead", { minutes: String(minutes) }),
      feedBodyAtDue: (clock) => t("deviceNotifFeedBody", { time: clock }),
      feedBodyOverdue: (clock) =>
        t("deviceNotifFeedOverdue", { time: clock }),
      feedBodyCountdown: (minutes) =>
        t("deviceNotifFeedCountdown", { minutes: String(minutes) }),
      pumpTitle: t("nextPumpDue"),
      pumpBodyLead: (minutes) =>
        t("deviceNotifPumpLead", { minutes: String(minutes) }),
      pumpBodyAtDue: (clock) => t("deviceNotifPumpBody", { time: clock }),
      napTitle: t("nextNapDue"),
      napBodyLead: (minutes) =>
        t("deviceNotifNapLead", { minutes: String(minutes) }),
      napBodyAtDue: (clock) => t("deviceNotifNapBody", { time: clock }),
      formatClock: formatTime,
    });

    void syncFeedLiveActivity({
      // Overdue: end the Live Activity (don't let the lock-screen timer count up).
      enabled: enabled && !recording && !feedOverdue,
      feedDueAt: feedOverdue ? null : feedDueAt,
      title: t("nextFeedDue"),
      subtitle: t("liveActivityFeedSubtitle"),
    });
  }, [
    dueStatus,
    feedItem,
    feedDueKey,
    hourBucket,
    lastPump?.timestamp,
    recentSleep,
    pumpSchedule,
    feedIntervalHours,
    notifyBeforeProp,
    wakeWindowMinutes,
    secretLink,
    t,
    optInTick,
  ]);

  return null;
}
