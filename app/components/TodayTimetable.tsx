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
import type { ActivityEntry } from "./ActivityEntryCard";
import { EditActivitySheet } from "./EditActivitySheet";

type RangeMode = "day" | "week";

type EventKind = "feed" | "diaper" | "pump" | "nap";

type TimetableEvent = {
  id: string;
  kind: EventKind;
  startMs: number;
  endMs?: number;
  label?: string;
  caregiverName?: string;
};

/** Soft fills + dark text for readability on colored blocks. */
const KIND_STYLE: Record<
  EventKind,
  { bg: string; text: string; icon: ActivityType; bar: string; swatch: string }
> = {
  feed: {
    bg: "bg-[#fde8e8]",
    text: "text-[#7a1f1a]",
    icon: "feed",
    bar: "bg-[#c43c3c]",
    swatch: "#c43c3c",
  },
  diaper: {
    bg: "bg-[#fff4c2]",
    text: "text-[#5c4a00]",
    icon: "diaper",
    bar: "bg-[#c9a21a]",
    swatch: "#c9a21a",
  },
  pump: {
    bg: "bg-[#dceefb]",
    text: "text-[#0f4f7a]",
    icon: "pump",
    bar: "bg-[#2f87c5]",
    swatch: "#2f87c5",
  },
  nap: {
    bg: "bg-[#d8f0e0]",
    text: "text-[#145a32]",
    icon: "nap",
    bar: "bg-[#2f8f55]",
    swatch: "#2f8f55",
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

const KIND_ORDER: EventKind[] = ["feed", "diaper", "pump", "nap"];

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

function countByKind(events: TimetableEvent[]): Record<EventKind, number> {
  return {
    feed: events.filter((e) => e.kind === "feed").length,
    diaper: events.filter((e) => e.kind === "diaper").length,
    pump: events.filter((e) => e.kind === "pump").length,
    nap: events.filter((e) => e.kind === "nap").length,
  };
}

interface TodayTimetableProps {
  trackerId: Id<"trackers">;
  /** Controlled day/week mode (e.g. Insights Daily|Weekly). */
  mode?: RangeMode;
  onModeChange?: (mode: RangeMode) => void;
  /** Anchor date YYYY-MM-DD for day view or week containing this day. */
  dateKey?: string;
  /**
   * How to pick the 7-day window when mode is "week".
   * - monday: calendar week Mon–Sun containing dateKey (default)
   * - ending: rolling 7 days ending on dateKey (matches stats weekly)
   */
  weekAlign?: "monday" | "ending";
  /** Hide internal Day|Week control when parent already toggles range. */
  hideRangeToggle?: boolean;
  className?: string;
  /** When set with selectedCaregiver, timetable entries open the edit/detail sheet. */
  secretLink?: string;
  selectedCaregiver?: string;
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
  weekAlign = "monday",
  hideRangeToggle = false,
  className,
  secretLink,
  selectedCaregiver,
}: TodayTimetableProps) {
  const { t, language } = useLanguage();
  const [internalMode, setInternalMode] = useState<RangeMode>("day");
  const [now, setNow] = useState(() => Date.now());
  const [pendingOpen, setPendingOpen] = useState<{
    id: string;
    dateKey: string;
  } | null>(null);
  const [editingEntry, setEditingEntry] = useState<ActivityEntry | null>(null);

  const mode = controlledMode ?? internalMode;
  const setMode = (next: RangeMode) => {
    if (controlledMode === undefined) setInternalMode(next);
    onModeChange?.(next);
  };

  const canOpenDetails = Boolean(secretLink && selectedCaregiver);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayKey = useMemo(() => getDateKeyInZone(now), [now]);
  const anchorKey = controlledDateKey ?? todayKey;
  const weekStartKey = useMemo(
    () =>
      weekAlign === "ending"
        ? shiftDateKey(anchorKey, -6)
        : mondayWeekStart(anchorKey),
    [anchorKey, weekAlign]
  );

  const startDateKey = mode === "day" ? anchorKey : weekStartKey;
  const dayCount = mode === "day" ? 1 : 7;

  const schedule = useQuery(api.timetable.getSchedule, {
    trackerId,
    startDateKey,
    dayCount,
    now,
  });

  const dayEntries = useQuery(
    api.history.getActivityForDay,
    pendingOpen
      ? { trackerId, dateKey: pendingOpen.dateKey }
      : "skip"
  );

  useEffect(() => {
    if (!pendingOpen || dayEntries === undefined) return;
    const found = dayEntries.find((entry) => entry._id === pendingOpen.id);
    if (found) {
      setEditingEntry(found);
    }
    setPendingOpen(null);
  }, [pendingOpen, dayEntries]);

  const handleEventClick = (eventId: string, dateKey: string) => {
    if (!canOpenDetails) return;
    setPendingOpen({ id: eventId, dateKey });
  };

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

  const kindLabel = (kind: EventKind) => t(kind);

  return (
    <div className={cn("px-4 pb-6 min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="section-label mb-0">
          {mode === "week" ? t("scheduleWeekOverview") : t("todaysSchedule")}
        </p>
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
          dateKey={anchorKey}
          gridHeight={gridHeight}
          nowTop={nowTop}
          emptyLabel={t("scheduleEmpty")}
          kindLabel={kindLabel}
          diaperLabel={(type) =>
            type === "wet"
              ? t("wet")
              : type === "dirty"
                ? t("dirty")
                : t("wetDirty")
          }
          interactive={canOpenDetails}
          onEventClick={handleEventClick}
        />
      ) : (
        <WeekOverview
          days={schedule.days}
          todayKey={todayKey}
          locale={locale}
          emptyLabel={t("scheduleEmpty")}
          kindLabel={kindLabel}
          diaperLabel={(type) =>
            type === "wet"
              ? t("wet")
              : type === "dirty"
                ? t("dirty")
                : t("wetDirty")
          }
          interactive={canOpenDetails}
          onEventClick={handleEventClick}
          weekTotalsLabel={t("scheduleWeekTotals")}
          countLabel={(kind, count) =>
            t(
              kind === "feed"
                ? "scheduleCountFeeds"
                : kind === "diaper"
                  ? "scheduleCountDiapers"
                  : kind === "pump"
                    ? "scheduleCountPumps"
                    : "scheduleCountNaps",
              { count }
            )
          }
        />
      )}

      {editingEntry && secretLink && selectedCaregiver && (
        <EditActivitySheet
          entry={editingEntry}
          trackerId={trackerId}
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setEditingEntry(null)}
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

function KindLegend({
  kindLabel,
}: {
  kindLabel: (kind: EventKind) => string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap px-1 pb-2" role="list">
      {KIND_ORDER.map((kind) => (
        <span
          key={kind}
          className="flex items-center gap-1.5 text-[11px] text-muted"
        >
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: KIND_STYLE[kind].swatch }}
          />
          {kindLabel(kind)}
        </span>
      ))}
    </div>
  );
}

function DayView({
  day,
  dateKey,
  gridHeight,
  nowTop,
  emptyLabel,
  kindLabel,
  diaperLabel,
  interactive,
  onEventClick,
}: {
  day:
    | {
        dayStart: number;
        dayEnd: number;
        events: TimetableEvent[];
      }
    | undefined;
  dateKey: string;
  gridHeight: number;
  nowTop: number | null;
  emptyLabel: string;
  kindLabel: (kind: EventKind) => string;
  diaperLabel: (type: "wet" | "dirty" | "both") => string;
  interactive: boolean;
  onEventClick: (eventId: string, dateKey: string) => void;
}) {
  if (!day) {
    return (
      <p className="text-sm text-muted py-6 text-center">{emptyLabel}</p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-2 pt-2">
        <KindLegend kindLabel={kindLabel} />
      </div>
      <div className="flex gap-1 px-2 pb-3 min-w-0">
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
            const titleParts = [
              kindLabel(event.kind),
              formatTime(event.startMs),
              event.caregiverName ? event.caregiverName : null,
            ].filter(Boolean);
            const className = cn(
              "absolute left-0 right-1 rounded-lg px-1.5 flex items-center gap-1 min-w-0 overflow-hidden z-10 border border-black/[0.04] text-left",
              style.bg,
              isPoint && "min-h-[22px]",
              interactive &&
                "cursor-pointer touch-manipulation active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta"
            );
            const stylePos = {
              top: block.top,
              height: isPoint
                ? Math.max(22, Math.min(block.height, 28))
                : block.height,
            };
            const inner = (
              <>
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
              </>
            );
            if (interactive) {
              return (
                <button
                  key={event.id}
                  type="button"
                  className={className}
                  style={stylePos}
                  title={titleParts.join(" · ")}
                  aria-label={titleParts.join(", ")}
                  onClick={() => onEventClick(event.id, dateKey)}
                >
                  {inner}
                </button>
              );
            }
            return (
              <div
                key={event.id}
                className={className}
                style={stylePos}
                title={titleParts.join(" · ")}
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekOverview({
  days,
  todayKey,
  locale,
  emptyLabel,
  kindLabel,
  diaperLabel,
  interactive,
  onEventClick,
  weekTotalsLabel,
  countLabel,
}: {
  days: Array<{
    dateKey: string;
    dayStart: number;
    dayEnd: number;
    events: TimetableEvent[];
  }>;
  todayKey: string;
  locale: string;
  emptyLabel: string;
  kindLabel: (kind: EventKind) => string;
  diaperLabel: (type: "wet" | "dirty" | "both") => string;
  interactive: boolean;
  onEventClick: (eventId: string, dateKey: string) => void;
  weekTotalsLabel: string;
  countLabel: (kind: EventKind, count: number) => string;
}) {
  const weekCounts = useMemo(() => {
    const all = days.flatMap((d) => d.events);
    return countByKind(all);
  }, [days]);

  const hasAny = days.some((d) => d.events.length > 0);

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-3 pt-3">
        <KindLegend kindLabel={kindLabel} />
        {hasAny && (
          <p className="text-[11px] text-muted mb-2 leading-snug">
            <span className="font-medium text-foreground/80">
              {weekTotalsLabel}
            </span>
            {": "}
            {KIND_ORDER.filter((k) => weekCounts[k] > 0)
              .map((k) => countLabel(k, weekCounts[k]))
              .join(" · ")}
          </p>
        )}
      </div>

      {!hasAny ? (
        <p className="text-center text-sm text-muted py-6 px-3">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {days.map((day) => {
            const counts = countByKind(day.events);
            const isToday = day.dateKey === todayKey;
            return (
              <li key={day.dateKey} className="px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isToday ? "text-accent-feed" : "text-foreground"
                    )}
                  >
                    <span className="uppercase tracking-wide text-[11px] font-medium text-muted mr-1.5">
                      {weekdayShort(day.dateKey, locale)}
                    </span>
                    {dayNum(day.dateKey)}
                  </p>
                  {day.events.length === 0 ? (
                    <span className="text-[11px] text-muted/70">—</span>
                  ) : (
                    <span className="text-[11px] text-muted tabular-nums text-right">
                      {KIND_ORDER.filter((k) => counts[k] > 0)
                        .map((k) => `${counts[k]} ${kindLabel(k)}`)
                        .join(" · ")}
                    </span>
                  )}
                </div>

                {day.events.length > 0 && (
                  <ul className="space-y-1">
                    {day.events.map((event) => {
                      const style = KIND_STYLE[event.kind];
                      const detail =
                        event.kind === "diaper" &&
                        (event.label === "wet" ||
                          event.label === "dirty" ||
                          event.label === "both")
                          ? diaperLabel(event.label)
                          : event.label;
                      const titleParts = [
                        kindLabel(event.kind),
                        formatTime(event.startMs),
                        event.caregiverName ?? null,
                      ].filter(Boolean);
                      const rowClass = cn(
                        "w-full flex items-center gap-1.5 rounded-lg px-1.5 py-1 min-w-0 text-left",
                        style.bg,
                        interactive &&
                          "cursor-pointer touch-manipulation active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta"
                      );
                      const content = (
                        <>
                          <span
                            className={cn(
                              "w-1 self-stretch min-h-[14px] rounded-full shrink-0",
                              style.bar
                            )}
                          />
                          <ActivityIcon
                            type={style.icon}
                            size={12}
                            strokeWidth={2.25}
                            className={cn(style.text, "shrink-0")}
                          />
                          <span
                            className={cn(
                              "text-[11px] font-semibold truncate",
                              style.text
                            )}
                          >
                            {formatTime(event.startMs)}
                            {" · "}
                            {kindLabel(event.kind)}
                            {detail ? ` · ${detail}` : ""}
                          </span>
                        </>
                      );
                      if (interactive) {
                        return (
                          <li key={event.id}>
                            <button
                              type="button"
                              className={rowClass}
                              title={titleParts.join(" · ")}
                              aria-label={titleParts.join(", ")}
                              onClick={() =>
                                onEventClick(event.id, day.dateKey)
                              }
                            >
                              {content}
                            </button>
                          </li>
                        );
                      }
                      return (
                        <li key={event.id} className={rowClass} title={titleParts.join(" · ")}>
                          {content}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
