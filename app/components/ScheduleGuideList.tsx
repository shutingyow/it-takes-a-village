"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ScheduleSlot,
  ScheduleSlotKind,
} from "@/convex/lib/clockSchedule";
import { cn } from "@/app/lib/utils";

/** Default span when a row has no endTime (for now-line placement). */
const DEFAULT_SLOT_SPAN_MIN = 45;
const DAY_START_MIN = 5 * 60;
const NIGHT_START_MIN = 19 * 60;

function parseMinutes(time: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTimeRange(time: string, endTime?: string): string {
  if (!endTime) return time;
  return `${time}–${endTime}`;
}

function kindBarClass(kind: ScheduleSlotKind | undefined): string {
  if (kind === "feed") return "bg-accent-feed";
  if (kind === "nap") return "bg-accent-sleep";
  if (kind === "pump") return "bg-accent-pump";
  return "bg-muted/55";
}

function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const msToNextMinute = 60_000 - (Date.now() % 60_000) + 40;
    const timeoutId = setTimeout(() => {
      setNow(Date.now());
      intervalId = setInterval(() => setNow(Date.now()), 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
  return now;
}

function localMinutesFromMs(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function isNightMinute(min: number): boolean {
  return min >= NIGHT_START_MIN || min < DAY_START_MIN;
}

function nightSortKey(min: number): number {
  return min < DAY_START_MIN ? min + 24 * 60 : min;
}

type PreparedSlot = {
  slot: ScheduleSlot;
  startMin: number;
  endMin: number;
  title: string;
  timeLabel: string;
};

type NowPlacement =
  | { kind: "before"; index: number }
  | { kind: "through"; index: number; fraction: number }
  | { kind: "after" }
  | null;

function prepareSlots(
  slots: ScheduleSlot[],
  kindLabels: Record<ScheduleSlotKind, string>,
  activityFallback: string
): PreparedSlot[] {
  const sorted = [...slots].sort(
    (a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id)
  );
  return sorted
    .map((slot, index) => {
      const startMin = parseMinutes(slot.time);
      if (startMin == null) return null;
      const explicitEnd = slot.endTime ? parseMinutes(slot.endTime) : null;
      const nextStart =
        index + 1 < sorted.length
          ? parseMinutes(sorted[index + 1]!.time)
          : null;
      let endMin =
        explicitEnd != null && explicitEnd > startMin
          ? explicitEnd
          : startMin + DEFAULT_SLOT_SPAN_MIN;
      if (
        explicitEnd == null &&
        nextStart != null &&
        nextStart > startMin &&
        nextStart < endMin
      ) {
        endMin = nextStart;
      }
      const kindLabel = slot.kind ? kindLabels[slot.kind] : null;
      const title = slot.label?.trim() || kindLabel || activityFallback;
      return {
        slot,
        startMin,
        endMin,
        title,
        timeLabel: formatTimeRange(slot.time, slot.endTime),
      };
    })
    .filter((row): row is PreparedSlot => row != null);
}

function placeNowLine(
  rows: PreparedSlot[],
  nowMin: number,
  /** Maps wall-clock minutes onto a monotonic axis (night wrap uses +24h). */
  axisKey: (min: number) => number = (min) => min
): NowPlacement {
  if (rows.length === 0) return null;
  const nowKey = axisKey(nowMin);
  const startKey = (row: PreparedSlot) => axisKey(row.startMin);
  const endKey = (row: PreparedSlot) => {
    const start = startKey(row);
    let end = axisKey(row.endMin);
    if (end <= start) end = start + Math.max(1, row.endMin - row.startMin);
    return end;
  };

  if (nowKey < startKey(rows[0]!)) return { kind: "before", index: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const start = startKey(row);
    const end = endKey(row);
    if (nowKey >= start && nowKey < end) {
      const span = Math.max(1, end - start);
      const fraction = Math.min(
        0.92,
        Math.max(0.08, (nowKey - start) / span)
      );
      return { kind: "through", index: i, fraction };
    }
    const next = rows[i + 1];
    if (next && nowKey >= end && nowKey < startKey(next)) {
      return { kind: "before", index: i + 1 };
    }
  }
  return { kind: "after" };
}

function NowLine({ label }: { label: string }) {
  return (
    <div
      className="relative flex items-center gap-2 py-0.5 pointer-events-none"
      aria-hidden
    >
      <span className="shrink-0 rounded-full bg-terracotta px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white leading-none">
        {label}
      </span>
      <span className="h-0.5 flex-1 rounded-full bg-terracotta/80" />
    </div>
  );
}

function SlotRow({
  row,
  onClick,
  nowOverlay,
}: {
  row: PreparedSlot;
  onClick?: (slot: ScheduleSlot) => void;
  nowOverlay?: { fraction: number; label: string } | null;
}) {
  const body = (
    <>
      <span
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-[10px]",
          kindBarClass(row.slot.kind)
        )}
        aria-hidden
      />
      <span className="tabular-nums font-semibold text-foreground shrink-0 text-[13px] leading-snug">
        {row.timeLabel}
      </span>
      <span className="text-foreground min-w-0 flex-1 truncate text-[13px] leading-snug">
        {row.title}
      </span>
      {row.slot.note ? (
        <span className="text-muted text-[11px] leading-snug text-right shrink-0 max-w-[38%] line-clamp-2">
          {row.slot.note}
        </span>
      ) : null}
      {nowOverlay ? (
        <span
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: `${nowOverlay.fraction * 100}%` }}
        >
          <NowLine label={nowOverlay.label} />
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "relative flex items-start gap-2.5 pl-3.5 pr-3 py-2.5 rounded-[10px] bg-surface border border-border/70 text-left w-full min-w-0",
    onClick && "active:bg-beige-light/50 touch-manipulation"
  );

  if (onClick) {
    return (
      <button type="button" onClick={() => onClick(row.slot)} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function SectionList({
  rows,
  nowMin,
  showNowLine,
  nowLabel,
  onSlotClick,
  axisKey,
}: {
  rows: PreparedSlot[];
  nowMin: number;
  showNowLine: boolean;
  nowLabel: string;
  onSlotClick?: (slot: ScheduleSlot) => void;
  axisKey?: (min: number) => number;
}) {
  const placement = showNowLine
    ? placeNowLine(rows, nowMin, axisKey)
    : null;

  return (
    <ul className="space-y-1.5">
      {rows.map((row, index) => {
        const showBefore =
          placement?.kind === "before" && placement.index === index;
        const through =
          placement?.kind === "through" && placement.index === index
            ? { fraction: placement.fraction, label: nowLabel }
            : null;
        return (
          <li key={row.slot.id} className="min-w-0">
            {showBefore ? <NowLine label={nowLabel} /> : null}
            <SlotRow row={row} onClick={onSlotClick} nowOverlay={through} />
          </li>
        );
      })}
      {placement?.kind === "after" ? (
        <li className="min-w-0">
          <NowLine label={nowLabel} />
        </li>
      ) : null}
    </ul>
  );
}

export function ScheduleGuideList({
  slots,
  emptyLabel,
  guideHint,
  dayLabel,
  nightLabel,
  nowLabel,
  kindLabels,
  activityFallback,
  showNowLine = true,
  showLegend = true,
  onSlotClick,
  className,
  footer,
}: {
  slots: ScheduleSlot[];
  emptyLabel: string;
  guideHint?: string;
  dayLabel: string;
  nightLabel: string;
  nowLabel: string;
  kindLabels: Record<ScheduleSlotKind, string>;
  activityFallback: string;
  showNowLine?: boolean;
  showLegend?: boolean;
  onSlotClick?: (slot: ScheduleSlot) => void;
  className?: string;
  footer?: ReactNode;
}) {
  const nowMs = useMinuteNow();
  const nowMin = localMinutesFromMs(nowMs);

  const prepared = useMemo(
    () => prepareSlots(slots, kindLabels, activityFallback),
    [slots, kindLabels, activityFallback]
  );

  const { dayRows, nightRows } = useMemo(() => {
    const day: PreparedSlot[] = [];
    const night: PreparedSlot[] = [];
    for (const row of prepared) {
      if (isNightMinute(row.startMin)) night.push(row);
      else day.push(row);
    }
    night.sort(
      (a, b) =>
        nightSortKey(a.startMin) - nightSortKey(b.startMin) ||
        a.slot.id.localeCompare(b.slot.id)
    );
    return { dayRows: day, nightRows: night };
  }, [prepared]);

  if (prepared.length === 0) {
    return (
      <div className={cn("min-w-0", className)}>
        <p className="text-[11px] text-muted leading-snug">{emptyLabel}</p>
      </div>
    );
  }

  const nowInDay = !isNightMinute(nowMin);

  return (
    <div className={cn("min-w-0", className)}>
      {guideHint ? (
        <p className="text-[11px] text-muted leading-snug mb-2">{guideHint}</p>
      ) : null}

      {showLegend ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5">
          {(
            [
              ["feed", kindLabels.feed],
              ["nap", kindLabels.nap],
              ["pump", kindLabels.pump],
            ] as const
          ).map(([kind, label]) => (
            <span
              key={kind}
              className="inline-flex items-center gap-1.5 text-[10px] text-muted"
            >
              <span
                className={cn("size-2 rounded-[2px]", kindBarClass(kind))}
                aria-hidden
              />
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {dayRows.length > 0 ? (
          <section className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
              {dayLabel}
            </p>
            <SectionList
              rows={dayRows}
              nowMin={nowMin}
              showNowLine={showNowLine && nowInDay}
              nowLabel={nowLabel}
              onSlotClick={onSlotClick}
            />
          </section>
        ) : null}

        {nightRows.length > 0 ? (
          <section className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
              {nightLabel}
            </p>
            <SectionList
              rows={nightRows}
              nowMin={nowMin}
              showNowLine={showNowLine && !nowInDay}
              nowLabel={nowLabel}
              onSlotClick={onSlotClick}
              axisKey={nightSortKey}
            />
          </section>
        ) : null}
      </div>

      {footer}
    </div>
  );
}
