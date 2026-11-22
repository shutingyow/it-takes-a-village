/**
 * Shared wall-clock reminder slots (timetable mode).
 * Times are HH:mm in the village timezone.
 * Self-contained (no imports from pumpSchedule/dayBounds) to avoid cycles.
 *
 * Slots are freeform for display (time + activity label + notes).
 * Optional `kind` soft-links a row to feed/nap/pump for What's due.
 */

export type ReminderMode = "interval" | "schedule";

export type ScheduleSlotKind = "feed" | "nap" | "pump";

/** Kept for stored legacy rows; UI no longer splits day/night. */
export type ScheduleSlotPeriod = "day" | "night";

export type ScheduleSlot = {
  id: string;
  time: string;
  /** Free-text activity name. Optional on legacy rows that only had kind. */
  label?: string;
  note?: string;
  endTime?: string;
  /**
   * Soft link for What's due / notifications.
   * Unset = display-only (don't remind).
   */
  kind?: ScheduleSlotKind;
  /** @deprecated stored legacy only; not used in the editor */
  period?: ScheduleSlotPeriod;
};

export type ReminderSchedule = {
  slots: ScheduleSlot[];
};

/** Empty by default — caregivers build their own list. */
export const DEFAULT_SCHEDULE_SLOTS: ScheduleSlot[] = [];

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

/**
 * Next guide clock times after the last log.
 * Skips past slots — the shared schedule is a guide following baby cues, so
 * What's due advances to the next upcoming window instead of labeling a
 * missed clock time as "overdue". Interval delivery (lock screen) is separate.
 */
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

function parseKind(raw: unknown): ScheduleSlotKind | undefined {
  if (raw === "feed" || raw === "nap" || raw === "pump") return raw;
  return undefined;
}

/** Loose input shape for stored / client schedules (legacy rows may omit label). */
export type RawReminderSchedule = {
  slots: Array<{
    id?: string;
    time?: string;
    label?: string;
    kind?: string;
    note?: string;
    endTime?: string;
    period?: string;
  }>;
};

export function normalizeReminderSchedule(
  schedule: ReminderSchedule | RawReminderSchedule | undefined
): ReminderSchedule {
  if (!schedule?.slots?.length) {
    return { slots: [] };
  }
  const slots: ScheduleSlot[] = [];
  const seenIds = new Set<string>();
  for (const raw of schedule.slots) {
    const time = typeof raw.time === "string" ? normalizeHhMm(raw.time) : null;
    if (!time) continue;
    const kind = parseKind(raw.kind);
    const label =
      typeof raw.label === "string" && raw.label.trim()
        ? raw.label.trim().slice(0, 80)
        : "";
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
        : `slot-${time}-${slots.length}`;
    if (seenIds.has(id)) id = `${id}-${slots.length}`;
    seenIds.add(id);
    slots.push({
      id,
      time,
      ...(label ? { label } : {}),
      ...(kind ? { kind } : {}),
      ...(endTime ? { endTime } : {}),
      ...(period ? { period } : {}),
      ...(note ? { note } : {}),
    });
  }
  slots.sort(
    (a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id)
  );
  return { slots: slots.slice(0, 48) };
}

export function resolveReminderMode(
  mode: ReminderMode | undefined
): ReminderMode {
  return mode === "schedule" ? "schedule" : "interval";
}
