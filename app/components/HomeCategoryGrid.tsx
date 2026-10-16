"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import {
  formatMinutesCompact,
  formatTimeAgo,
  getTodayBoundsInZone,
} from "@/app/lib/utils";
import { ActivityIcon, IconPlus, type ActivityType } from "./icons";
import { cn } from "@/app/lib/utils";

export type HomeCategory =
  | "feed"
  | "diaper"
  | "pump"
  | "activity"
  | "nap"
  | "moment";

/** Categories shown as Home tiles (Activity / Moments live under Log / History). */
export type HomeTileCategory = "feed" | "diaper" | "pump" | "nap";

const TILES: Array<{
  id: HomeTileCategory;
  labelKey: TranslationKey;
  icon: ActivityType;
  /** Saturated tile fill (SweetSpot-style). */
  fill: string;
}> = [
  {
    id: "feed",
    labelKey: "feed",
    icon: "feed",
    fill: "bg-accent-feed-light",
  },
  {
    id: "diaper",
    labelKey: "diaper",
    icon: "diaper",
    fill: "bg-accent-diaper-light",
  },
  {
    id: "pump",
    labelKey: "pump",
    icon: "pump",
    fill: "bg-accent-pump-light",
  },
  {
    id: "nap",
    labelKey: "nap",
    icon: "nap",
    fill: "bg-accent-sleep-light",
  },
];

interface HomeCategoryGridProps {
  trackerId: Id<"trackers">;
  onSelect: (category: HomeTileCategory) => void;
  onQuickLog?: (category: HomeTileCategory) => void;
}

export function HomeCategoryGrid({
  trackerId,
  onSelect,
  onQuickLog,
}: HomeCategoryGridProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const { dayStart, dayEnd } = useMemo(() => getTodayBoundsInZone(now), [now]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const summaries = useQuery(api.homeDashboard.getTileSummaries, {
    trackerId,
    dayStart,
    dayEnd,
    now,
  });
  const dueStatus = useQuery(api.reminders.getDueStatus, { trackerId, now });
  const feedDue = dueStatus?.items.find((item) => item.type === "feed");

  /** Single compact line under the title (reference: "10 mins ago, 80ml"). */
  const summaryFor = (id: HomeTileCategory): string => {
    if (!summaries) return "…";

    if (id === "feed") {
      if (!summaries.feed) return t("noLastEntryYet");
      const bits = [formatTimeAgo(summaries.feed.timestamp)];
      if (summaries.feed.amountMl !== undefined) {
        bits.push(t("amountMlShort", { amount: summaries.feed.amountMl }));
      } else if (feedDue) {
        bits.push(
          feedDue.status === "overdue"
            ? t("overdueBy", {
                time: formatMinutesCompact(feedDue.minutesUntilDue),
              })
            : t("nextFeedInShort", {
                time: formatMinutesCompact(feedDue.minutesUntilDue),
              })
        );
      }
      return bits.join(", ");
    }

    if (id === "diaper") {
      if (!summaries.diaper) return t("noLastEntryYet");
      const typeLabel =
        summaries.diaper.type === "wet"
          ? t("wet")
          : summaries.diaper.type === "dirty"
            ? t("dirty")
            : t("wetDirty");
      return `${formatTimeAgo(summaries.diaper.timestamp)} · ${typeLabel}`;
    }

    if (id === "pump") {
      if (!summaries.pump) return t("noLastEntryYet");
      return `${formatTimeAgo(summaries.pump.timestamp)}, ${t("amountMlShort", {
        amount: summaries.pump.amountMl,
      })} · ${t("sessionsToday", { count: summaries.pump.sessionsToday })}`;
    }

    if (!summaries.nap) return t("noLastEntryYet");
    if (summaries.nap.active) {
      const dur =
        summaries.nap.durationMinutes !== undefined
          ? t("napDurationSoFar", {
              time: formatMinutesCompact(summaries.nap.durationMinutes),
            })
          : "";
      return dur ? `${t("nappingNow")} · ${dur}` : t("nappingNow");
    }
    const ref = summaries.nap.endTime ?? summaries.nap.startTime;
    const lasted =
      summaries.nap.durationMinutes !== undefined
        ? t("napLasted", {
            time: formatMinutesCompact(summaries.nap.durationMinutes),
          })
        : "";
    return lasted
      ? `${formatTimeAgo(ref)}, ${lasted}`
      : formatTimeAgo(ref);
  };

  return (
    <div className="px-4 pb-2 min-w-0">
      <div className="flex flex-col gap-2.5">
        {TILES.map((cat) => {
          const summary = summaryFor(cat.id);
          return (
            <div
              key={cat.id}
              className={cn(
                cat.fill,
                "relative overflow-hidden rounded-[1.35rem] min-h-[5.75rem] w-full shadow-sm"
              )}
            >
              {/* Oversized line icon on the left (reference pattern) */}
              <span
                className="pointer-events-none absolute -left-1 top-1/2 -translate-y-1/2 opacity-[0.92]"
                aria-hidden
              >
                <ActivityIcon
                  type={cat.icon}
                  size={72}
                  className="text-white stroke-[1.35]"
                />
              </span>

              {onQuickLog && (
                <button
                  type="button"
                  aria-label={t("categoryLogCta", { type: t(cat.labelKey) })}
                  onClick={() => onQuickLog(cat.id)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full border-2 border-white/90 flex items-center justify-center text-white touch-manipulation active:scale-95"
                >
                  <IconPlus size={16} className="text-white" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className="relative w-full pl-[4.75rem] pr-12 py-4 min-w-0 text-left touch-manipulation active:opacity-95 transition-opacity"
              >
                <p className="text-[1.65rem] font-bold text-white leading-none tracking-tight truncate">
                  {t(cat.labelKey)}
                </p>
                <p className="mt-1.5 text-[15px] font-medium text-white/90 leading-snug line-clamp-2 tabular-nums">
                  {summary}
                </p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
