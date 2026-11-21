"use client";

import { formatMinutesCompact } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconSleep } from "./icons";
import type { ActivityEntry } from "./ActivityEntryCard";
import { SwipeableRow } from "./SwipeableRow";

export type SleepActivityEntry = Extract<
  ActivityEntry,
  { entryType: "nap" | "sleep" }
>;

interface SleepIntervalListProps {
  entries: SleepActivityEntry[];
  /** Oldest-first matches Insights Daily. Newest-first matches History. */
  order?: "oldest" | "newest";
  onEdit?: (entry: SleepActivityEntry) => void;
  onDelete?: (entry: SleepActivityEntry) => void;
}

function sleepMinutes(entry: SleepActivityEntry): number | null {
  if (entry.durationMinutes != null && Number.isFinite(entry.durationMinutes)) {
    if (entry.durationMinutes <= 0) return null;
    return Math.round(entry.durationMinutes);
  }
  if (entry.endTime == null) return null;
  const minutes = Math.round((entry.endTime - entry.startTime) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes;
}

/** Awake minutes between an earlier sleep's end and a later sleep's start. */
function wakeGapMinutes(
  earlier: SleepActivityEntry,
  later: SleepActivityEntry
): number | null {
  if (earlier.endTime == null) return null;
  const minutes = Math.round((later.startTime - earlier.endTime) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return null;
  return minutes;
}

function IntervalBar({ minutes }: { minutes: number }) {
  const { t } = useLanguage();
  const label = formatMinutesCompact(minutes);

  return (
    <div
      className="flex items-center gap-2 py-1.5 min-w-0"
      role="separator"
      aria-label={t("wakingWindowAria", { time: label })}
    >
      <span className="h-px flex-1 min-w-3 bg-border" />
      <span className="text-[11px] font-medium text-accent-sleep tabular-nums shrink-0">
        ↕ {label}
      </span>
      <span className="h-px flex-1 min-w-3 bg-border" />
    </div>
  );
}

export function SleepIntervalList({
  entries,
  order = "oldest",
  onEdit,
  onDelete,
}: SleepIntervalListProps) {
  const { t, language } = useLanguage();

  const ordered = [...entries].sort((a, b) =>
    order === "newest" ? b.startTime - a.startTime : a.startTime - b.startTime
  );

  if (ordered.length === 0) return null;

  const formatClock = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString(language === "zh" ? "zh-CN" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <ul className="min-w-0">
        {ordered.map((entry, index) => {
          const minutes = sleepMinutes(entry);
          const neighbor =
            order === "newest" ? ordered[index + 1] : ordered[index - 1];
          // Neighbor is always the chronologically earlier sleep for gap math.
          const gap =
            neighbor == null ? null : wakeGapMinutes(neighbor, entry);
          const showBarBefore = order === "oldest" && gap != null;
          const showBarAfter = order === "newest" && gap != null;

          const startLabel = formatClock(entry.startTime);
          const timeLabel =
            entry.endTime == null
              ? startLabel
              : `${startLabel} – ${formatClock(entry.endTime)}`;

          const isNap = entry.entryType === "nap" || entry.type === "nap";
          const kind = isNap ? t("filterNap") : t("statsSleepBedtime");

          const row = (
            <div className="flex items-start gap-2.5 min-w-0 py-1.5 px-0.5">
              <div className="w-8 h-8 rounded-full bg-accent-sleep-light text-accent-sleep flex items-center justify-center shrink-0 mt-0.5">
                <IconSleep size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-snug break-words">
                  {timeLabel}
                </p>
                <p className="text-xs text-muted mt-0.5 truncate">{kind}</p>
                {(onEdit || onDelete) && (
                  <p className="text-[10px] text-muted/80 mt-1 sm:hidden">
                    {t("swipeHint")}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right leading-tight pt-0.5">
                {minutes != null ? (
                  <p className="text-sm font-medium text-foreground tabular-nums">
                    {formatMinutesCompact(minutes)}
                  </p>
                ) : entry.endTime == null ? (
                  <p className="text-xs text-muted">
                    {isNap ? t("nappingNow") : t("currentlySleeping")}
                  </p>
                ) : null}
              </div>
            </div>
          );

          return (
            <li key={entry._id} className="min-w-0">
              {showBarBefore && gap != null && <IntervalBar minutes={gap} />}
              {onEdit || onDelete ? (
                <SwipeableRow
                  editLabel={t("edit")}
                  deleteLabel={t("delete")}
                  contentClassName="bg-[var(--surface)]"
                  onEdit={onEdit ? () => onEdit(entry) : undefined}
                  onDelete={onDelete ? () => onDelete(entry) : undefined}
                >
                  {row}
                </SwipeableRow>
              ) : (
                row
              )}
              {showBarAfter && gap != null && <IntervalBar minutes={gap} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
