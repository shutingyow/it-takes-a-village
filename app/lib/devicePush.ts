/**
 * Register the device APNs token so Convex can silent-wake the app when
 * another caregiver logs a feed. Native AppDelegate then:
 * - cancels stale local due notifications (notifications delivery mode)
 * - updates/restarts the since-last feed Live Activity (timer delivery mode)
 */

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getOrCreateDeviceId } from "@/app/lib/feedLiveActivity";
import {
  cancelAllDueNotifications,
  isNativePlatform,
} from "@/app/lib/deviceNotifications";

type UpsertDevicePushToken = (args: {
  secretLink: string;
  actingCaregiverName: string;
  token: string;
  deviceId: string;
}) => Promise<unknown>;

let listenersAttached = false;
let lastToken: string | null = null;
let lastContext: {
  secretLink: string;
  actingCaregiverName: string;
  upsert: UpsertDevicePushToken;
  /** Timer or notifications delivery — not the legacy local-notif-only flag. */
  enabled: boolean;
} | null = null;

function notifyRemindersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("deviceRemindersChanged"));
}

async function upsertToken(token: string): Promise<void> {
  lastToken = token;
  const ctx = lastContext;
  if (!ctx || !ctx.enabled) return;
  try {
    await ctx.upsert({
      secretLink: ctx.secretLink,
      actingCaregiverName: ctx.actingCaregiverName,
      token,
      deviceId: getOrCreateDeviceId(),
    });
  } catch (err) {
    console.warn("Failed to register device push token", err);
  }
}

async function ensureListeners(): Promise<void> {
  if (listenersAttached || !isNativePlatform()) return;
  if (!Capacitor.isPluginAvailable("PushNotifications")) return;
  listenersAttached = true;

  await PushNotifications.addListener("registration", (token) => {
    void upsertToken(token.value);
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.warn("Push registration failed", error.error);
  });

  // Foreground delivery of feed_changed / live_activity_update (silent wakes
  // are handled natively in AppDelegate; this covers when JS is already alive).
  await PushNotifications.addListener(
    "pushNotificationReceived",
    (notification) => {
      const data = notification.data as Record<string, unknown> | undefined;
      const reason = data?.reason;
      if (reason !== "feed_changed" && reason !== "live_activity_update") {
        return;
      }
      void (async () => {
        if (reason === "feed_changed") {
          await cancelAllDueNotifications();
        }
        // ReminderScheduler re-runs Live Activity sync from Convex queries.
        notifyRemindersChanged();
      })();
    }
  );
}

/**
 * Ensure APNs device token is registered for this village while timer or
 * notification delivery is on. Safe to call repeatedly from ReminderScheduler.
 *
 * Notification permission is required for the token; timer-mode users are
 * prompted once so cross-caregiver silent wakes can refresh Lock Screen timers.
 */
export async function syncDevicePushRegistration(opts: {
  enabled: boolean;
  secretLink: string;
  actingCaregiverName: string;
  upsert: UpsertDevicePushToken;
}): Promise<void> {
  if (!isNativePlatform()) return;
  if (!Capacitor.isPluginAvailable("PushNotifications")) return;

  lastContext = {
    secretLink: opts.secretLink,
    actingCaregiverName: opts.actingCaregiverName,
    upsert: opts.upsert,
    enabled: opts.enabled,
  };

  if (!opts.enabled) return;

  await ensureListeners();

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  await PushNotifications.register();
  if (lastToken) await upsertToken(lastToken);
}
