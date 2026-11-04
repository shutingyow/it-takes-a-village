"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import {
  getOrCreateDeviceId,
  setLiveActivityPushTokenHandler,
  syncFeedLiveActivity,
} from "@/app/lib/feedLiveActivity";
import { isFeedTimerRecording } from "@/app/lib/feedTimer";

interface ReminderSchedulerProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  feedIntervalHours?: number;
  notifyBeforeMinutes?: number;
  feedRemindersEnabled?: boolean;
  wakeWindowMinutes?: number;
  napRemindersEnabled?: boolean;
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
  feedRemindersEnabled = true,
  wakeWindowMinutes,
  napRemindersEnabled = true,
  pumpSchedule,
}: ReminderSchedulerProps) {
  const { t } = useLanguage();
  const upsertLiveActivity = useMutation(
    api.pushRegistrations.upsertLiveActivity
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setLiveActivityPushTokenHandler(({ activityId, pushToken }) => {
      void upsertLiveActivity({
        trackerId,
        activityId,
        pushToken,
        deviceId: getOrCreateDeviceId(),
      });
    });
    return () => setLiveActivityPushTokenHandler(null);
  }, [trackerId, upsertLiveActivity]);

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
  const lastFeed = useQuery(api.feedEntries.getLast, { trackerId });
  const lastPump = useQuery(api.pumpEntries.getLast, { trackerId });
  const recentSleep = useQuery(api.sleepEntries.getRecent, {
    trackerId,
    limit: 10,
  });
  const activeSleep = useQuery(api.sleepEntries.getActive, { trackerId });

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
      enabled && feedRemindersEnabled && feedItem && !recording
        ? feedItem.dueAt
        : null;

    // Same idea as pausing feed alerts while a feed timer is running:
    // don't nag "nap due" while a live nap/night sleep is already in progress.
    let napDueAt: number | null = null;
    if (
      enabled &&
      napRemindersEnabled &&
      wakeWindowMinutes != null &&
      wakeWindowMinutes > 0 &&
      !activeSleep
    ) {
      const lastNap = recentSleep?.find(
        (entry) => entry.type === "nap" && entry.endTime !== undefined
      );
      if (lastNap?.endTime !== undefined) {
        napDueAt = lastNap.endTime + wakeWindowMinutes * 60_000;
      }
    }

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

    // Lock screen: time since last feed (counts up), not next-due countdown.
    const lastMilkFeedAt = lastFeed?.timestamp ?? null;
    void syncFeedLiveActivity({
      enabled: enabled && !recording,
      lastFeedAt: lastMilkFeedAt,
      title: t("liveActivityLastFeedTitle"),
      subtitle: lastMilkFeedAt
        ? t("liveActivityLastFeedSubtitle", {
            time: formatTime(lastMilkFeedAt),
          })
        : t("liveActivityLastFeedSubtitleEmpty"),
    });
  }, [
    dueStatus,
    feedItem,
    pumpItem,
    feedDueKey,
    pumpDueKey,
    hourBucket,
    lastFeed,
    lastPump,
    recentSleep,
    activeSleep,
    pumpSchedule,
    feedIntervalHours,
    notifyBeforeProp,
    feedRemindersEnabled,
    wakeWindowMinutes,
    napRemindersEnabled,
    secretLink,
    t,
    optInTick,
  ]);

  return null;
}
