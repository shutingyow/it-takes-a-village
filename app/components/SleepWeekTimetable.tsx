"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  cn,
  formatSleepTotal,
  formatTime,
  getDayBoundsForDateKey,
} from "@/app/lib/utils";

/** Match Weekly Sleep summary colours. */
export const SLEEP_NIGHT_COLOUR = "#8fa4b8";
export const SLEEP_NAP_COLOUR = "#c4846a";

/** Pixels per hour — taller chart so sleep blocks are easier to see. */
const HOUR_PX = 22;
const DAY_MINUTES = 24 * 60;
/** Chart Y=0 is 06:00 local (Huckleberry-style day-oriented axis). */
const AXIS_START_HOUR = 6;
const AXIS_START_MINUTES = AXIS_START_HOUR * 60;
/** Labels along the 6am→6am axis (midnight wraps into the lower half). */
const LABEL_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 0, 2, 4] as const;

function minutesFromMidnight(ms: number, dayStart: number): number {
  return Math.max(0, Math.min(DAY_MINUTES, (ms - dayStart) / 60_000));
}

/** Minutes past 06:00 on the chart axis (wraps overnight). */
function minutesOnAxis(minutesFromMidnightValue: number): number {
  return (
    (minutesFromMidnightValue - AXIS_START_MINUTES + DAY_MINUTES) % DAY_MINUTES
  );
}

function hourLabelTop(hour: number, chartHeight: number): number {
  return (minutesOnAxis(hour * 60) / DAY_MINUTES) * chartHeight;
}

type SleepSession = {
  type: "nap" | "night";
  startTime: number;
  endTime?: number;
  minutes: number;
};

type DayColumn = {
  date: string;
  label: string;
  sleepSessions: SleepSession[];
};

type PlacedBlock = {
  id: string;
  dayDate: string;
  type: "nap" | "night";
  startMs: number;
  endMs: number;
  minutes: number;
  active: boolean;
  top: number;
  height: number;
};

function clipToDay(
  startMs: number,
  endMs: number,
  dayStart: number,
  dayEnd: number
): { start: number; end: number } | null {
  const start = Math.max(startMs, dayStart);
  const end = Math.min(endMs, dayEnd);
  if (end <= start) return null;
  return { start, end };
}

/**
 * Split a calendar-day segment at 06:00 so each piece is contiguous on the
 * 6am-based Y axis (e.g. 04:00–08:00 → bottom 04–06 + top 06–08).
 */
function segmentsOnAxis(
  startMin: number,
  endMin: number
): { startMin: number; endMin: number }[] {
  if (endMin <= startMin) return [];
  if (startMin < AXIS_START_MINUTES && endMin > AXIS_START_MINUTES) {
    return [
      { startMin, endMin: AXIS_START_MINUTES },
      { startMin: AXIS_START_MINUTES, endMin },
    ];
  }
  return [{ startMin, endMin }];
}

function placeBlocks(
  days: DayColumn[],
  timezone: string | undefined,
  now: number
): PlacedBlock[] {
  const chartHeight = 24 * HOUR_PX;
  const placed: PlacedBlock[] = [];
  for (const day of days) {
    const { dayStart, dayEnd } = getDayBoundsForDateKey(day.date, timezone);
    for (const session of day.sleepSessions) {
      const effectiveEnd = session.endTime ?? now;
      const clipped = clipToDay(
        session.startTime,
        effectiveEnd,
        dayStart,
        dayEnd
      );
      if (!clipped) continue;
      const startMin = minutesFromMidnight(clipped.start, dayStart);
      const endMin = minutesFromMidnight(clipped.end, dayStart);
      const segments = segmentsOnAxis(startMin, endMin);
      segments.forEach((seg, segIndex) => {
        const span = seg.endMin - seg.startMin;
        if (span <= 0) return;
        const axisStart = minutesOnAxis(seg.startMin);
        placed.push({
          id: `${day.date}-${session.type}-${session.startTime}-${segIndex}`,
          dayDate: day.date,
          type: session.type,
          // Detail panel uses the day-clipped session, not the visual split piece.
          startMs: clipped.start,
          endMs: clipped.end,
          minutes: session.minutes,
          active: session.endTime == null && clipped.end >= now,
          top: (axisStart / DAY_MINUTES) * chartHeight,
          height: Math.max(3, (span / DAY_MINUTES) * chartHeight - 1),
        });
      });
    }
  }
  return placed;
}

interface SleepWeekTimetableProps {
  days: DayColumn[];
  timezone?: string;
  now: number;
  babyName?: string;
  className?: string;
}

export function SleepWeekTimetable({
  days,
  timezone,
  now,
  babyName,
  className,
}: SleepWeekTimetableProps) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const blocks = useMemo(
    () => placeBlocks(days, timezone, now),
    [days, timezone, now]
  );
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const hasSleep = blocks.length > 0;
  const chartHeight = 24 * HOUR_PX;

  const todayKey = days.find((d) => {
    const { dayStart, dayEnd } = getDayBoundsForDateKey(d.date, timezone);
    return now >= dayStart && now < dayEnd;
  })?.date;
  const nowLineTop =
    todayKey != null
      ? (() => {
          const { dayStart } = getDayBoundsForDateKey(todayKey, timezone);
          return (
            (minutesOnAxis(minutesFromMidnight(now, dayStart)) / DAY_MINUTES) *
            chartHeight
          );
        })()
      : null;

  if (!hasSleep) {
    return (
      <p className={cn("text-sm text-muted text-center py-8", className)}>
        {t("sleepWeekEmpty")}
      </p>
    );
  }

  const name = babyName?.trim() || t("babyFallback");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: SLEEP_NAP_COLOUR }}
            aria-hidden
          />
          {t("statsSleepNaps")}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: SLEEP_NIGHT_COLOUR }}
            aria-hidden
          />
          {t("statsSleepBedtime")}
        </span>
      </div>

      <div className="flex gap-1 min-w-0">
        <div
          className="relative shrink-0 w-6"
          style={{ height: chartHeight }}
          aria-hidden
        >
          {LABEL_HOURS.map((hour) => (
            <span
              key={hour}
              className="absolute right-0 text-[9px] text-muted tabular-nums leading-none -translate-y-1/2"
              style={{ top: hourLabelTop(hour, chartHeight) }}
            >
              {hour}
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-w-0 flex gap-0.5">
          {LABEL_HOURS.map((hour) => (
            <div
              key={`g-${hour}`}
              className="absolute left-0 right-0 border-t border-border/50 pointer-events-none"
              style={{ top: hourLabelTop(hour, chartHeight) }}
              aria-hidden
            />
          ))}

          {nowLineTop != null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: nowLineTop }}
              aria-hidden
            >
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta shrink-0 -ml-0.5" />
              <span className="flex-1 border-t border-terracotta" />
            </div>
          )}

          {days.map((day) => (
            <div
              key={day.date}
              className="relative flex-1 min-w-0 bg-beige-light/40 rounded-sm"
              style={{ height: chartHeight }}
            >
              {blocks
                .filter((b) => b.dayDate === day.date)
                .map((block) => {
                  const isSelected = selectedId === block.id;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() =>
                        setSelectedId((id) =>
                          id === block.id ? null : block.id
                        )
                      }
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded-sm touch-manipulation transition-shadow",
                        isSelected && "ring-2 ring-terracotta z-10"
                      )}
                      style={{
                        top: block.top,
                        height: block.height,
                        backgroundColor:
                          block.type === "night"
                            ? SLEEP_NIGHT_COLOUR
                            : SLEEP_NAP_COLOUR,
                      }}
                      aria-pressed={isSelected}
                      aria-label={`${
                        block.type === "night"
                          ? t("statsSleepBedtime")
                          : t("nap")
                      } ${formatSleepTotal(block.minutes)}`}
                    />
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between gap-0.5 pl-7">
        {days.map((day) => (
          <span
            key={`l-${day.date}`}
            className="flex-1 text-[9px] text-muted truncate text-center"
          >
            {day.label}
          </span>
        ))}
      </div>

      {selected && (
        <div className="bg-surface border border-border rounded-2xl px-3 py-3 card-shadow">
          <p className="text-sm font-semibold text-foreground">
            {t("sleepBlockDetail", {
              name,
              duration: formatSleepTotal(selected.minutes),
            })}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {selected.type === "night" ? t("statsSleepBedtime") : t("nap")}
            {" · "}
            <span className="tabular-nums">
              {formatTime(selected.startMs)}
              {" – "}
              {selected.active
                ? `${formatTime(selected.endMs)} ${t("sleepActive")}`
                : formatTime(selected.endMs)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
