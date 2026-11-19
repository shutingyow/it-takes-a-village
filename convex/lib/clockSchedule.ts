/**
 * Shared wall-clock reminder slots (feed / nap / pump timetable mode).
 * Times are HH:mm in the village timezone.
 * Self-contained (no imports from pumpSchedule/dayBounds) to avoid cycles.
 */

export type ReminderMode = "interval" | "schedule";

export type ScheduleSlotKind = "feed" | "nap" | "pump";

export type ScheduleSlotPeriod = "day" | "night";

export type ScheduleSlot = {
  id: string;
  kind: ScheduleSlotKind;
  time: string;
  endTime?: string;
  period?: ScheduleSlotPeriod;
  note?: string;
};

export type ReminderSchedule = {
  slots: ScheduleSlot[];
};

export const DEFAULT_SCHEDULE_SLOTS: ScheduleSlot[] = [
  { id: "feed-0700", kind: "feed", time: "07:00", period: "day" },
  { id: "nap-0830", kind: "nap", time: "08:30", endTime: "09:30", period: "day" },
  { id: "feed-0945", kind: "feed", time: "09:45", period: "day" },
  { id: "nap-1100", kind: "nap", time: "11:00", endTime: "12:30", period: "day" },
  { id: "feed-1245", kind: "feed", time: "12:45", period: "day" },
  { id: "nap-1415", kind: "nap", time: "14:15", endTime: "15:30", period: "day" },
  { id: "feed-1545", kind: "feed", time: "15:45", period: "day" },
  { id: "nap-1715", kind: "nap", time: "17:15", endTime: "17:45", period: "day" },
  { id: "feed-1915", kind: "feed", time: "19:15", period: "day" },
  { id: "feed-2230", kind: "feed", time: "22:30", period: "night" },
  { id: "pump-0800", kind: "pump", time: "08:00", period: "day" },
  { id: "pump-1200", kind: "pump", time: "12:00", period: "day" },
  { id: "pump-1600", kind: "pump", time: "16:00", period: "day" },
  { id: "pump-2000", kind: "pump", time: "20:00", period: "day" },
];

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function normalizeHhMm(value: string): string | null {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  return `${match[1]!.padStart(2, "0")}:${match[2]!}`;
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

function zonedTimeToUtcLocal(
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

export function normalizeClockTimes(times: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of times) {
    const match = TIME_RE.exec(raw.trim());
    if (!match) continue;
    const value = `${match[1]!.padStart(2, "0")}:${match[2]!}`;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  normalized.sort();
  return normalized;
}

export function enumerateClockSlots(
  times: string[],
  timeZone: string,
  fromMs: number,
  dayCount: number
): number[] {
  const normalized = normalizeClockTimes(times);
  if (normalized.length === 0) return [];
  const start = zonedParts(fromMs, timeZone);
  const slots: number[] = [];
  for (let d = 0; d < dayCount; d++) {
    const date = addCalendarDays(start.year, start.month, start.day, d);
    for (const time of normalized) {
      const [hh, mm] = time.split(":").map(Number) as [number, number];
      slots.push(
        zonedTimeToUtcLocal(date.year, date.month, date.day, hh, mm, timeZone)
      );
    }
  }
  return slots.sort((a, b) => a - b);
}

export function listUpcomingClockDueAts(
  times: string[],
  timeZone: string,
  lastAt: number | undefined,
  now: number,
  maxCount = 6
): number[] {
  const normalized = normalizeClockTimes(times);
  if (normalized.length === 0) return [];
  const lookbackStart = now - 24 * 60 * 60 * 1000;
  const slots = enumerateClockSlots(normalized, timeZone, lookbackStart, 4);
  const afterLast = lastAt ? slots.filter((ts) => ts > lastAt) : slots;
  if (afterLast.length === 0) return [];
  const horizon = now + 24 * 60 * 60 * 1000;
  const result: number[] = [];
  const overdueOrDue = afterLast.find((ts) => ts <= now);
  if (overdueOrDue !== undefined) result.push(overdueOrDue);
  for (const ts of afterLast) {
    if (ts <= now) continue;
    if (ts > horizon) break;
    result.push(ts);
    if (result.length >= maxCount) break;
  }
  return result.slice(0, maxCount);
}

export function computeNextClockDueAt(
  times: string[],
  timeZone: string,
  lastAt: number | undefined,
  now: number
): number | null {
  return listUpcomingClockDueAts(times, timeZone, lastAt, now, 1)[0] ?? null;
}

export function timesForKind(
  slots: ScheduleSlot[] | undefined,
  kind: ScheduleSlotKind
): string[] {
  if (!slots?.length) return [];
  return normalizeClockTimes(
    slots.filter((slot) => slot.kind === kind).map((slot) => slot.time)
  );
}

export function normalizeReminderSchedule(
  schedule: ReminderSchedule | undefined
): ReminderSchedule {
  if (!schedule?.slots?.length) {
    return { slots: DEFAULT_SCHEDULE_SLOTS.map((s) => ({ ...s })) };
  }
  const slots: ScheduleSlot[] = [];
  const seenIds = new Set<string>();
  for (const raw of schedule.slots) {
    const time = normalizeHhMm(raw.time);
    if (!time) continue;
    const kind = raw.kind;
    if (kind !== "feed" && kind !== "nap" && kind !== "pump") continue;
    let endTime: string | undefined;
    if (raw.endTime) {
      const end = normalizeHhMm(raw.endTime);
      if (end) endTime = end;
    }
    const period =
      raw.period === "day" || raw.period === "night" ? raw.period : undefined;
    const note =
      typeof raw.note === "string" && raw.note.trim()
        ? raw.note.trim().slice(0, 80)
        : undefined;
    let id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim().slice(0, 64)
        : `${kind}-${time}`;
    if (seenIds.has(id)) id = `${id}-${slots.length}`;
    seenIds.add(id);
    slots.push({
      id,
      kind,
      time,
      ...(endTime ? { endTime } : {}),
      ...(period ? { period } : {}),
      ...(note ? { note } : {}),
    });
  }
  slots.sort((a, b) => {
    const periodRank = (p?: ScheduleSlotPeriod) => (p === "night" ? 1 : 0);
    const pr = periodRank(a.period) - periodRank(b.period);
    if (pr !== 0) return pr;
    return a.time.localeCompare(b.time) || a.kind.localeCompare(b.kind);
  });
  return { slots: slots.slice(0, 48) };
}

export function resolveReminderMode(
  mode: ReminderMode | undefined
): ReminderMode {
  return mode === "schedule" ? "schedule" : "interval";
}
