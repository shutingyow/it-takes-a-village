/**
 * Day boundary for summaries and Insights/Stats.
 *
 * One day = one calendar day in the village timezone:
 *   start inclusive: 00:00:00.000 local
 *   end exclusive:   next day 00:00:00.000 local
 *
 * Not a rolling 24h window. Not browser-local and not UTC midnight
 * (Convex runtimes are UTC; using Date#getHours locally would be wrong).
 * Prefer `trackers.timezone`; fall back to DEFAULT_TRACKER_TIMEZONE.
 */
import { zonedTimeToUtc } from "./pumpSchedule";

/** Fallback when a village has no timezone set (legacy trackers). */
export const DEFAULT_TRACKER_TIMEZONE = "Asia/Singapore";

export function resolveTrackerTimezone(tracker: {
  timezone?: string;
  pumpSchedule?: { timezone?: string };
} | null | undefined): string {
  const fromTracker = tracker?.timezone?.trim();
  if (fromTracker) return fromTracker;
  const fromPump = tracker?.pumpSchedule?.timezone?.trim();
  if (fromPump) return fromPump;
  return DEFAULT_TRACKER_TIMEZONE;
}

function zonedYmd(
  ms: number,
  timeZone: string
): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateKey(
  year: number,
  month: number,
  day: number
): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getDateKeyInZone(
  ms: number,
  timeZone: string = DEFAULT_TRACKER_TIMEZONE
): string {
  const { year, month, day } = zonedYmd(ms, timeZone);
  return formatDateKey(year, month, day);
}

export function parseDateKey(dateKey: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (
    year == null ||
    month == null ||
    day == null ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return { year, month, day };
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const next = addCalendarDays(year, month, day, deltaDays);
  return formatDateKey(next.year, next.month, next.day);
}

/** Inclusive start / exclusive end for one calendar day in the given zone. */
export function getDayBoundsForDateKey(
  dateKey: string,
  timeZone: string = DEFAULT_TRACKER_TIMEZONE
): { dayStart: number; dayEnd: number } {
  const { year, month, day } = parseDateKey(dateKey);
  const dayStart = zonedTimeToUtc(year, month, day, 0, 0, timeZone);
  const next = addCalendarDays(year, month, day, 1);
  const dayEnd = zonedTimeToUtc(
    next.year,
    next.month,
    next.day,
    0,
    0,
    timeZone
  );
  return { dayStart, dayEnd };
}

export function getTodayBoundsInZone(
  nowMs: number = Date.now(),
  timeZone: string = DEFAULT_TRACKER_TIMEZONE
): { dayStart: number; dayEnd: number; dateKey: string } {
  const dateKey = getDateKeyInZone(nowMs, timeZone);
  const { dayStart, dayEnd } = getDayBoundsForDateKey(dateKey, timeZone);
  return { dayStart, dayEnd, dateKey };
}

export function formatWeekdayShortInZone(
  ms: number,
  timeZone: string = DEFAULT_TRACKER_TIMEZONE,
  locale: string = "en-US"
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
  }).format(new Date(ms));
}

export function formatDisplayDateInZone(
  dateKey: string,
  timeZone: string = DEFAULT_TRACKER_TIMEZONE,
  locale: string = "en-US"
): string {
  const { dayStart } = getDayBoundsForDateKey(dateKey, timeZone);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(dayStart));
}
