"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getTodayBoundsInZone } from "@/app/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityIcon } from "./icons";

interface DailySummaryProps {
  trackerId: Id<"trackers">;
}

export function DailySummary({ trackerId }: DailySummaryProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const { dayStart, dayEnd } = useMemo(() => getTodayBoundsInZone(now), [now]);

  const stats = [
    { key: "feedCount" as const, type: "feed" as const, label: t("feeds") },
    { key: "diaperCount" as const, type: "diaper" as const, label: t("diapers") },
    { key: "pumpCount" as const, type: "pump" as const, label: t("pumps") },
  ];

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

  if (summary === undefined) {
    return (
      <div className="mx-4 mb-4 bg-surface rounded-xl border border-border p-4 card-shadow animate-pulse">
        <div className="h-4 bg-border rounded w-24 mb-3" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-border rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const iconColor: Record<string, string> = {
    feed: "text-accent-feed",
    diaper: "text-accent-diaper",
    pump: "text-accent-pump",
  };

  return (
    <div className="mx-4 mb-4 bg-surface rounded-xl border border-border p-4 card-shadow">
      <p className="section-label">{t("today")}</p>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => {
          const value = summary[stat.key];

          return (
            <div
              key={stat.key}
              className="bg-background rounded-lg py-2.5 px-1 text-center border border-border/50"
            >
              <div className="flex justify-center mb-1">
                <ActivityIcon
                  type={stat.type}
                  size={14}
                  className={iconColor[stat.type]}
                />
              </div>
              <div className="text-base font-semibold text-foreground leading-tight">
                {value}
              </div>
              <div className="text-[10px] text-muted font-medium mt-0.5">
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
