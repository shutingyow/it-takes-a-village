import {
  elapsedMs as feedElapsedMs,
  formatElapsed,
  elapsedToDurationMinutes,
  type FeedTimerStatus,
  type PersistedFeedTimer,
} from "@/app/lib/feedTimer";

export type PumpTimerStatus = FeedTimerStatus;

/** Same segment shape as feed; `pumpStartedAt` stamps When after End. */
export type PersistedPumpTimer = {
  status: PumpTimerStatus;
  accumulatedMs: number;
  segmentStartedAt: number | null;
  pumpStartedAt: number | null;
};

const IDLE: PersistedPumpTimer = {
  status: "idle",
  accumulatedMs: 0,
  segmentStartedAt: null,
  pumpStartedAt: null,
};

export function pumpTimerStorageKey(
  secretLink: string,
  editEntryId?: string
): string {
  return editEntryId
    ? `pumpTimer:${secretLink}:edit:${editEntryId}`
    : `pumpTimer:${secretLink}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function asFeedShape(state: PersistedPumpTimer): PersistedFeedTimer {
  return {
    status: state.status,
    accumulatedMs: state.accumulatedMs,
    segmentStartedAt: state.segmentStartedAt,
    feedStartedAt: state.pumpStartedAt,
  };
}

export function loadPumpTimer(key: string): PersistedPumpTimer {
  if (typeof window === "undefined") return IDLE;
  try {
    const store = storage();
    const raw = store?.getItem(key);
    if (!raw) return IDLE;
    const parsed = JSON.parse(raw) as PersistedPumpTimer;
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
      pumpStartedAt:
        typeof parsed.pumpStartedAt === "number" ? parsed.pumpStartedAt : null,
    };
  } catch {
    return IDLE;
  }
}

function notifyPumpTimerChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("pumpTimerChanged"));
}

export function savePumpTimer(key: string, state: PersistedPumpTimer): void {
  if (typeof window === "undefined") return;
  const store = storage();
  if (state.status === "idle") {
    store?.removeItem(key);
    notifyPumpTimerChanged();
    return;
  }
  store?.setItem(key, JSON.stringify(state));
  notifyPumpTimerChanged();
}

export function clearPumpTimer(key: string): void {
  if (typeof window === "undefined") return;
  storage()?.removeItem(key);
  notifyPumpTimerChanged();
}

export function getActivePumpTimer(
  secretLink: string
): PersistedPumpTimer | null {
  const state = loadPumpTimer(pumpTimerStorageKey(secretLink));
  if (state.status === "running" || state.status === "paused") return state;
  return null;
}

export function isPumpTimerRecording(secretLink: string): boolean {
  const state = loadPumpTimer(pumpTimerStorageKey(secretLink));
  return state.status === "running" || state.status === "paused";
}

export function elapsedMs(
  state: PersistedPumpTimer,
  now: number = Date.now()
): number {
  return feedElapsedMs(asFeedShape(state), now);
}

export { formatElapsed, elapsedToDurationMinutes };
