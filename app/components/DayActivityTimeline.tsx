"use client";

import { useEffect, useState } from "react";
import { formatMinutesCompact, formatTime } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityEntryCard, type ActivityEntry } from "./ActivityEntryCard";

type DayEntry = Extract<ActivityEntry, { time: number }>;

interface DayActivityTimelineProps {
  entries: DayEntry[];
  isToday: boolean;
  onEdit?: (entry: ActivityEntry) => void;
  onDelete?: (entry: ActivityEntry) => void;
}

function WakeWindowBar({
  minutes,
  current = false,
}: {
  minutes: number;
  current?: boolean;
}) {
  const { t } = useLanguage();
  if (!current && minutes < 1) return null;
  const time = formatMinutesCompact(minutes);
  const label = t("wakingWindow", { time });

  return (
    <div
      className="flex items-center gap-2 py-1.5 min-w-0"
      role="separator"
      aria-label={t("wakingWindowAria", { time })}
    >
      <span className="h-px flex-1 min-w-3 bg-accent-sleep/40" />
      <span className="text-[11px] font-medium text-accent-sleep tabular-nums shrink-0">
        ↕ {label}
      </span>
      <span className="h-px flex-1 min-w-3 bg-accent-sleep/40" />
    </div>
  );
}

export function DayActivityTimeline({
  entries,
  isToday,
  onEdit,
  onDelete,
}: DayActivityTimelineProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const naps = entries.filter(
    (entry): entry is Extract<DayEntry, { entryType: "nap" }> =>
      entry.entryType === "nap"
  );
  const lastNap = naps.length > 0 ? naps[naps.length - 1] : undefined;

  const trailingMinutes =
    isToday && lastNap?.endTime != null && lastNap.endTime <= now
      ? Math.max(0, Math.round((now - lastNap.endTime) / 60_000))
      : null;

  return (
    <div className="pl-1 min-w-0">
      {entries.map((entry, index) => {
        const wakeBefore =
          entry.entryType === "nap" ? entry.wakeWindowBeforeMinutes : null;

        return (
          <div key={entry._id} className="min-w-0">
            {wakeBefore != null && <WakeWindowBar minutes={wakeBefore} />}
            <ActivityEntryCard
              entry={entry}
              timeLabel={formatTime(entry.time)}
              isLast={index === entries.length - 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        );
      })}
      {trailingMinutes != null && (
        <WakeWindowBar minutes={trailingMinutes} current />
      )}
    </div>
  );
}
