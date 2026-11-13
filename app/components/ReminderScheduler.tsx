"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Capacitor } from "@capacitor/core";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatTime } from "@/app/lib/utils";
import { listUpcomingPumpDueAts } from "@/convex/lib/pumpSchedule";
import {
  DEFAULT_NOTIFY_BEFORE_MINUTES,
  syncDueNotifications,
} from "@/app/lib/deviceNotifications";
import { syncDevicePushRegistration } from "@/app/lib/devicePush";
import {
  getLiveActivityKindEnabled,
  getOrCreateDeviceId,
  setLiveActivityPushTokenHandler,
  syncLiveActivity,
} from "@/app/lib/feedLiveActivity";
import {
  reminderNotificationsEnabled,
  reminderTimersEnabled,
} from "@/app/lib/reminderDelivery";
import { isFeedTimerRecording } from "@/app/lib/feedTimer";

interface ReminderSchedulerProps {
  selectedCaregiver: string;
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
  selectedCaregiver,
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
  const upsertDevicePushToken = useMutation(
    api.pushRegistrations.upsertDevicePushToken
  );
  const [now, setNow] = useState(() => Date.now());
  // Re-check opt-in / feed-timer when returning to the tab (settings may have changed).
  const [optInTick, setOptInTick] = useState(0);

  useEffect(() => {
    setLiveActivityPushTokenHandler(({ activityId, pushToken, kind }) => {
      void upsertLiveActivity({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        activityId,
        pushToken,
        deviceId: getOrCreateDeviceId(),
        kind: kind ?? "last-feed",
      });
    });
    return () => setLiveActivityPushTokenHandler(null);
  }, [secretLink, selectedCaregiver, upsertLiveActivity]);

  // Register APNs device token so Convex can silent-wake and cancel stale
  // local feed alerts when another caregiver logs a feed.
  useEffect(() => {
    void syncDevicePushRegistration({
      enabled: reminderNotificationsEnabled(),
      secretLink,
      actingCaregiverName: selectedCaregiver,
      upsert: upsertDevicePushToken,
    });
  }, [secretLink, selectedCaregiver, upsertDevicePushToken, optInTick]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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
    secretLink,
    actingCaregiverName: selectedCaregiver,
    now,
  });
  const lastPump = useQuery(api.pumpEntries.getLast, { secretLink, actingCaregiverName: selectedCaregiver });
  const activeSleep = useQuery(api.sleepEntries.getActive, { secretLink, actingCaregiverName: selectedCaregiver });
  const activeFeed = useQuery(api.feedSessions.getActive, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
  });

  const feedItem = dueStatus?.items.find((item) => item.type === "feed");
  const pumpItem = dueStatus?.items.find((item) => item.type === "pump");
  const sleepItem = dueStatus?.items.find((item) => item.type === "sleep");
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

    const notifOn = reminderNotificationsEnabled();
    const timerOn = reminderTimersEnabled();
    const lead =
      notifyBeforeProp ??
      dueStatus.notifyBeforeMinutes ??
      DEFAULT_NOTIFY_BEFORE_MINUTES;

    let pumpDueAts: number[] = [];
    if (notifOn && pumpSchedule?.enabled) {
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

    const recording =
      isFeedTimerRecording(secretLink) || activeFeed != null;
    const feedDueAt =
      notifOn && feedRemindersEnabled && feedItem && !recording && !activeSleep
        ? feedItem.dueAt
        : null;

    // Same source as What's due (wake window → pivot to bedtime/sleep).
    const napDueAt =
      notifOn && napRemindersEnabled && !activeSleep && sleepItem
        ? sleepItem.dueAt
        : null;

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

    // Live Activities own the Dynamic Island compact pill and cover the
    // system status bar. Only keep one while a feed/sleep session is
    // actively in progress; end "since last" timers so the island clears.
    // Wait for session queries to settle so a loading undefined does not
    // tear down a real ongoing activity.
    if (activeFeed !== undefined) {
      const feedStartedAt = activeFeed?.startedAt ?? null;
      if (feedStartedAt != null) {
        void syncLiveActivity({
          kind: "last-feed",
          enabled: timerOn && getLiveActivityKindEnabled("last-feed"),
          lastAt: feedStartedAt,
          title: t("liveActivityFeedOngoingTitle"),
          subtitle: t("liveActivityFeedOngoingSubtitle", {
            time: formatTime(feedStartedAt),
            name: activeFeed?.caregiverName ?? "",
          }),
        });
      } else {
        void syncLiveActivity({
          kind: "last-feed",
          enabled: false,
          lastAt: null,
          title: t("liveActivityLastFeedTitle"),
          subtitle: t("liveActivityLastFeedSubtitleEmpty"),
        });
      }
    }

    // No active pump session model — never leave a perpetual pump island.
    void syncLiveActivity({
      kind: "last-pump",
      enabled: false,
      lastAt: null,
      title: t("liveActivityLastPumpTitle"),
      subtitle: t("liveActivityLastPumpSubtitleEmpty"),
    });

    if (activeSleep !== undefined) {
      if (activeSleep) {
        const sleepTitle =
          activeSleep.type === "nap"
            ? t("liveActivityNappingTitle")
            : t("liveActivitySleepingTitle");
        void syncLiveActivity({
          kind: "last-nap",
          enabled: timerOn && getLiveActivityKindEnabled("last-nap"),
          lastAt: activeSleep.startTime,
          title: sleepTitle,
          subtitle: t("liveActivitySleepOngoingSubtitle", {
            time: formatTime(activeSleep.startTime),
            name: activeSleep.caregiverName,
          }),
        });
      } else {
        void syncLiveActivity({
          kind: "last-nap",
          enabled: false,
          lastAt: null,
          title: t("liveActivityLastNapTitle"),
          subtitle: t("liveActivityLastNapSubtitleEmpty"),
        });
      }
    }
  }, [
    dueStatus,
    feedItem,
    pumpItem,
    sleepItem,
    feedDueKey,
    pumpDueKey,
    hourBucket,
    lastPump,
    activeSleep,
    activeFeed,
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
