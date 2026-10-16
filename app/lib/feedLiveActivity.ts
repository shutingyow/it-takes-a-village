/**
 * Next-feed Live Activity / Dynamic Island countdown (iOS 16.2+).
 *
 * Native bridge: `FeedLiveActivityPlugin` registered from AppBridgeViewController.
 * Local notification milestones remain the fallback when Live Activities
 * are unsupported or disabled.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "@/app/lib/deviceNotifications";

interface FeedLiveActivityPlugin {
  areActivitiesSupported(): Promise<{ supported: boolean; reason?: string }>;
  startActivity(options: {
    title: string;
    subtitle: string;
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
}

const FeedLiveActivityNative = registerPlugin<FeedLiveActivityPlugin>(
  "FeedLiveActivity"
);

const ACTIVITY_STORAGE_KEY = "feedLiveActivityId";

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

export async function syncFeedLiveActivity(opts: {
  enabled: boolean;
  feedDueAt: number | null;
  title: string;
  /** e.g. "Next feed" */
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

  const dueAt = opts.feedDueAt;
  if (dueAt === null || dueAt <= Date.now() - 60_000) {
    await endFeedLiveActivity();
    return "skipped";
  }

  const payload = {
    title: opts.title,
    subtitle: opts.subtitle,
    dueAtMs: dueAt,
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
