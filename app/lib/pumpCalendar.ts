import {
  DEFAULT_PUMP_AMOUNT_ML,
  DEFAULT_PUMP_TIMEZONE,
  DEFAULT_PUMP_TIMES,
  enumeratePumpSlots,
  normalizePumpTimes,
  type PumpSchedule,
} from "../../convex/lib/pumpSchedule";

export {
  DEFAULT_PUMP_AMOUNT_ML,
  DEFAULT_PUMP_TIMEZONE,
  DEFAULT_PUMP_TIMES,
  normalizePumpTimes,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIcsUtcStamp(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function formatIcsLocal(ms: number, timeZone: string): string {
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
    parts.find((p) => p.type === type)?.value ?? "00";
  return (
    `${get("year")}${get("month")}${get("day")}` +
    `T${get("hour")}${get("minute")}${get("second")}`
  );
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export type PumpCalendarOptions = {
  babyName?: string;
  days?: number;
  alarmMinutesBefore?: number;
  now?: number;
};

/**
 * Generate an .ics with one-off pump events for the next N days,
 * each with a VALARM (calendar alert ≈ phone alarm on iPhone).
 */
export function generatePumpScheduleIcs(
  schedule: Pick<PumpSchedule, "times" | "amountMl" | "timezone">,
  options: PumpCalendarOptions = {}
): string {
  const days = options.days ?? 14;
  const alarmMinutesBefore = options.alarmMinutesBefore ?? 5;
  const now = options.now ?? Date.now();
  const timeZone = schedule.timezone || DEFAULT_PUMP_TIMEZONE;
  const times = normalizePumpTimes(schedule.times);
  const amount = schedule.amountMl ?? DEFAULT_PUMP_AMOUNT_ML;
  const baby = options.babyName?.trim();
  const summary = baby
    ? `Pump — ${baby}${amount ? ` (${amount}ml)` : ""}`
    : `Pump${amount ? ` (${amount}ml)` : ""}`;

  const slots = enumeratePumpSlots(times, timeZone, now, days).filter(
    (ts) => ts >= now - 60_000
  );

  const stamp = formatIcsUtcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//It Takes A Village//Pump Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Pump schedule",
  ];

  for (const ts of slots) {
    const uid = `pump-${ts}-${times.join("-")}@ittakesavillage.app`;
    const startLocal = formatIcsLocal(ts, timeZone);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${timeZone}:${startLocal}`,
      "DURATION:PT15M",
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(
        "Pump reminder from It Takes A Village. Phone Clock alarms cannot be set by web apps — calendar alerts are the reliable alternative."
      )}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(summary)}`,
      `TRIGGER:-PT${alarmMinutesBefore}M`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadPumpScheduleIcs(
  schedule: Pick<PumpSchedule, "times" | "amountMl" | "timezone">,
  options: PumpCalendarOptions = {}
): void {
  const ics = generatePumpScheduleIcs(schedule, options);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pump-schedule.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
