"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  cn,
  formatTime,
  getDateKeyInZone,
  getTodayBoundsInZone,
  shiftDateKey,
} from "@/app/lib/utils";
import { ActivityIcon, type ActivityType } from "./icons";

type RangeMode = "day" | "week";

type EventKind = "feed" | "diaper" | "pump" | "nap";

/** Soft fills + dark text for readability on colored blocks. */
const KIND_STYLE: Record<
  EventKind,
  { bg: string; text: string; icon: ActivityType; bar: string }
> = {
  feed: {
    bg: "bg-[#fde8e8]",
    text: "text-[#7a1f1a]",
    icon: "feed",
    bar: "bg-[#c43c3c]",
  },
  diaper: {
    bg: "bg-[#fff4c2]",
    text: "text-[#5c4a00]",
    icon: "diaper",
    bar: "bg-[#c9a21a]",
  },
  pump: {
    bg: "bg-[#dceefb]",
    text: "text-[#0f4f7a]",
    icon: "pump",
    bar: "bg-[#2f87c5]",
  },
  nap: {
    bg: "bg-[#d8f0e0]",
    text: "text-[#145a32]",
    icon: "nap",
    bar: "bg-[#2f8f55]",
  },
};

const HOUR_PX = 36;
/** Full calendar day 00:00–24:00 */
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 23;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i
);

function msToDayOffset(ms: number, dayStart: number): number {
  return (ms - dayStart) / (1000 * 60 * 60);
}

function clampBlock(
  startMs: number,
  endMs: number | undefined,
  dayStart: number,
  dayEnd: number
): { top: number; height: number } | null {
  const start = Math.max(startMs, dayStart);
  const end = Math.min(endMs ?? startMs + 12 * 60_000, dayEnd);
  if (end <= start) return null;
  const startHour = msToDayOffset(start, dayStart);
  const endHour = msToDayOffset(end, dayStart);
  const visibleStart = Math.max(startHour, DAY_START_HOUR);
  const visibleEnd = Math.min(endHour, DAY_END_HOUR + 1);
  if (visibleEnd <= visibleStart) return null;
  return {
    top: (visibleStart - DAY_START_HOUR) * HOUR_PX,
    height: Math.max(18, (visibleEnd - visibleStart) * HOUR_PX - 2),
  };
}

function weekdayShort(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: "short",
  });
}

function dayNum(dateKey: string): string {
  return dateKey.slice(8);
}

interface TodayTimetableProps {
  trackerId: Id<"trackers">;
  /** Controlled day/week mode (e.g. Insights Daily|Weekly). */
  mode?: RangeMode;
  onModeChange?: (mode: RangeMode) => void;
  /** Anchor date YYYY-MM-DD for day view or week containing this day. */
  dateKey?: string;
  /** Hide internal Day|Week control when parent already toggles range. */
  hideRangeToggle?: boolean;
  className?: string;
}

function mondayWeekStart(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return shiftDateKey(dateKey, mondayOffset);
}

export function TodayTimetable({
  trackerId,
  mode: controlledMode,
  onModeChange,
  dateKey: controlledDateKey,
  hideRangeToggle = false,
  className,
}: TodayTimetableProps) {
  const { t, language } = useLanguage();
  const [internalMode, setInternalMode] = useState<RangeMode>("day");
  const [now, setNow] = useState(() => Date.now());

  const mode = controlledMode ?? internalMode;
  const setMode = (next: RangeMode) => {
    if (controlledMode === undefined) setInternalMode(next);
    onModeChange?.(next);
  };

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayKey = useMemo(() => getDateKeyInZone(now), [now]);
  const anchorKey = controlledDateKey ?? todayKey;
  const weekStartKey = useMemo(
    () => mondayWeekStart(anchorKey),
    [anchorKey]
  );

  const startDateKey = mode === "day" ? anchorKey : weekStartKey;
  const dayCount = mode === "day" ? 1 : 7;

  const schedule = useQuery(api.timetable.getSchedule, {
    trackerId,
    startDateKey,
    dayCount,
    now,
  });

  const locale = language === "zh" ? "zh-CN" : "en-US";
  const gridHeight = HOURS.length * HOUR_PX;
  const { dayStart: todayBoundsStart } = useMemo(
    () => getTodayBoundsInZone(now),
    [now]
  );
  const showingToday = mode === "day" && anchorKey === todayKey;
  const nowTop =
    showingToday
      ? (() => {
          const hour = msToDayOffset(now, todayBoundsStart);
          if (hour < DAY_START_HOUR || hour > DAY_END_HOUR + 1) return null;
          return (hour - DAY_START_HOUR) * HOUR_PX;
        })()
      : null;

  return (
    <div className={cn("px-4 pb-6 min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="section-label mb-0">{t("todaysSchedule")}</p>
        {!hideRangeToggle && (
          <div
            className="inline-flex rounded-full bg-beige-light p-0.5 shrink-0"
            role="tablist"
            aria-label={t("scheduleRangeAria")}
          >
            {(["day", "week"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                  mode === value
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted"
                )}
              >
                {value === "day" ? t("scheduleDay") : t("scheduleWeek")}
              </button>
            ))}
          </div>
        )}
      </div>

      {!schedule ? (
        <div className="h-48 rounded-2xl bg-beige-light animate-pulse" />
      ) : mode === "day" ? (
        <DayView
          day={schedule.days[0]}
          gridHeight={gridHeight}
          nowTop={nowTop}
          emptyLabel={t("scheduleEmpty")}
          kindLabel={(kind) => t(kind)}
          diaperLabel={(type) =>
            type === "wet"
              ? t("wet")
              : type === "dirty"
                ? t("dirty")
                : t("wetDirty")
          }
        />
      ) : (
        <WeekView
          days={schedule.days}
          todayKey={todayKey}
          gridHeight={gridHeight}
          locale={locale}
          emptyLabel={t("scheduleEmpty")}
        />
      )}
    </div>
  );
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  if (hour > 12) return `${hour - 12}p`;
  return `${hour}a`;
}

function HourAxis() {
  return (
    <div
      className="w-9 shrink-0 relative"
      style={{ height: HOURS.length * HOUR_PX }}
    >
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 text-[9px] font-medium text-[#5c534c] tabular-nums leading-none"
          style={{ top: (hour - DAY_START_HOUR) * HOUR_PX }}
        >
          {formatHourLabel(hour)}
        </div>
      ))}
    </div>
  );
}

function DayView({
  day,
  gridHeight,
  nowTop,
  emptyLabel,
  kindLabel,
  diaperLabel,
}: {
  day:
    | {
        dayStart: number;
        dayEnd: number;
        events: Array<{
          id: string;
          kind: EventKind;
          startMs: number;
          endMs?: number;
          label?: string;
        }>;
      }
    | undefined;
  gridHeight: number;
  nowTop: number | null;
  emptyLabel: string;
  kindLabel: (kind: EventKind) => string;
  diaperLabel: (type: "wet" | "dirty" | "both") => string;
}) {
  if (!day) {
    return (
      <p className="text-sm text-muted py-6 text-center">{emptyLabel}</p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex gap-1 px-2 py-3 min-w-0">
        <HourAxis />
        <div className="relative flex-1 min-w-0" style={{ height: gridHeight }}>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-border/70"
              style={{ top: (hour - DAY_START_HOUR) * HOUR_PX }}
            />
          ))}
          {nowTop !== null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="h-px bg-terracotta" />
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-terracotta" />
            </div>
          )}
          {day.events.length === 0 && (
            <p className="absolute inset-x-2 top-1/3 text-center text-sm text-muted">
              {emptyLabel}
            </p>
          )}
          {day.events.map((event) => {
            const block = clampBlock(
              event.startMs,
              event.endMs,
              day.dayStart,
              day.dayEnd
            );
            if (!block) return null;
            const style = KIND_STYLE[event.kind];
            const isPoint = event.kind !== "nap";
            const detail =
              event.kind === "diaper" &&
              (event.label === "wet" ||
                event.label === "dirty" ||
                event.label === "both")
                ? diaperLabel(event.label)
                : event.label;
            return (
              <div
                key={event.id}
                className={cn(
                  "absolute left-0 right-1 rounded-lg px-1.5 flex items-center gap-1 min-w-0 overflow-hidden z-10 border border-black/[0.04]",
                  style.bg,
                  isPoint && "min-h-[22px]"
                )}
                style={{
                  top: block.top,
                  height: isPoint
                    ? Math.max(22, Math.min(block.height, 28))
                    : block.height,
                }}
                title={`${kindLabel(event.kind)} ${formatTime(event.startMs)}`}
              >
                <span
                  className={cn(
                    "w-1 self-stretch rounded-full shrink-0",
                    style.bar
                  )}
                />
                <ActivityIcon
                  type={style.icon}
                  size={13}
                  strokeWidth={2.25}
                  className={cn(style.text, "shrink-0")}
                />
                <span
                  className={cn(
                    "text-[11px] font-bold truncate",
                    style.text
                  )}
                >
                  {formatTime(event.startMs)}
                  {detail ? ` · ${detail}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  days,
  todayKey,
  gridHeight,
  locale,
  emptyLabel,
}: {
  days: Array<{
    dateKey: string;
    dayStart: number;
    dayEnd: number;
    events: Array<{
      id: string;
      kind: EventKind;
      startMs: number;
      endMs?: number;
      label?: string;
    }>;
  }>;
  todayKey: string;
  gridHeight: number;
  locale: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain -mx-0 px-2 py-3">
        <div
          className="flex gap-1"
          style={{ minWidth: Math.max(340, days.length * 56 + 40) }}
        >
          <HourAxis />
          <div className="flex gap-1 flex-1">
            {days.map((day) => (
              <div key={day.dateKey} className="w-12 shrink-0 min-w-[3rem]">
                <div
                  className={cn(
                    "text-center mb-1 pb-1",
                    day.dateKey === todayKey && "text-accent-feed"
                  )}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                    {weekdayShort(day.dateKey, locale)}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      day.dateKey === todayKey
                        ? "text-accent-feed"
                        : "text-foreground"
                    )}
                  >
                    {dayNum(day.dateKey)}
                  </p>
                </div>
                <div
                  className="relative border-l border-border/60"
                  style={{ height: gridHeight }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-border/50"
                      style={{ top: (hour - DAY_START_HOUR) * HOUR_PX }}
                    />
                  ))}
                  {day.events.map((event) => {
                    const block = clampBlock(
                      event.startMs,
                      event.endMs,
                      day.dayStart,
                      day.dayEnd
                    );
                    if (!block) return null;
                    const style = KIND_STYLE[event.kind];
                    const isNap = event.kind === "nap";
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded-sm z-10",
                          style.bar,
                          !isNap && "opacity-90"
                        )}
                        style={{
                          top: block.top,
                          height: isNap
                            ? block.height
                            : Math.max(6, Math.min(block.height, 10)),
                        }}
                        title={`${event.kind} ${formatTime(event.startMs)}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        {days.every((d) => d.events.length === 0) && (
          <p className="text-center text-sm text-muted py-4">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
