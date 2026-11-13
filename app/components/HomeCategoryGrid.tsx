"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import {
  formatMinutesCompact,
  formatOngoingMinutes,
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
    labelKey: "sleep",
    icon: "nap",
    fill: "bg-accent-sleep-light",
  },
];

interface HomeCategoryGridProps {
  secretLink: string;
  selectedCaregiver: string;
  /** Village IANA timezone for “today” bounds. */
  timezone?: string;
  /** When false, hide the pump tile (exclusive breastfeeding / no pumping). */
  showPump?: boolean;
  /** Stretch tiles to fill remaining Today height. */
  fillHeight?: boolean;
  onSelect: (category: HomeTileCategory) => void;
  onQuickLog?: (category: HomeTileCategory) => void;
}

export function HomeCategoryGrid({
  secretLink,
  selectedCaregiver,
  timezone,
  showPump = true,
  fillHeight = false,
  onSelect,
  onQuickLog,
}: HomeCategoryGridProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const { dayStart, dayEnd } = useMemo(
    () => getTodayBoundsInZone(now, timezone),
    [now, timezone]
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const summaries = useQuery(api.homeDashboard.getTileSummaries, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    dayStart,
    dayEnd,
    now,
  });
  const dueStatus = useQuery(api.reminders.getDueStatus, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    now,
  });
  const feedDue = dueStatus?.items.find((item) => item.type === "feed");

  /** Single compact line under the title. */
  const summaryFor = (id: HomeTileCategory): string => {
    if (!summaries) return "…";

    if (id === "feed") {
      if (!summaries.feed) return t("noLastEntryYet");
      if (summaries.feed.active) {
        return t("feedOngoingBanner", {
          minutes: formatOngoingMinutes(summaries.feed.timestamp, now),
        });
      }
      const bits = [formatTimeAgo(summaries.feed.timestamp)];
      const amountMl =
        "amountMl" in summaries.feed ? summaries.feed.amountMl : undefined;
      if (amountMl !== undefined) {
        bits.push(t("amountMlShort", { amount: amountMl }));
      } else if (feedDue && feedDue.status !== "ongoing") {
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
      const mins =
        summaries.nap.durationMinutes ??
        formatOngoingMinutes(summaries.nap.startTime, now);
      const label =
        summaries.nap.type === "night" ? t("sleeping") : t("nappingNow");
      return `${label} · ${t("feedOngoingBanner", { minutes: mins })}`;
    }
    const ref = summaries.nap.endTime ?? summaries.nap.startTime;
    const lasted =
      summaries.nap.durationMinutes !== undefined
        ? t("napLasted", {
            time: formatMinutesCompact(summaries.nap.durationMinutes),
          })
        : "";
    const when = formatTimeAgo(ref);
    return lasted ? `${when}, ${lasted}` : when;
  };

  const visibleTiles = TILES.filter((cat) => showPump || cat.id !== "pump");

  return (
    <div
      className={cn(
        "px-4 pb-2 min-w-0",
        fillHeight && "flex-1 flex flex-col min-h-0"
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2.5",
          fillHeight && "flex-1 min-h-0"
        )}
      >
        {visibleTiles.map((cat) => {
          const summary = summaryFor(cat.id);
          return (
            <div
              key={cat.id}
              className={cn(
                cat.fill,
                "relative overflow-hidden rounded-[1.35rem] w-full shadow-sm",
                fillHeight ? "flex-1 min-h-[5.5rem]" : "min-h-[5.75rem]"
              )}
            >
              <div
                className={cn(
                  "relative flex items-center gap-3.5 w-full pl-4 pr-3.5 min-w-0",
                  fillHeight ? "h-full py-3.5" : "py-3.5"
                )}
              >
                <span
                  className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 flex items-center justify-center self-center"
                  aria-hidden
                >
                  <ActivityIcon
                    type={cat.icon}
                    size={28}
                    className="text-white stroke-[1.75]"
                  />
                </span>

                <button
                  type="button"
                  onClick={() => onSelect(cat.id)}
                  className="flex-1 min-w-0 self-center text-left touch-manipulation active:opacity-95 transition-opacity"
                >
                  <p className="text-[1.45rem] sm:text-[1.55rem] font-bold text-white leading-none tracking-tight truncate">
                    {t(cat.labelKey)}
                  </p>
                  <p className="mt-1.5 text-[14px] sm:text-[15px] font-medium text-white/90 leading-snug line-clamp-2 tabular-nums">
                    {summary}
                  </p>
                </button>

                {onQuickLog && (
                  <button
                    type="button"
                    aria-label={t("categoryLogCta", { type: t(cat.labelKey) })}
                    onClick={() => onQuickLog(cat.id)}
                    className="shrink-0 self-center w-12 h-12 rounded-full border-2 border-white/90 flex items-center justify-center text-white touch-manipulation active:scale-95"
                  >
                    <IconPlus size={20} className="text-white" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
