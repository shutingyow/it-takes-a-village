"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import {
  formatTime,
  formatMinutesCompact,
  getTodayBoundsInZone,
  progressPercent,
} from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  ActivityIcon,
  IconFeed,
  IconPump,
} from "./icons";
import { cn } from "@/app/lib/utils";

const GOALS = {
  feeds: 8,
  diapers: 6,
  pumps: 4,
};

interface SummaryGridProps {
  trackerId: Id<"trackers">;
}

function ProgressBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  return (
    <div className="h-1 rounded-full bg-black/10 overflow-hidden mt-auto">
      <div
        className={cn("h-full rounded-full transition-all", className)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function SummaryGrid({ trackerId }: SummaryGridProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const { dayStart, dayEnd } = useMemo(() => getTodayBoundsInZone(now), [now]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const summary = useQuery(api.dailySummary.getForDay, {
    trackerId,
    dayStart,
    dayEnd,
    now,
  });

  if (!summary) {
    return (
      <div className="px-3 sm:px-4 pb-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 sm:h-36 rounded-2xl bg-beige-light animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const diaperDetail =
    summary.lastDiaperType === "wet"
      ? t("wet")
      : summary.lastDiaperType === "dirty"
        ? t("dirty")
        : summary.lastDiaperType === "both"
          ? t("wetDirty")
          : "—";

  const cards = [
    {
      key: "feed",
      title: t("feed"),
      time: summary.lastFeedTime ? formatTime(summary.lastFeedTime) : null,
      stat: t("timesToday", { count: summary.feedCount }),
      detail:
        summary.feedTotalMinutes > 0
          ? t("feedDurationMinutes", { min: summary.feedTotalMinutes })
          : "—",
      percent: progressPercent(summary.feedCount, GOALS.feeds),
      bg: "bg-beige-light",
      text: "text-foreground",
      icon: <IconFeed size={16} className="text-accent-feed" />,
      bar: "bg-accent-feed",
    },
    {
      key: "diaper",
      title: t("diaper"),
      time: summary.lastDiaperTime
        ? formatTime(summary.lastDiaperTime)
        : null,
      stat: t("changesToday", { count: summary.diaperCount }),
      detail: diaperDetail,
      percent: progressPercent(summary.diaperCount, GOALS.diapers),
      bg: "bg-accent-diaper",
      text: "text-white",
      icon: <ActivityIcon type="diaper" size={16} className="text-white" />,
      bar: "bg-white/80",
    },
    {
      key: "pump",
      title: t("pump"),
      time: null,
      stat: t("sessionsToday", { count: summary.pumpCount }),
      detail:
        summary.pumpTotalMl > 0 ? `${summary.pumpTotalMl} ml` : "—",
      percent: progressPercent(summary.pumpCount, GOALS.pumps),
      bg: "bg-beige-light",
      text: "text-foreground",
      icon: <IconPump size={16} className="text-muted" />,
      bar: "bg-muted",
    },
  ];

  return (
    <div className="px-3 sm:px-4 pb-5 min-w-0">
      <p className="section-label">{t("todaysSummary")}</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className={cn(
              "rounded-2xl p-2.5 sm:p-3.5 flex flex-col min-h-[8.25rem] sm:min-h-[9.5rem] min-w-0 card-shadow",
              card.bg,
              card.text
            )}
          >
            <div className="mb-2 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                {card.icon}
                <span className="text-[11px] sm:text-xs font-semibold opacity-90 truncate">
                  {card.title}
                </span>
              </div>
              {card.time && (
                <p className="text-[10px] font-medium opacity-70 mt-0.5 truncate">
                  {card.time}
                </p>
              )}
            </div>
            <p className="text-[13px] sm:text-base font-bold leading-tight break-words">
              {card.stat}
            </p>
            <p className="text-[11px] sm:text-xs opacity-75 mt-1 mb-2.5 leading-snug line-clamp-2">
              {card.detail}
            </p>
            <ProgressBar percent={card.percent} className={card.bar} />
          </div>
        ))}
      </div>
      <NapAwakeLine trackerId={trackerId} now={now} />
    </div>
  );
}

function NapAwakeLine({
  trackerId,
  now,
}: {
  trackerId: Id<"trackers">;
  now: number;
}) {
  const { t } = useLanguage();
  const status = useQuery(api.sleepEntries.getTodayNapStatus, {
    trackerId,
    now,
  });

  if (!status || status.state !== "awake") return null;

  return (
    <p className="mt-2.5 flex items-center gap-1.5 min-w-0 text-xs text-muted">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-sleep shrink-0" />
      <span className="font-medium text-foreground truncate">
        {t("awakeFor", { time: formatMinutesCompact(status.awakeMinutes) })}
      </span>
    </p>
  );
}
