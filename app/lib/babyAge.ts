/**
 * Age on a Singapore calendar date. Computed, never stored per entry.
 * Under 12 weeks: weeks and days. After that: months and days.
 */
import {
  DEFAULT_TRACKER_TIMEZONE,
  getDayBoundsForDateKey,
  parseDateKey,
  shiftDateKey,
} from "../../convex/lib/dayBounds";

export type AgeLanguage = "en" | "zh";

export type AgeParts =
  | { kind: "weeks"; weeks: number; days: number }
  | { kind: "months"; months: number; days: number };

/** Non-overlapping bands for age-tailored guidance (calendar days from birth). */
export type AgeBandId =
  | "newborn"
  | "weeks_0_4"
  | "weeks_4_8"
  | "weeks_8_12"
  | "months_3_6"
  | "months_6_9"
  | "months_9_12"
  | "months_12_plus";

export function ageBandFromTotalDays(totalDays: number): AgeBandId {
  if (totalDays < 14) return "newborn"; // 0–2 weeks
  if (totalDays < 28) return "weeks_0_4"; // 2–4 weeks
  if (totalDays < 56) return "weeks_4_8";
  if (totalDays < 84) return "weeks_8_12";
  if (totalDays < 182) return "months_3_6"; // ~12 weeks – 6 months
  if (totalDays < 273) return "months_6_9";
  if (totalDays < 365) return "months_9_12";
  return "months_12_plus";
}

export function getAgeBand(
  birthDate: string,
  onDate: string
): AgeBandId | null {
  if (!isValidBirthDate(birthDate) || !isValidBirthDate(onDate)) return null;
  const totalDays = calendarDaysBetween(birthDate, onDate);
  if (totalDays < 0) return null;
  return ageBandFromTotalDays(totalDays);
}

const SOLIDS_BANDS: ReadonlySet<AgeBandId> = new Set([
  "months_6_9",
  "months_9_12",
  "months_12_plus",
]);

/** Solids logging from ~6 months. If birth date is unknown, allow logging. */
export function canLogSolids(
  birthDate: string | undefined,
  onDate?: string
): boolean {
  if (!birthDate || !isValidBirthDate(birthDate)) return true;
  const day =
    onDate && isValidBirthDate(onDate)
      ? onDate
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: DEFAULT_TRACKER_TIMEZONE,
        }).format(new Date());
  const band = getAgeBand(birthDate, day);
  return band != null && SOLIDS_BANDS.has(band);
}

/** Near 12 months, list Solids first in the feed type picker. */
export function solidsFirstInFeedPicker(
  birthDate: string | undefined,
  onDate?: string
): boolean {
  if (!birthDate || !isValidBirthDate(birthDate)) return false;
  const day =
    onDate && isValidBirthDate(onDate)
      ? onDate
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: DEFAULT_TRACKER_TIMEZONE,
        }).format(new Date());
  return getAgeBand(birthDate, day) === "months_12_plus";
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidBirthDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1990 || year > 2100) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/** Whole calendar days from `fromKey` to `toKey` (YYYY-MM-DD). Negative if to is earlier. */
export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const utcFrom = Date.UTC(from.year, from.month - 1, from.day);
  const utcTo = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((utcTo - utcFrom) / 86_400_000);
}

export function ageOnDate(birthDate: string, onDate: string): AgeParts | null {
  if (!isValidBirthDate(birthDate) || !isValidBirthDate(onDate)) return null;
  const totalDays = calendarDaysBetween(birthDate, onDate);
  if (totalDays < 0) return null;
  if (totalDays < 12 * 7) {
    return {
      kind: "weeks",
      weeks: Math.floor(totalDays / 7),
      days: totalDays % 7,
    };
  }

  const birth = parseDateKey(birthDate);
  const on = parseDateKey(onDate);
  let months = (on.year - birth.year) * 12 + (on.month - birth.month);
  let days = on.day - birth.day;
  if (days < 0) {
    months -= 1;
    const prevMonthLast = new Date(Date.UTC(on.year, on.month - 1, 0));
    days += prevMonthLast.getUTCDate();
  }
  if (months < 0) return null;
  return { kind: "months", months, days };
}

export function formatAgeParts(parts: AgeParts, language: AgeLanguage): string {
  if (parts.kind === "weeks") {
    return formatCount(parts.weeks, parts.days, language, "week");
  }
  return formatCount(parts.months, parts.days, language, "month");
}

function formatCount(
  big: number,
  days: number,
  language: AgeLanguage,
  unit: "week" | "month"
): string {
  if (language === "zh") {
    if (big === 0 && days === 0) return "出生日";
    if (big === 0) return `${days}天`;
    const unitLabel = unit === "week" ? "周" : "个月";
    if (days === 0) return `${big}${unitLabel}`;
    return `${big}${unitLabel}${days}天`;
  }

  if (big === 0 && days === 0) return "Birth day";
  if (big === 0) return days === 1 ? "1 day" : `${days} days`;
  const bigLabel =
    unit === "week"
      ? big === 1
        ? "1 week"
        : `${big} weeks`
      : big === 1
        ? "1 month"
        : `${big} months`;
  if (days === 0) return bigLabel;
  const dayLabel = days === 1 ? "1 day" : `${days} days`;
  return `${bigLabel} ${dayLabel}`;
}

export function formatAgeOnDate(
  birthDate: string,
  onDate: string,
  language: AgeLanguage
): string | null {
  const parts = ageOnDate(birthDate, onDate);
  if (!parts) return null;
  return formatAgeParts(parts, language);
}

export function formatInsightDate(dateKey: string, language: AgeLanguage): string {
  const { dayStart } = getDayBoundsForDateKey(dateKey, DEFAULT_TRACKER_TIMEZONE);
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", {
    timeZone: DEFAULT_TRACKER_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dayStart));
}

function formatInsightDateShort(dateKey: string, language: AgeLanguage): string {
  if (language === "zh") {
    const { month, day } = parseDateKey(dateKey);
    return `${month}月${day}日`;
  }
  const { dayStart } = getDayBoundsForDateKey(dateKey, DEFAULT_TRACKER_TIMEZONE);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_TRACKER_TIMEZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(dayStart));
}

export function formatInsightRange(
  startKey: string,
  endKey: string,
  language: AgeLanguage
): string {
  const endLabel = formatInsightDate(endKey, language);
  if (startKey.slice(0, 4) === endKey.slice(0, 4)) {
    return `${formatInsightDateShort(startKey, language)} – ${endLabel}`;
  }
  return `${formatInsightDate(startKey, language)} – ${endLabel}`;
}

/** True when the inclusive range contains the birth day or a later anniversary. */
export function rangeCrossesBirthday(
  birthDate: string,
  startKey: string,
  endKey: string
): boolean {
  if (!isValidBirthDate(birthDate)) return false;
  const birth = parseDateKey(birthDate);
  let cursor = startKey;
  for (let i = 0; i < 14; i++) {
    const current = parseDateKey(cursor);
    if (
      current.month === birth.month &&
      current.day === birth.day &&
      cursor >= birthDate
    ) {
      return true;
    }
    if (cursor >= endKey) break;
    cursor = shiftDateKey(cursor, 1);
  }
  return false;
}

/** Week range plus age at the last day, or a start–end span on a birthday week. */
export function formatWeekAgeLine(
  birthDate: string | undefined,
  startKey: string,
  endKey: string,
  language: AgeLanguage
): string {
  const range = formatInsightRange(startKey, endKey, language);
  if (!birthDate) return range;
  const endAge = formatAgeOnDate(birthDate, endKey, language);
  if (!endAge) return range;
  if (rangeCrossesBirthday(birthDate, startKey, endKey)) {
    const startAge = formatAgeOnDate(birthDate, startKey, language);
    if (startAge && startAge !== endAge) {
      const span =
        language === "zh" ? `${startAge}至${endAge}` : `${startAge} to ${endAge}`;
      return `${range} · ${span}`;
    }
  }
  return `${range} · ${endAge}`;
}
