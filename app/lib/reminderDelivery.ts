/**
 * How the device reminds caregivers — mutually exclusive.
 * - timer: Lock Screen Live Activities
 * - notifications: local/push due alerts
 * - off: neither
 */
import {
  cancelAllDueNotifications,
  getDeviceRemindersEnabled,
  setDeviceRemindersEnabled,
} from "@/app/lib/deviceNotifications";
import {
  endAllLiveActivities,
  getLiveActivityKindEnabled,
  setLiveActivityKindEnabled,
  type LiveActivityKind,
} from "@/app/lib/feedLiveActivity";

export type ReminderDeliveryMode = "timer" | "notifications" | "off";

const MODE_KEY = "reminderDeliveryMode";
/** One-shot: re-enable feed after the short-lived "in progress only" era. */
const FEED_TIMER_RESTORE_KEY = "liveActivityFeedSinceLastRestored";

const LIVE_KINDS: LiveActivityKind[] = [
  "last-feed",
  "last-pump",
  "last-nap",
];

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("deviceRemindersChanged"));
}

function anyLiveEnabled(): boolean {
  return LIVE_KINDS.some((kind) => getLiveActivityKindEnabled(kind));
}

/**
 * After da57759 labeled feed as "in progress only", some devices left the
 * feed kind off while keeping timer delivery + nap/pump. Restore feed once.
 */
function restoreFeedTimerIfNeeded(mode: ReminderDeliveryMode): void {
  if (typeof window === "undefined" || mode !== "timer") return;
  try {
    if (localStorage.getItem(FEED_TIMER_RESTORE_KEY) === "1") return;
    setLiveActivityKindEnabled("last-feed", true);
    localStorage.setItem(FEED_TIMER_RESTORE_KEY, "1");
  } catch {
    // ignore
  }
}

/** Migrate older separate toggles into one delivery mode. */
export function getReminderDeliveryMode(): ReminderDeliveryMode {
  if (typeof window === "undefined") return "off";
  let mode: ReminderDeliveryMode = "off";
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (
      stored === "timer" ||
      stored === "notifications" ||
      stored === "off"
    ) {
      mode = stored;
    } else {
      const deviceOn = getDeviceRemindersEnabled();
      const liveOn = anyLiveEnabled();
      // Prefer lock-screen timers when both were previously enabled.
      if (liveOn) mode = "timer";
      else if (deviceOn) mode = "notifications";
      // Historical default: feed Live Activity on without an explicit opt-in flag.
      else if (getLiveActivityKindEnabled("last-feed")) mode = "timer";
    }
  } catch {
    // ignore
  }

  restoreFeedTimerIfNeeded(mode);
  return mode;
}

export async function setReminderDeliveryMode(
  mode: ReminderDeliveryMode
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore
  }

  if (mode === "timer") {
    setDeviceRemindersEnabled(false);
    await cancelAllDueNotifications();
    // Feed since-last is the primary lock-screen timer when choosing timers.
    setLiveActivityKindEnabled("last-feed", true);
    try {
      localStorage.setItem(FEED_TIMER_RESTORE_KEY, "1");
    } catch {
      // ignore
    }
  } else if (mode === "notifications") {
    setDeviceRemindersEnabled(true);
    for (const kind of LIVE_KINDS) {
      setLiveActivityKindEnabled(kind, false);
    }
    await endAllLiveActivities();
  } else {
    setDeviceRemindersEnabled(false);
    await cancelAllDueNotifications();
    for (const kind of LIVE_KINDS) {
      setLiveActivityKindEnabled(kind, false);
    }
    await endAllLiveActivities();
  }

  notifyChanged();
}

export function reminderNotificationsEnabled(): boolean {
  return getReminderDeliveryMode() === "notifications";
}

export function reminderTimersEnabled(): boolean {
  return getReminderDeliveryMode() === "timer";
}
