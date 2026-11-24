"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Capacitor } from "@capacitor/core";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatTime } from "@/app/lib/utils";
import { listUpcomingPumpDueAts } from "@/convex/lib/pumpSchedule";
import {
  resolveReminderMode,
  type ReminderMode,
  type ScheduleSlot,
} from "@/convex/lib/clockSchedule";
import {
  DEFAULT_NOTIFY_BEFORE_MINUTES,
  syncDueNotifications,
} from "@/app/lib/deviceNotifications";
import { syncDevicePushRegistration } from "@/app/lib/devicePush";
import {
  drainNativePendingPushTokens,
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
  /** Prefixed on Lock Screen titles to match APNs cross-caregiver updates. */
  babyName?: string;
  feedIntervalHours?: number;
  notifyBeforeMinutes?: number;
  feedRemindersEnabled?: boolean;
  wakeWindowMinutes?: number;
  napRemindersEnabled?: boolean;
  reminderMode?: ReminderMode;
  reminderSchedule?: { slots: ScheduleSlot[] };
  timezone?: string;
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
 * Keeps local/device notifications in sync with last-log intervals (and fixed
 * pump slots only when reminderMode is interval). Mount once on the open
 * tracker (caregiver unlocked). Opt-in is localStorage.
 *
 * Uses `getDueStatus.delivery` — not What's due guide clock slots — so lock-
 * screen alerts never stick to a missed timetable time.
 *
 * Resyncs when due timestamps / status / settings change — not every clock tick —
 * so cancel+reschedule does not eat an overdue ASAP alert. Also resyncs when the
 * Capacitor app returns to the foreground (clears stale OS schedules).
 */
export function ReminderScheduler({
  selectedCaregiver,
  secretLink,
  babyName,
  feedIntervalHours,
  notifyBeforeMinutes: notifyBeforeProp,
  feedRemindersEnabled = true,
  wakeWindowMinutes,
  napRemindersEnabled = true,
  reminderMode: reminderModeProp,
  reminderSchedule,
  timezone,
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
  const babyPrefix = babyName?.trim() ? `${babyName.trim()} · ` : "";

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
    // Register tokens ActivityKit issued during silent wake (no JS listener).
    void drainNativePendingPushTokens();
    return () => setLiveActivityPushTokenHandler(null);
  }, [secretLink, selectedCaregiver, upsertLiveActivity]);

  // Register APNs device token for silent wakes when either delivery mode
  // is on. Notifications mode: cancel stale local alerts. Timer mode:
  // native AppDelegate refreshes the since-last Live Activity while
  // backgrounded (ActivityKit push tokens alone are not enough).
  useEffect(() => {
    void syncDevicePushRegistration({
      enabled:
        reminderNotificationsEnabled() || reminderTimersEnabled(),
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
          if (isActive) {
            void drainNativePendingPushTokens();
            onFocus();
          }
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
  const lastFeed = useQuery(api.feedEntries.getLast, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
  });
  const lastPump = useQuery(api.pumpEntries.getLast, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
  });
  const recentSleep = useQuery(api.sleepEntries.getRecent, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    limit: 10,
  });
  const activeSleep = useQuery(api.sleepEntries.getActive, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
  });
  const activeFeed = useQuery(api.feedSessions.getActive, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
  });

  const delivery = dueStatus?.delivery;
  const deliveryKey = delivery
    ? `${delivery.feedDueAt}:${delivery.pumpDueAt}:${delivery.napDueAt}`
    : "none";
  const hourBucket = Math.floor(now / 3_600_000);
  const feedOngoing = dueStatus?.items.some(
    (item) => item.type === "feed" && item.status === "ongoing"
  );

  // Due alerts — independent of Live Activities so a slow dues query cannot
  // block lock-screen timers. Always driven by interval delivery, not guide slots.
  useEffect(() => {
    if (!dueStatus || !delivery) return;
    // Wait until last pump query settles so we don't schedule fixed-slot
    // alerts as if there were no pumps (that caused "in 10 min" vs UI 2h+).
    if (lastPump === undefined) return;

    const notifOn = reminderNotificationsEnabled();
    const lead =
      notifyBeforeProp ??
      dueStatus.notifyBeforeMinutes ??
      DEFAULT_NOTIFY_BEFORE_MINUTES;
    const reminderMode = resolveReminderMode(
      dueStatus.reminderMode ?? reminderModeProp
    );

    let pumpDueAts: number[] = [];
    if (notifOn && pumpSchedule?.enabled) {
      if (reminderMode === "schedule") {
        // Schedule mode: one interval-from-last pump due for delivery.
        if (delivery.pumpDueAt != null) pumpDueAts = [delivery.pumpDueAt];
      } else {
        const mode = pumpSchedule.mode ?? "fixed";
        if (mode === "interval") {
          if (delivery.pumpDueAt != null) pumpDueAts = [delivery.pumpDueAt];
        } else if (delivery.pumpDueAt != null) {
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
          ).filter((ts) => ts > delivery.pumpDueAt!);
          pumpDueAts = [delivery.pumpDueAt, ...later].slice(0, 6);
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
    }

    const recording =
      isFeedTimerRecording(secretLink) || activeFeed != null;

    const feedDueAt =
      notifOn &&
      feedRemindersEnabled &&
      delivery.feedDueAt != null &&
      !feedOngoing &&
      !recording &&
      !activeSleep
        ? delivery.feedDueAt
        : null;

    const napDueAt =
      notifOn &&
      napRemindersEnabled &&
      !activeSleep &&
      delivery.napDueAt != null
        ? delivery.napDueAt
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
  }, [
    dueStatus,
    delivery,
    deliveryKey,
    hourBucket,
    lastPump,
    activeSleep,
    activeFeed,
    feedOngoing,
    pumpSchedule,
    reminderModeProp,
    feedIntervalHours,
    notifyBeforeProp,
    feedRemindersEnabled,
    wakeWindowMinutes,
    napRemindersEnabled,
    secretLink,
    t,
    optInTick,
  ]);

  // Lock screen: each kind shows time since last; an in-progress session of
  // that kind replaces it (feed session → feed, sleep → nap). Sleep must not
  // tear down the feed since-last timer.
  useEffect(() => {
    if (
      activeFeed === undefined ||
      activeSleep === undefined ||
      lastFeed === undefined ||
      lastPump === undefined ||
      recentSleep === undefined
    ) {
      return;
    }

    const timerOn = reminderTimersEnabled();
    const feedStartedAt = activeFeed?.startedAt ?? null;
    if (feedStartedAt != null) {
      void syncLiveActivity({
        kind: "last-feed",
        enabled: timerOn && getLiveActivityKindEnabled("last-feed"),
        lastAt: feedStartedAt,
        title: `${babyPrefix}${t("liveActivityFeedOngoingTitle")}`,
        subtitle: t("liveActivityFeedOngoingSubtitle", {
          time: formatTime(feedStartedAt),
          name: activeFeed?.caregiverName ?? "",
        }),
      });
    } else {
      const lastMilkFeedAt = lastFeed?.timestamp ?? null;
      void syncLiveActivity({
        kind: "last-feed",
        enabled: timerOn && getLiveActivityKindEnabled("last-feed"),
        lastAt: lastMilkFeedAt,
        title: `${babyPrefix}${t("liveActivityLastFeedTitle")}`,
        subtitle: lastMilkFeedAt
          ? t("liveActivityLastFeedSubtitle", {
              time: formatTime(lastMilkFeedAt),
            })
          : t("liveActivityLastFeedSubtitleEmpty"),
      });
    }

    const lastPumpAt = lastPump?.timestamp ?? null;
    void syncLiveActivity({
      kind: "last-pump",
      enabled: timerOn && getLiveActivityKindEnabled("last-pump"),
      lastAt: lastPumpAt,
      title: `${babyPrefix}${t("liveActivityLastPumpTitle")}`,
      subtitle: lastPumpAt
        ? t("liveActivityLastPumpSubtitle", {
            time: formatTime(lastPumpAt),
          })
        : t("liveActivityLastPumpSubtitleEmpty"),
    });

    if (activeSleep) {
      const sleepTitle =
        activeSleep.type === "nap"
          ? t("liveActivityNappingTitle")
          : t("liveActivitySleepingTitle");
      void syncLiveActivity({
        kind: "last-nap",
        enabled: timerOn && getLiveActivityKindEnabled("last-nap"),
        lastAt: activeSleep.startTime,
        title: `${babyPrefix}${sleepTitle}`,
        subtitle: t("liveActivitySleepOngoingSubtitle", {
          time: formatTime(activeSleep.startTime),
          name: activeSleep.caregiverName,
        }),
      });
    } else {
      const lastSleepEnd =
        recentSleep.find((entry) => entry.endTime !== undefined)?.endTime ??
        null;
      void syncLiveActivity({
        kind: "last-nap",
        enabled: timerOn && getLiveActivityKindEnabled("last-nap"),
        lastAt: lastSleepEnd,
        title: `${babyPrefix}${t("liveActivityLastNapTitle")}`,
        subtitle: lastSleepEnd
          ? t("liveActivityLastNapSubtitle", {
              time: formatTime(lastSleepEnd),
            })
          : t("liveActivityLastNapSubtitleEmpty"),
      });
    }
  }, [
    lastFeed,
    lastPump,
    recentSleep,
    activeSleep,
    activeFeed,
    babyPrefix,
    t,
    optInTick,
  ]);

  return null;
}
