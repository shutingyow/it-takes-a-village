import { getTodayBoundsInZone } from "../../convex/lib/dayBounds";

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
    return formatTime(timestamp);
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours === 1) return "1h ago";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1d ago";
  return `${days}d ago`;
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
  shiftDateKey,
} from "../../convex/lib/dayBounds";

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
  now: Date = new Date()
): string | null {
  const parts = birthDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;

  const [year, month, day] = parts as [number, number, number];
  const birth = new Date(year, month - 1, day);
  if (birth > now) return null;

  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) return null;

  const monthLabel = months === 1 ? "month" : "months";
  const dayLabel = days === 1 ? "day" : "days";
  return `${months} ${monthLabel} · ${days} ${dayLabel}`;
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
