import { getTodayBoundsInZone } from "../../convex/lib/dayBounds";
import { formatAgeOnDate, type AgeLanguage } from "@/app/lib/babyAge";

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Future-dated entries (e.g. time picker set ahead) must not read as "just now"
  // — that made next-feed (~ last + 2.5h) look like a 3h interval.
  if (diff < 0) {
    const minsAhead = Math.ceil(-diff / (1000 * 60));
    if (minsAhead < 1) return "just now";
    if (minsAhead === 1) return "in 1m";
    if (minsAhead < 60) return `in ${minsAhead}m`;
    const hoursAhead = Math.floor(minsAhead / 60);
    const rem = minsAhead % 60;
    if (hoursAhead < 24) {
      return rem === 0 ? `in ${hoursAhead}h` : `in ${hoursAhead}h ${rem}m`;
    }
    return formatTime(timestamp);
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  // Keep hours+minutes so caregivers see more than "1h ago" / "2h ago".
  if (hours < 24) {
    const rem = minutes % 60;
    if (rem === 0) return hours === 1 ? "1h ago" : `${hours}h ago`;
    return hours === 1 ? `1h ${rem}m ago` : `${hours}h ${rem}m ago`;
  }
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

/** Whole minutes since `startedAt`, for “Ongoing for N minutes”. */
export function formatOngoingMinutes(startedAt: number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - startedAt) / 60_000));
}

export function formatDuration(start: number, end?: number): string {
  const duration = (end ?? Date.now()) - start;
  const minutes = Math.floor(duration / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) return `${minutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)}, ${formatTime(timestamp)}`;
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export {
  DEFAULT_TRACKER_TIMEZONE,
  formatDisplayDateInZone,
  getDateKeyInZone,
  getDayBoundsForDateKey,
  getTodayBoundsInZone,
  resolveTrackerTimezone,
  shiftDateKey,
} from "../../convex/lib/dayBounds";

/** Common IANA zones for the village timezone picker. */
export const VILLAGE_TIMEZONE_OPTIONS = [
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
] as const;

export function detectDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Singapore";
  } catch {
    return "Asia/Singapore";
  }
}

export function getTodayBounds(): { dayStart: number; dayEnd: number } {
  const { dayStart, dayEnd } = getTodayBoundsInZone();
  return { dayStart, dayEnd };
}

export function formatSleepTotal(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatHeaderDate(date: Date = new Date()): string {
  return date
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function formatBabyAge(
  birthDate: string,
  language: AgeLanguage = "en",
  now: Date = new Date()
): string | null {
  const onDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
  }).format(now);
  return formatAgeOnDate(birthDate, onDate, language);
}

/**
 * Format a duration in minutes as compact clock-style text.
 * Never rounds fractional hours (e.g. 150 → "2h 30m", not "3h").
 */
export function formatMinutesCompact(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Relative due estimate; keeps half-hours visible (2h 30m, not 3h). */
export function formatDueEstimate(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `~${abs} min`;
  return `~${formatMinutesCompact(abs)}`;
}

export function progressPercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

/**
 * Growth length/height and head circumference are stored in cm.
 * Legacy inch values (typical infant length < 35", HC < 25") are converted for display.
 */
export function toDisplayCm(
  value: number,
  kind: "length" | "head"
): number {
  const inchThreshold = kind === "length" ? 35 : 25;
  const cm = value < inchThreshold ? value * 2.54 : value;
  return Math.round(cm * 10) / 10;
}

export function formatGrowthLine(entry: {
  weight?: number;
  length?: number;
  headCircumference?: number;
}): string {
  const parts: string[] = [];
  if (entry.weight != null) parts.push(`${entry.weight} kg`);
  if (entry.length != null) {
    parts.push(`${toDisplayCm(entry.length, "length")} cm`);
  }
  if (entry.headCircumference != null) {
    parts.push(`HC ${toDisplayCm(entry.headCircumference, "head")} cm`);
  }
  return parts.join(" · ");
}
