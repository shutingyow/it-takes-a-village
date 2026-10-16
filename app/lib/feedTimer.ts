export type FeedTimerStatus = "idle" | "running" | "paused" | "stopped";

export type PersistedFeedTimer = {
  status: FeedTimerStatus;
  /** Completed segments in ms (while paused / before current run). */
  accumulatedMs: number;
  /** Wall-clock when the current running segment started. */
  segmentStartedAt: number | null;
  /** First Start press — used to stamp When. */
  feedStartedAt: number | null;
};

const IDLE: PersistedFeedTimer = {
  status: "idle",
  accumulatedMs: 0,
  segmentStartedAt: null,
  feedStartedAt: null,
};

export function feedTimerStorageKey(
  secretLink: string,
  editEntryId?: string
): string {
  return editEntryId
    ? `feedTimer:${secretLink}:edit:${editEntryId}`
    : `feedTimer:${secretLink}`;
}

export function loadFeedTimer(key: string): PersistedFeedTimer {
  if (typeof window === "undefined") return IDLE;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return IDLE;
    const parsed = JSON.parse(raw) as PersistedFeedTimer;
    if (
      parsed.status !== "idle" &&
      parsed.status !== "running" &&
      parsed.status !== "paused" &&
      parsed.status !== "stopped"
    ) {
      return IDLE;
    }
    return {
      status: parsed.status,
      accumulatedMs:
        typeof parsed.accumulatedMs === "number" && parsed.accumulatedMs >= 0
          ? parsed.accumulatedMs
          : 0,
      segmentStartedAt:
        typeof parsed.segmentStartedAt === "number"
          ? parsed.segmentStartedAt
          : null,
      feedStartedAt:
        typeof parsed.feedStartedAt === "number" ? parsed.feedStartedAt : null,
    };
  } catch {
    return IDLE;
  }
}

function notifyFeedTimerChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("feedTimerChanged"));
}

export function saveFeedTimer(key: string, state: PersistedFeedTimer): void {
  if (typeof window === "undefined") return;
  if (state.status === "idle") {
    sessionStorage.removeItem(key);
    notifyFeedTimerChanged();
    return;
  }
  sessionStorage.setItem(key, JSON.stringify(state));
  notifyFeedTimerChanged();
}

export function clearFeedTimer(key: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(key);
  notifyFeedTimerChanged();
}

/** True when a new-feed timer is actively recording (running or paused). */
export function isFeedTimerRecording(secretLink: string): boolean {
  const state = loadFeedTimer(feedTimerStorageKey(secretLink));
  return state.status === "running" || state.status === "paused";
}

export function elapsedMs(
  state: PersistedFeedTimer,
  now: number = Date.now()
): number {
  const running =
    state.status === "running" && state.segmentStartedAt != null
      ? Math.max(0, now - state.segmentStartedAt)
      : 0;
  return Math.max(0, state.accumulatedMs + running);
}

/**
 * Round elapsed time to whole minutes for the duration field.
 * Under 30s → blank (null). Otherwise nearest minute, at least 1.
 */
export function elapsedToDurationMinutes(ms: number): number | null {
  if (ms < 30_000) return null;
  return Math.max(1, Math.round(ms / 60_000));
}

/** Format as mm:ss or h:mm:ss. */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
