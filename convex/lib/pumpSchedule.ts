export const DEFAULT_PUMP_TIMES = [
  "00:00",
  "04:00",
  "08:00",
  "12:00",
  "16:00",
  "20:00",
] as const;

export const DEFAULT_PUMP_AMOUNT_ML = 90;
export const DEFAULT_PUMP_TIMEZONE = "Asia/Singapore";

export type PumpReminderMode = "fixed" | "interval";

export type PumpSchedule = {
  enabled: boolean;
  times: string[];
  amountMl?: number;
  timezone?: string;
  mode?: PumpReminderMode;
  intervalHours?: number;
};

export const DEFAULT_PUMP_INTERVAL_HOURS = 4;

/**
 * Next pump due when using interval mode: lastPump + intervalHours.
 * Returns null if no last pump yet.
 */
export function computeIntervalPumpDueAt(
  lastPumpAt: number | undefined,
  intervalHours: number,
  now: number
): number | null {
  if (lastPumpAt === undefined) return null;
  const hours =
    Number.isFinite(intervalHours) && intervalHours >= 0.5
      ? intervalHours
      : DEFAULT_PUMP_INTERVAL_HOURS;
  const CLOCK_SKEW_MS = 2 * 60 * 1000;
  const pumpAt =
    lastPumpAt > now && lastPumpAt - now <= CLOCK_SKEW_MS ? now : lastPumpAt;
  return pumpAt + hours * 60 * 60 * 1000;
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function normalizePumpTimes(times: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of times) {
    const match = TIME_RE.exec(raw.trim());
    if (!match) continue;
    const hh = match[1]!.padStart(2, "0");
    const mm = match[2]!;
    const value = `${hh}:${mm}`;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  normalized.sort();
  return normalized;
}

function zonedParts(ms: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Convert a wall-clock time in `timeZone` to a UTC epoch ms. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(guess, timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess += desired - asUtc;
  }
  return guess;
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

export function enumeratePumpSlots(
  times: string[],
  timeZone: string,
  fromMs: number,
  dayCount: number
): number[] {
  const normalized = normalizePumpTimes(times);
  if (normalized.length === 0) return [];

  const start = zonedParts(fromMs, timeZone);
  const slots: number[] = [];

  for (let d = 0; d < dayCount; d++) {
    const date = addCalendarDays(start.year, start.month, start.day, d);
    for (const time of normalized) {
      const [hh, mm] = time.split(":").map(Number) as [number, number];
      const ts = zonedTimeToUtc(
        date.year,
        date.month,
        date.day,
        hh,
        mm,
        timeZone
      );
      slots.push(ts);
    }
  }

  return slots.sort((a, b) => a - b);
}

/**
 * Next pump due based on fixed daily slots + last logged pump.
 * If a scheduled slot has passed since the last pump, that slot is overdue.
 */
export function computeNextPumpDueAt(
  schedule: PumpSchedule,
  lastPumpAt: number | undefined,
  now: number
): number | null {
  const upcoming = listUpcomingPumpDueAts(schedule, lastPumpAt, now, 1);
  return upcoming[0] ?? null;
}

/**
 * Upcoming pump slots after the last log (includes one overdue slot if any),
 * limited to the next `maxCount` within roughly the next day + lookback.
 */
export function listUpcomingPumpDueAts(
  schedule: PumpSchedule,
  lastPumpAt: number | undefined,
  now: number,
  maxCount = 6
): number[] {
  if (!schedule.enabled) return [];
  const timeZone = schedule.timezone || DEFAULT_PUMP_TIMEZONE;
  const times = normalizePumpTimes(schedule.times);
  if (times.length === 0) return [];

  // Look back 1 day and ahead 2 days so overdue slots are visible.
  const lookbackStart = now - 24 * 60 * 60 * 1000;
  const slots = enumeratePumpSlots(times, timeZone, lookbackStart, 4);

  const afterLast = lastPumpAt
    ? slots.filter((ts) => ts > lastPumpAt)
    : slots;

  if (afterLast.length === 0) return [];

  const horizon = now + 24 * 60 * 60 * 1000;
  const result: number[] = [];

  // Prefer the earliest overdue/due slot, then future slots within 24h.
  const overdueOrDue = afterLast.find((ts) => ts <= now);
  if (overdueOrDue !== undefined) {
    result.push(overdueOrDue);
  }

  for (const ts of afterLast) {
    if (ts <= now) continue;
    if (ts > horizon) break;
    result.push(ts);
    if (result.length >= maxCount) break;
  }

  return result.slice(0, maxCount);
}
