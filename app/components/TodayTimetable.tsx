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
} from "@/app/lib/utils";
import { ActivityIcon, type ActivityType } from "./icons";
import type { ActivityEntry } from "./ActivityEntryCard";
import { EditActivitySheet } from "./EditActivitySheet";

type EventKind = "feed" | "diaper" | "pump" | "nap";

type TimetableEvent = {
  id: string;
  kind: EventKind;
  startMs: number;
  endMs?: number;
  label?: string;
  caregiverName?: string;
  tone?: "solids";
};

const SOLIDS_STYLE = {
  bg: "bg-[#f3e8d8]",
  text: "text-[#5c4528]",
  icon: "feed" as ActivityType,
  bar: "bg-[#9a7b52]",
  swatch: "#9a7b52",
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

interface TodayTimetableProps {
  trackerId: Id<"trackers">;
  /** Day to show (YYYY-MM-DD). Defaults to today. */
  dateKey?: string;
  className?: string;
  /** When set with selectedCaregiver, timetable entries open the edit/detail sheet. */
  secretLink?: string;
  selectedCaregiver?: string;
}

export function TodayTimetable({
  trackerId,
  dateKey: controlledDateKey,
  className,
  secretLink,
  selectedCaregiver,
}: TodayTimetableProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const [pendingOpen, setPendingOpen] = useState<{
    id: string;
    dateKey: string;
  } | null>(null);
  const [editingEntry, setEditingEntry] = useState<ActivityEntry | null>(null);

  const canOpenDetails = Boolean(secretLink && selectedCaregiver);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayKey = useMemo(() => getDateKeyInZone(now), [now]);
  const anchorKey = controlledDateKey ?? todayKey;

  const schedule = useQuery(api.timetable.getSchedule, {
    trackerId,
    startDateKey: anchorKey,
    dayCount: 1,
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

  const gridHeight = HOURS.length * HOUR_PX;
  const { dayStart: todayBoundsStart } = useMemo(
    () => getTodayBoundsInZone(now),
    [now]
  );
  const showingToday = anchorKey === todayKey;
  const nowTop = showingToday
    ? (() => {
        const hour = msToDayOffset(now, todayBoundsStart);
        if (hour < DAY_START_HOUR || hour > DAY_END_HOUR + 1) return null;
        return (hour - DAY_START_HOUR) * HOUR_PX;
      })()
    : null;

  const kindLabel = (kind: EventKind) => t(kind);

  return (
    <div className={cn("px-4 pb-6 min-w-0", className)}>
      <p className="section-label mb-2">{t("todaysSchedule")}</p>

      {!schedule ? (
        <div className="h-48 rounded-2xl bg-beige-light animate-pulse" />
      ) : (
        <DayView
          day={schedule.days[0]}
          dateKey={anchorKey}
          gridHeight={gridHeight}
          nowTop={nowTop}
          emptyLabel={t("scheduleEmpty")}
          kindLabel={kindLabel}
          solidsLabel={t("solids")}
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
  solidsLabel,
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
  solidsLabel: string;
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
            const style =
              event.tone === "solids"
                ? SOLIDS_STYLE
                : KIND_STYLE[event.kind];
            const isPoint = event.kind !== "nap";
            const detail =
              event.kind === "diaper" &&
              (event.label === "wet" ||
                event.label === "dirty" ||
                event.label === "both")
                ? diaperLabel(event.label)
                : event.label;
            const titleParts = [
              event.tone === "solids" ? solidsLabel : kindLabel(event.kind),
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
