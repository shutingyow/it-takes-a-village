/**
 * Lock-screen Live Activities: time since last feed / pump / nap (iOS 16.2+).
 *
 * Native bridge: `FeedLiveActivityPlugin` registered from AppBridgeViewController.
 * Passes lastAtMs — iOS Text(..., .timer) counts *up* from a past date.
 * Push tokens are registered with Convex for cross-caregiver APNs updates (feed).
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "@/app/lib/deviceNotifications";

export type LiveActivityKind = "last-feed" | "last-pump" | "last-nap";

interface FeedLiveActivityPlugin {
  areActivitiesSupported(): Promise<{ supported: boolean; reason?: string }>;
  startActivity(options: {
    kind: LiveActivityKind;
    title: string;
    subtitle: string;
    /** Epoch ms of last event — timer counts up from this. */
    dueAtMs: number;
  }): Promise<{ activityId: string }>;
  updateActivity(options: {
    kind: LiveActivityKind;
    activityId?: string;
    title: string;
    subtitle: string;
    dueAtMs: number;
  }): Promise<{ activityId: string }>;
  endActivity(options?: {
    kind?: LiveActivityKind;
    activityId?: string;
  }): Promise<void>;
  endAll(): Promise<void>;
  addListener?(
    eventName: "liveActivityPushToken",
    listenerFunc: (data: {
      activityId: string;
      pushToken: string;
      kind?: string;
    }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const FeedLiveActivityNative = registerPlugin<FeedLiveActivityPlugin>(
  "FeedLiveActivity"
);

const STORAGE_KEYS: Record<LiveActivityKind, string> = {
  "last-feed": "feedLiveActivityId",
  "last-pump": "pumpLiveActivityId",
  "last-nap": "napLiveActivityId",
};

const PREF_KEYS: Record<LiveActivityKind, string> = {
  "last-feed": "liveActivityFeedEnabled",
  "last-pump": "liveActivityPumpEnabled",
  "last-nap": "liveActivityNapEnabled",
};

const DEVICE_ID_KEY = "ittavDeviceId";

function readStoredId(kind: LiveActivityKind): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEYS[kind]);
  } catch {
    return null;
  }
}

function writeStoredId(kind: LiveActivityKind, id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(STORAGE_KEYS[kind], id);
    else localStorage.removeItem(STORAGE_KEYS[kind]);
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

/** Feed defaults on (matches prior behavior); pump/nap opt-in. */
export function getLiveActivityKindEnabled(kind: LiveActivityKind): boolean {
  if (typeof window === "undefined") return kind === "last-feed";
  try {
    const raw = localStorage.getItem(PREF_KEYS[kind]);
    if (raw === null) return kind === "last-feed";
    return raw === "1";
  } catch {
    return kind === "last-feed";
  }
}

export function setLiveActivityKindEnabled(
  kind: LiveActivityKind,
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREF_KEYS[kind], enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

type PushTokenHandler = (data: {
  activityId: string;
  pushToken: string;
  kind?: string;
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

export async function syncLiveActivity(opts: {
  kind: LiveActivityKind;
  enabled: boolean;
  /** Timestamp of the last event (feed / pump / nap end). */
  lastAt: number | null;
  title: string;
  subtitle: string;
}): Promise<"live" | "unsupported" | "skipped" | "error"> {
  if (!isNativePlatform() || !opts.enabled) {
    await endLiveActivity(opts.kind);
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
      await endLiveActivity(opts.kind);
      return "unsupported";
    }
  } catch (err) {
    console.warn("Live Activities support check failed", err);
    return "unsupported";
  }

  const lastAt = opts.lastAt;
  if (lastAt === null || lastAt > Date.now() + 60_000) {
    await endLiveActivity(opts.kind);
    return "skipped";
  }

  const payload = {
    kind: opts.kind,
    title: opts.title,
    subtitle: opts.subtitle,
    dueAtMs: lastAt,
  };

  const existing = readStoredId(opts.kind);

  try {
    if (existing) {
      try {
        const { activityId } = await FeedLiveActivityNative.updateActivity({
          activityId: existing,
          ...payload,
        });
        writeStoredId(opts.kind, activityId || existing);
        return "live";
      } catch {
        writeStoredId(opts.kind, null);
      }
    }

    const { activityId } = await FeedLiveActivityNative.startActivity(payload);
    writeStoredId(opts.kind, activityId);
    return "live";
  } catch (err) {
    console.warn("Live Activity unavailable", opts.kind, err);
    writeStoredId(opts.kind, null);
    return "error";
  }
}

/** @deprecated Prefer syncLiveActivity({ kind: "last-feed", ... }) */
export async function syncFeedLiveActivity(opts: {
  enabled: boolean;
  lastFeedAt: number | null;
  title: string;
  subtitle: string;
}): Promise<"live" | "unsupported" | "skipped" | "error"> {
  return syncLiveActivity({
    kind: "last-feed",
    enabled: opts.enabled,
    lastAt: opts.lastFeedAt,
    title: opts.title,
    subtitle: opts.subtitle,
  });
}

export async function endLiveActivity(kind: LiveActivityKind): Promise<void> {
  const id = readStoredId(kind);
  try {
    if (isNativePlatform() && Capacitor.isPluginAvailable("FeedLiveActivity")) {
      await FeedLiveActivityNative.endActivity({
        kind,
        activityId: id ?? undefined,
      });
    }
  } catch {
    // ignore
  } finally {
    writeStoredId(kind, null);
  }
}

export async function endFeedLiveActivity(): Promise<void> {
  await endLiveActivity("last-feed");
}

export async function endAllLiveActivities(): Promise<void> {
  try {
    if (isNativePlatform() && Capacitor.isPluginAvailable("FeedLiveActivity")) {
      await FeedLiveActivityNative.endAll();
    }
  } catch {
    // ignore
  } finally {
    writeStoredId("last-feed", null);
    writeStoredId("last-pump", null);
    writeStoredId("last-nap", null);
  }
}
