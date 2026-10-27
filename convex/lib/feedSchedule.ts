/**
 * Next-feed due time from last feed + day/night interval.
 * Night window uses Asia/Singapore by default (same as day bounds / pump).
 */

import { DEFAULT_TRACKER_TIMEZONE } from "./dayBounds";

export const DEFAULT_FEED_INTERVAL_HOURS = 2.5;
export const DEFAULT_NIGHT_FEED_INTERVAL_HOURS = 4;
export const DEFAULT_NIGHT_FEED_START = "22:00";
export const DEFAULT_NIGHT_FEED_END = "07:00";
/** Grace past expected due before a feed counts as "late". */
export const LATE_FEED_GRACE_MINUTES = 10;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export type NightFeedSettings = {
  /** When true (default), feeds logged in the night window use the longer interval. */
  enabled: boolean;
  intervalHours: number;
  /** Local HH:mm start (inclusive), e.g. "22:00". */
  start: string;
  /** Local HH:mm end (exclusive), e.g. "07:00". May be next calendar morning. */
  end: string;
};

export const DEFAULT_NIGHT_FEED_SETTINGS: NightFeedSettings = {
  enabled: true,
  intervalHours: DEFAULT_NIGHT_FEED_INTERVAL_HOURS,
  start: DEFAULT_NIGHT_FEED_START,
  end: DEFAULT_NIGHT_FEED_END,
};

export function parseHhMm(value: string): { hour: number; minute: number } | null {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function normalizeHhMm(value: string): string | null {
  const parsed = parseHhMm(value);
  if (!parsed) return null;
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function zonedHourMinute(
  ms: number,
  timeZone: string
): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { hour: get("hour"), minute: get("minute") };
}

/**
 * Night window may wrap midnight (22:00–07:00).
 * Start inclusive, end exclusive in local minutes-of-day.
 */
export function isLocalTimeInNightWindow(
  ms: number,
  startHhMm: string,
  endHhMm: string,
  timeZone: string = DEFAULT_TRACKER_TIMEZONE
): boolean {
  const start = parseHhMm(startHhMm);
  const end = parseHhMm(endHhMm);
  if (!start || !end) return false;

  const { hour, minute } = zonedHourMinute(ms, timeZone);
  const nowMins = minutesOfDay(hour, minute);
  const startMins = minutesOfDay(start.hour, start.minute);
  const endMins = minutesOfDay(end.hour, end.minute);

  if (startMins === endMins) return false;
  if (startMins < endMins) {
    return nowMins >= startMins && nowMins < endMins;
  }
  // Wraps midnight: e.g. 22:00–07:00
  return nowMins >= startMins || nowMins < endMins;
}

export function resolveNightFeedSettings(partial?: {
  nightFeedIntervalEnabled?: boolean;
  nightFeedIntervalHours?: number;
  nightFeedWindowStart?: string;
  nightFeedWindowEnd?: string;
}): NightFeedSettings {
  const start =
    normalizeHhMm(partial?.nightFeedWindowStart ?? "") ??
    DEFAULT_NIGHT_FEED_SETTINGS.start;
  const end =
    normalizeHhMm(partial?.nightFeedWindowEnd ?? "") ??
    DEFAULT_NIGHT_FEED_SETTINGS.end;
  const intervalHours =
    typeof partial?.nightFeedIntervalHours === "number" &&
    Number.isFinite(partial.nightFeedIntervalHours)
      ? Math.min(24, Math.max(0.5, partial.nightFeedIntervalHours))
      : DEFAULT_NIGHT_FEED_SETTINGS.intervalHours;
  return {
    enabled: partial?.nightFeedIntervalEnabled ?? DEFAULT_NIGHT_FEED_SETTINGS.enabled,
    intervalHours,
    start,
    end,
  };
}

/**
 * Effective interval for a feed logged at `feedAt`.
 * Night window → max(day, night) so overnight is never shorter than daytime.
 */
export function effectiveFeedIntervalHours(
  feedAt: number,
  dayIntervalHours: number,
  night: NightFeedSettings,
  timeZone: string = DEFAULT_TRACKER_TIMEZONE
): number {
  const day =
    Number.isFinite(dayIntervalHours) && dayIntervalHours >= 0.5
      ? dayIntervalHours
      : DEFAULT_FEED_INTERVAL_HOURS;
  if (!night.enabled) return day;
  if (!isLocalTimeInNightWindow(feedAt, night.start, night.end, timeZone)) {
    return day;
  }
  return Math.max(day, night.intervalHours);
}

export function clampFeedAtForSkew(feedAt: number, now: number): number {
  const CLOCK_SKEW_MS = 2 * 60 * 1000;
  if (feedAt > now && feedAt - now <= CLOCK_SKEW_MS) return now;
  return feedAt;
}

export function computeFeedDueAt(
  lastFeedAt: number,
  dayIntervalHours: number,
  night: NightFeedSettings,
  opts?: { now?: number; timeZone?: string }
): number {
  const now = opts?.now ?? Date.now();
  const timeZone = opts?.timeZone ?? DEFAULT_TRACKER_TIMEZONE;
  const feedAt = clampFeedAtForSkew(lastFeedAt, now);
  const hours = effectiveFeedIntervalHours(
    feedAt,
    dayIntervalHours,
    night,
    timeZone
  );
  return feedAt + hours * 60 * 60 * 1000;
}

/** True when this feed landed after the previous feed's due (+ grace). */
export function isLateFeed(opts: {
  previousFeedAt: number;
  thisFeedAt: number;
  dayIntervalHours: number;
  night: NightFeedSettings;
  graceMinutes?: number;
  timeZone?: string;
}): boolean {
  const dueAt = computeFeedDueAt(
    opts.previousFeedAt,
    opts.dayIntervalHours,
    opts.night,
    { now: opts.thisFeedAt, timeZone: opts.timeZone }
  );
  const grace =
    (opts.graceMinutes ?? LATE_FEED_GRACE_MINUTES) * 60 * 1000;
  return opts.thisFeedAt > dueAt + grace;
}
