/**
 * Lock-screen Live Activity: time since last feed (iOS 16.2+).
 *
 * Native bridge: `FeedLiveActivityPlugin` registered from AppBridgeViewController.
 * Passes lastFeedAtMs — iOS Text(..., .timer) counts *up* from a past date.
 * Push tokens are registered with Convex for cross-caregiver APNs updates.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "@/app/lib/deviceNotifications";

interface FeedLiveActivityPlugin {
  areActivitiesSupported(): Promise<{ supported: boolean; reason?: string }>;
  startActivity(options: {
    title: string;
    subtitle: string;
    /** Epoch ms of last feed — timer counts up from this. */
    dueAtMs: number;
  }): Promise<{ activityId: string }>;
  updateActivity(options: {
    activityId?: string;
    title: string;
    subtitle: string;
    dueAtMs: number;
  }): Promise<{ activityId: string }>;
  endActivity(options?: { activityId?: string }): Promise<void>;
  endAll(): Promise<void>;
  addListener?(
    eventName: "liveActivityPushToken",
    listenerFunc: (data: { activityId: string; pushToken: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const FeedLiveActivityNative = registerPlugin<FeedLiveActivityPlugin>(
  "FeedLiveActivity"
);

const ACTIVITY_STORAGE_KEY = "feedLiveActivityId";
const DEVICE_ID_KEY = "ittavDeviceId";

function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVITY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVITY_STORAGE_KEY, id);
    else localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
}

type PushTokenHandler = (data: {
  activityId: string;
  pushToken: string;
}) => void;

let pushTokenHandler: PushTokenHandler | null = null;
let listenerAttached = false;

/** Register callback for ActivityKit push tokens (Convex registration). */
export function setLiveActivityPushTokenHandler(
  handler: PushTokenHandler | null
): void {
  pushTokenHandler = handler;
}

async function ensurePushTokenListener(): Promise<void> {
  if (listenerAttached || !isNativePlatform()) return;
  if (!Capacitor.isPluginAvailable("FeedLiveActivity")) return;
  if (typeof FeedLiveActivityNative.addListener !== "function") return;
  listenerAttached = true;
  try {
    await FeedLiveActivityNative.addListener(
      "liveActivityPushToken",
      (data) => {
        pushTokenHandler?.(data);
      }
    );
  } catch (err) {
    console.warn("Live Activity push token listener failed", err);
    listenerAttached = false;
  }
}

export async function syncFeedLiveActivity(opts: {
  enabled: boolean;
  /** Timestamp of the last milk feed. */
  lastFeedAt: number | null;
  title: string;
  subtitle: string;
}): Promise<"live" | "unsupported" | "skipped" | "error"> {
  if (!isNativePlatform() || !opts.enabled) {
    await endFeedLiveActivity();
    return "skipped";
  }

  if (!Capacitor.isPluginAvailable("FeedLiveActivity")) {
    console.warn(
      "FeedLiveActivity plugin not available — rebuild the iOS app from Xcode"
    );
    return "unsupported";
  }

  await ensurePushTokenListener();

  try {
    const { supported, reason } =
      await FeedLiveActivityNative.areActivitiesSupported();
    if (!supported) {
      console.warn("Live Activities unsupported:", reason);
      await endFeedLiveActivity();
      return "unsupported";
    }
  } catch (err) {
    console.warn("Live Activities support check failed", err);
    return "unsupported";
  }

  const lastFeedAt = opts.lastFeedAt;
  if (lastFeedAt === null || lastFeedAt > Date.now() + 60_000) {
    await endFeedLiveActivity();
    return "skipped";
  }

  const payload = {
    title: opts.title,
    subtitle: opts.subtitle,
    dueAtMs: lastFeedAt,
  };

  const existing = readStoredId();

  try {
    if (existing) {
      try {
        const { activityId } = await FeedLiveActivityNative.updateActivity({
          activityId: existing,
          ...payload,
        });
        writeStoredId(activityId || existing);
        return "live";
      } catch {
        writeStoredId(null);
      }
    }

    const { activityId } = await FeedLiveActivityNative.startActivity(payload);
    writeStoredId(activityId);
    return "live";
  } catch (err) {
    console.warn("Feed Live Activity unavailable", err);
    writeStoredId(null);
    return "error";
  }
}

export async function endFeedLiveActivity(): Promise<void> {
  const id = readStoredId();
  try {
    if (isNativePlatform() && Capacitor.isPluginAvailable("FeedLiveActivity")) {
      if (id) {
        await FeedLiveActivityNative.endActivity({ activityId: id });
      } else {
        await FeedLiveActivityNative.endAll();
      }
    }
  } catch {
    // ignore
  } finally {
    writeStoredId(null);
  }
}
