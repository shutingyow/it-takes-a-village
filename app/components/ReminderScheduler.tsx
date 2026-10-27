"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Capacitor } from "@capacitor/core";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatTime } from "@/app/lib/utils";
import { listUpcomingPumpDueAts } from "@/convex/lib/pumpSchedule";
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
 *
 * Pump due times come from the same `getDueStatus` row the UI shows, so a
 * notification never targets a different clock than Due soon.
 *
 * Resyncs when due timestamps / status / settings change — not every clock tick —
 * so cancel+reschedule does not eat an overdue ASAP alert. Also resyncs when the
 * Capacitor app returns to the foreground (clears stale OS schedules).
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

    let removeAppState: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/app").then(({ App }) => {
        void App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) onFocus();
        }).then((handle) => {
          removeAppState = () => {
            void handle.remove();
          };
        });
      });
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("deviceRemindersChanged", onFocus);
      window.removeEventListener("feedTimerChanged", onFocus);
      removeAppState?.();
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
  const pumpItem = dueStatus?.items.find((item) => item.type === "pump");
  const feedDueKey = feedItem
    ? `${feedItem.dueAt}:${feedItem.status}`
    : "none";
  const pumpDueKey = pumpItem
    ? `${pumpItem.dueAt}:${pumpItem.status}`
    : "none";
  const hourBucket = Math.floor(now / 3_600_000);

  useEffect(() => {
    if (!dueStatus) return;
    // Wait until last pump query settles so we don't schedule fixed-slot
    // alerts as if there were no pumps (that caused "in 10 min" vs UI 2h+).
    if (lastPump === undefined) return;

    const enabled = getDeviceRemindersEnabled();
    const lead =
      notifyBeforeProp ??
      dueStatus.notifyBeforeMinutes ??
      DEFAULT_NOTIFY_BEFORE_MINUTES;

    let pumpDueAts: number[] = [];
    if (enabled && pumpSchedule?.enabled) {
      const mode = pumpSchedule.mode ?? "fixed";
      if (mode === "interval") {
        // Exact same due the Due soon card shows.
        if (pumpItem) pumpDueAts = [pumpItem.dueAt];
      } else if (pumpItem) {
        const later = listUpcomingPumpDueAts(
          {
            enabled: true,
            times: pumpSchedule.times,
            amountMl: pumpSchedule.amountMl,
            timezone: pumpSchedule.timezone,
            mode: "fixed",
          },
          lastPump?.timestamp,
          Date.now(),
          6
        ).filter((ts) => ts > pumpItem.dueAt);
        pumpDueAts = [pumpItem.dueAt, ...later].slice(0, 6);
      } else {
        pumpDueAts = listUpcomingPumpDueAts(
          {
            enabled: true,
            times: pumpSchedule.times,
            amountMl: pumpSchedule.amountMl,
            timezone: pumpSchedule.timezone,
            mode: "fixed",
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
      feedBodyLead: (minutes, dueAt) =>
        t("deviceNotifFeedLead", {
          minutes: String(minutes),
          time: formatTime(dueAt),
        }),
      feedBodyAtDue: (clock) => t("deviceNotifFeedBody", { time: clock }),
      feedBodyOverdue: (clock) =>
        t("deviceNotifFeedOverdue", { time: clock }),
      feedBodyCountdown: (minutes, dueAt) =>
        t("deviceNotifFeedCountdown", {
          minutes: String(minutes),
          time: formatTime(dueAt),
        }),
      pumpTitle: t("nextPumpDue"),
      pumpBodyLead: (minutes, dueAt) =>
        t("deviceNotifPumpLead", {
          minutes: String(minutes),
          time: formatTime(dueAt),
        }),
      pumpBodyAtDue: (clock) => t("deviceNotifPumpBody", { time: clock }),
      napTitle: t("nextNapDue"),
      napBodyLead: (minutes, dueAt) =>
        t("deviceNotifNapLead", {
          minutes: String(minutes),
          time: formatTime(dueAt),
        }),
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
    pumpItem,
    feedDueKey,
    pumpDueKey,
    hourBucket,
    lastPump,
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
