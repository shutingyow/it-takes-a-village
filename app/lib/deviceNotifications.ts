/**
 * Device reminders for feed / pump due times.
 *
 * - Capacitor native: @capacitor/local-notifications (works when app is
 *   backgrounded; phone must stay installed / not force-quit for days).
 * - Browser / Safari tab: Notification API + in-page timers while the page
 *   is open. iOS Safari tabs are limited; use the Capacitor app for pocket
 *   reminders. True APNs push when killed for days is documented in IOS.md.
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const OPT_IN_KEY = "deviceRemindersEnabled";

/** Stable notification IDs so we can cancel/reschedule cleanly. */
export const NOTIF_ID = {
  feed: 1001,
  /** Countdown milestones before due (e.g. 60 / 45 / 30 / 15 min left). */
  feedCountdown: [1101, 1102, 1103, 1104, 1105, 1106] as const,
  pump: [2001, 2002, 2003, 2004, 2005, 2006] as const,
  nap: 3001,
} as const;

const ALL_IDS = [
  NOTIF_ID.feed,
  ...NOTIF_ID.feedCountdown,
  ...NOTIF_ID.pump,
  NOTIF_ID.nap,
];

/** Minutes-before-due at which to post an updating "Next feed in xx" alert. */
const FEED_COUNTDOWN_MILESTONES = [60, 45, 30, 15] as const;

export const DEFAULT_NOTIFY_BEFORE_MINUTES = 10;

export type NotifPermission =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported";

export type DueNotificationPayload = {
  /** Activity due timestamps (last log + interval, or fixed pump slots). */
  feedDueAt: number | null;
  pumpDueAts: number[];
  /** Nap due = last nap end + wake window. Null when unset / no completed nap. */
  napDueAt?: number | null;
  /** Minutes before due to fire the alert (0 = at due time). */
  notifyBeforeMinutes: number;
  feedTitle: string;
  /** Title when the feed is already overdue (one-shot). */
  feedTitleOverdue?: string;
  /** Body for lead-time alerts, e.g. "Feed due in 10 min · 3:40 PM". */
  feedBodyLead: (minutes: number, dueAt: number) => string;
  /** Body when notifying at due time (lead = 0). */
  feedBodyAtDue: (clock: string) => string;
  /** Body when already past due, e.g. "Feed overdue · was due around 2:30". */
  feedBodyOverdue: (clock: string) => string;
  /** Body for countdown milestones, e.g. "Next feed in 30 min · 3:40 PM". */
  feedBodyCountdown: (minutes: number, dueAt: number) => string;
  pumpTitle: string;
  pumpBodyLead: (minutes: number, dueAt: number) => string;
  pumpBodyAtDue: (clock: string) => string;
  napTitle?: string;
  napBodyLead?: (minutes: number, dueAt: number) => string;
  napBodyAtDue?: (clock: string) => string;
  formatClock: (ms: number) => string;
};

type BrowserTimer = {
  id: ReturnType<typeof setTimeout>;
  key: string;
};

let browserTimers: BrowserTimer[] = [];
const browserFiredKeys = new Set<string>();

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getDeviceRemindersEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(OPT_IN_KEY) === "1";
}

export function setDeviceRemindersEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPT_IN_KEY, enabled ? "1" : "0");
}

export async function getNotificationPermission(): Promise<NotifPermission> {
  if (typeof window === "undefined") return "unsupported";

  if (isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      const display = status.display;
      if (display === "granted") return "granted";
      if (display === "denied") return "denied";
      return "prompt";
    } catch {
      return "unsupported";
    }
  }

  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "prompt";
}

export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (isNativePlatform()) {
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === "granted" ? "granted" : "denied";
    } catch {
      return "unsupported";
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") return "granted";
    if (result === "denied") return "denied";
    return "prompt";
  } catch {
    return "denied";
  }
}

function clearBrowserTimers(): void {
  for (const timer of browserTimers) {
    clearTimeout(timer.id);
  }
  browserTimers = [];
}

function showBrowserNotification(
  title: string,
  body: string,
  tag: string
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag });
  } catch {
    // Some browsers require a service worker registration.
  }
}

async function cancelNativeNotifications(): Promise<void> {
  try {
    // Cancel by known IDs and any other pending local notifs we scheduled
    // (covers older ID schemes so a stale "pump in 10 min" cannot linger).
    const pending = await LocalNotifications.getPending().catch(() => null);
    const pendingIds =
      pending?.notifications.map((n) => n.id).filter((id) => typeof id === "number") ??
      [];
    const ids = Array.from(new Set<number>([...ALL_IDS, ...pendingIds]));
    if (ids.length === 0) return;
    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    });
  } catch {
    // Plugin may be unavailable in web preview.
  }
}

export async function cancelAllDueNotifications(): Promise<void> {
  clearBrowserTimers();
  if (isNativePlatform()) {
    await cancelNativeNotifications();
  }
}

/**
 * When to fire relative to dueAt.
 * - Future notify time → schedule then
 * - Notify time passed but due still future → fire soon (ASAP)
 * - Both past → treat as overdue (caller/planOnce fires soon once)
 */
export function computeNotifyAt(
  dueAt: number,
  notifyBeforeMinutes: number,
  now: number
): number {
  const leadMs = Math.max(0, notifyBeforeMinutes) * 60 * 1000;
  const notifyAt = dueAt - leadMs;
  if (notifyAt > now) return notifyAt;
  if (dueAt > now) return now + 5_000;
  return dueAt;
}

/**
 * Cancel stale schedules and (re)schedule feed + upcoming pump notifications.
 * Call whenever last feed/pump or reminder settings change.
 */
export async function syncDueNotifications(
  payload: DueNotificationPayload
): Promise<void> {
  const enabled = getDeviceRemindersEnabled();
  const permission = await getNotificationPermission();

  await cancelAllDueNotifications();

  if (!enabled || permission !== "granted") {
    return;
  }

  const now = Date.now();
  const MIN_AHEAD_MS = 5_000;
  const MAX_AHEAD_MS = 36 * 60 * 60 * 1000;
  const lead = Math.max(0, payload.notifyBeforeMinutes);

  type Planned = {
    id: number;
    title: string;
    body: string;
    at: number;
    tag: string;
  };

  const planned: Planned[] = [];

  const planOnce = (
    id: number,
    title: string,
    body: string,
    fireAt: number,
    tag: string
  ) => {
    if (fireAt > now) {
      if (fireAt - now > MAX_AHEAD_MS) return;
      planned.push({ id, title, body, at: fireAt, tag });
      return;
    }
    // Past due / catch-up: arm ASAP. Do not mark "fired" on schedule — a
    // cancel+resync within a few seconds (focus / settings) used to set the
    // flag then cancel the pending alert, so the overdue notice never arrived.
    const firedKey = `deviceNotifFired:${tag}`;
    const armKey = `deviceNotifArm:${tag}`;
    try {
      if (localStorage.getItem(firedKey) === "1") return;
      const armedAt = localStorage.getItem(armKey);
      if (armedAt && now - Number(armedAt) > 90_000) {
        localStorage.setItem(firedKey, "1");
        return;
      }
      if (!armedAt) localStorage.setItem(armKey, String(now));
    } catch {
      // ignore quota / private mode
    }
    planned.push({
      id,
      title,
      body,
      at: now + MIN_AHEAD_MS,
      tag,
    });
  };

  /** Minutes remaining at a scheduled fire time (ceil, never negative). */
  const remainingMinutesAt = (dueAt: number, at: number) =>
    Math.max(0, Math.ceil((dueAt - at) / 60_000));

  /**
   * Body must match real remaining time at fire — not the configured lead
   * alone. Catch-up ASAP fires used to say “due in 10 min” when only 3 were left.
   */
  const bodyForDue = (
    dueAt: number,
    fireAt: number,
    leadBody: (minutes: number, dueAt: number) => string,
    atDueBody: (clock: string) => string,
    overdueBody?: (clock: string) => string
  ) => {
    if (dueAt <= now) {
      return (overdueBody ?? atDueBody)(payload.formatClock(dueAt));
    }
    const remaining = remainingMinutesAt(dueAt, Math.max(fireAt, now));
    if (remaining <= 0) {
      return atDueBody(payload.formatClock(dueAt));
    }
    return leadBody(remaining, dueAt);
  };

  if (payload.feedDueAt !== null) {
    const feedDueAt = payload.feedDueAt;
    const fireAt = computeNotifyAt(feedDueAt, lead, now);
    const overdue = feedDueAt <= now;
    planOnce(
      NOTIF_ID.feed,
      overdue
        ? (payload.feedTitleOverdue ?? payload.feedTitle)
        : payload.feedTitle,
      bodyForDue(
        feedDueAt,
        fireAt,
        payload.feedBodyLead,
        payload.feedBodyAtDue,
        payload.feedBodyOverdue
      ),
      fireAt,
      `feed-${feedDueAt}-lead${lead}`
    );

    // Countdown milestones only while still before due (never after a miss).
    // (True lock-screen ticking timer needs Live Activities — see feedLiveActivity.)
    if (!overdue) {
      const leadMs = lead * 60_000;
      FEED_COUNTDOWN_MILESTONES.forEach((minsLeft, index) => {
        const id = NOTIF_ID.feedCountdown[index];
        if (id === undefined) return;
        // Skip milestones at/after the configured lead alert (avoid duplicates).
        if (minsLeft <= lead) return;
        const milestoneAt = feedDueAt - minsLeft * 60_000;
        if (milestoneAt <= now) return;
        if (milestoneAt >= feedDueAt - leadMs && lead > 0) return;
        // Body uses the milestone’s own remaining minutes (= minsLeft at fire).
        planOnce(
          id,
          payload.feedTitle,
          payload.feedBodyCountdown(minsLeft, feedDueAt),
          milestoneAt,
          `feed-countdown-${feedDueAt}-${minsLeft}`
        );
      });
    }
  }

  payload.pumpDueAts.slice(0, NOTIF_ID.pump.length).forEach((dueAt, index) => {
    const id = NOTIF_ID.pump[index];
    if (id === undefined) return;
    const fireAt = computeNotifyAt(dueAt, lead, now);
    planOnce(
      id,
      payload.pumpTitle,
      bodyForDue(dueAt, fireAt, payload.pumpBodyLead, payload.pumpBodyAtDue),
      fireAt,
      `pump-${dueAt}-lead${lead}`
    );
  });

  if (
    payload.napDueAt != null &&
    payload.napTitle &&
    payload.napBodyLead &&
    payload.napBodyAtDue
  ) {
    const napDueAt = payload.napDueAt;
    const fireAt = computeNotifyAt(napDueAt, lead, now);
    planOnce(
      NOTIF_ID.nap,
      payload.napTitle,
      bodyForDue(napDueAt, fireAt, payload.napBodyLead, payload.napBodyAtDue),
      fireAt,
      `nap-${napDueAt}-lead${lead}`
    );
  }

  if (planned.length === 0) return;

  if (isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: planned.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: new Date(n.at), allowWhileIdle: true },
          extra: { tag: n.tag },
        })),
      });
    } catch (err) {
      console.error("Failed to schedule local notifications", err);
    }
    return;
  }

  // Browser: schedule in-page timers (only while tab/PWA stays open).
  for (const n of planned) {
    if (browserFiredKeys.has(n.tag)) continue;
    const delay = Math.max(MIN_AHEAD_MS, n.at - now);
    if (delay > MAX_AHEAD_MS) continue;
    const timerId = setTimeout(() => {
      browserFiredKeys.add(n.tag);
      showBrowserNotification(n.title, n.body, n.tag);
    }, delay);
    browserTimers.push({ id: timerId, key: n.tag });
  }
}
