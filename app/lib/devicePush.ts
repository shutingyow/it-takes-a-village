/**
 * Register the device APNs token so Convex can silent-wake the app when
 * another caregiver logs a feed — native code then cancels stale local
 * notifications (see AppDelegate).
 */

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getOrCreateDeviceId } from "@/app/lib/feedLiveActivity";
import {
  cancelAllDueNotifications,
  getDeviceRemindersEnabled,
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
} | null = null;

function notifyRemindersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("deviceRemindersChanged"));
}

async function upsertToken(token: string): Promise<void> {
  lastToken = token;
  const ctx = lastContext;
  if (!ctx || !getDeviceRemindersEnabled()) return;
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

  // Foreground delivery of feed_changed (silent wakes are handled natively
  // in AppDelegate; this covers when JS is already alive).
  await PushNotifications.addListener(
    "pushNotificationReceived",
    (notification) => {
      const data = notification.data as Record<string, unknown> | undefined;
      if (data?.reason !== "feed_changed") return;
      void (async () => {
        await cancelAllDueNotifications();
        notifyRemindersChanged();
      })();
    }
  );
}

/**
 * Ensure APNs device token is registered for this village while reminders
 * are opted in. Safe to call repeatedly from ReminderScheduler.
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
