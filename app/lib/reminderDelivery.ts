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

/** Migrate older separate toggles into one delivery mode. */
export function getReminderDeliveryMode(): ReminderDeliveryMode {
  if (typeof window === "undefined") return "off";
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (
      stored === "timer" ||
      stored === "notifications" ||
      stored === "off"
    ) {
      return stored;
    }
  } catch {
    // ignore
  }

  const deviceOn = getDeviceRemindersEnabled();
  const liveOn = anyLiveEnabled();
  // Prefer lock-screen timers when both were previously enabled.
  if (liveOn) return "timer";
  if (deviceOn) return "notifications";
  // Historical default: feed Live Activity on without an explicit opt-in flag.
  if (getLiveActivityKindEnabled("last-feed")) return "timer";
  return "off";
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
    // Keep existing per-kind prefs; ensure feed timer is on if all were off.
    if (!anyLiveEnabled()) {
      setLiveActivityKindEnabled("last-feed", true);
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
