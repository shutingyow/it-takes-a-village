/**
 * Live Activity → log modal deep links.
 *
 * Native widgetURL (ActivityKit):
 *   ittakesavillage://log/feed  — last-feed / feeding in progress
 *   ittakesavillage://log/pump  — last-pump
 *   ittakesavillage://log/sleep — awake-since / sleeping in progress (last-nap)
 *
 * Web routing uses `/tracker/<secret>?log=feed|pump|sleep` (sleep → SleepModal).
 */

export type LogDeepLinkPath = "feed" | "pump" | "sleep";

/** Tracker LogType for SleepModal is "nap". */
export type LogDeepLinkModal = "feed" | "pump" | "nap";

const PATH_TO_MODAL: Record<LogDeepLinkPath, LogDeepLinkModal> = {
  feed: "feed",
  pump: "pump",
  sleep: "nap",
};

const CUSTOM_SCHEME_PREFIX = "ittakesavillage://log/";

/** Parse a native custom-scheme or https `/log/…` URL into a path segment. */
export function parseLogDeepLink(url: string): LogDeepLinkPath | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let pathSeg: string | null = null;

  if (trimmed.toLowerCase().startsWith(CUSTOM_SCHEME_PREFIX)) {
    pathSeg = trimmed.slice(CUSTOM_SCHEME_PREFIX.length).split(/[?#]/)[0] ?? null;
  } else {
    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const logIdx = parts.findIndex((p) => p.toLowerCase() === "log");
      if (logIdx >= 0 && parts[logIdx + 1]) {
        pathSeg = parts[logIdx + 1];
      }
    } catch {
      return null;
    }
  }

  if (!pathSeg) return null;
  const key = pathSeg.toLowerCase() as LogDeepLinkPath;
  if (key === "feed" || key === "pump" || key === "sleep") return key;
  return null;
}

export function logDeepLinkToModal(path: LogDeepLinkPath): LogDeepLinkModal {
  return PATH_TO_MODAL[path];
}

/** Read `?log=` from a tracker URL / search string. */
export function parseLogQueryParam(
  search: string | URLSearchParams
): LogDeepLinkPath | null {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search
        )
      : search;
  const raw = params.get("log")?.toLowerCase();
  if (raw === "feed" || raw === "pump" || raw === "sleep") return raw;
  // Accept nap as alias for sleep (matches LogType)
  if (raw === "nap") return "sleep";
  return null;
}
