"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { buildFeedingInsight } from "@/app/lib/feedingInsightCopy";

interface FeedingInsightProps {
  secretLink: string;
  selectedCaregiver: string;
  mode: "daily" | "weekly";
  dateKey: string;
  isToday: boolean;
}

export function FeedingInsight({
  secretLink,
  selectedCaregiver,
  mode,
  dateKey,
  isToday,
}: FeedingInsightProps) {
  const { t, language } = useLanguage();
  const data = useQuery(api.stats.getFeedingTrend, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    mode,
    dateKey,
  });

  const ready =
    data !== undefined && data.mode === mode && data.dateKey === dateKey;
  const text = ready
    ? buildFeedingInsight({
        language,
        mode,
        isToday,
        current: data.current,
        previous: data.previous,
        countDirection: data.countDirection,
        volumeDirection: data.volumeDirection,
        intervalDirection: data.intervalDirection,
      })
    : null;

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4 min-w-0">
      <p className="text-sm font-semibold text-foreground mb-1.5">
        {t("feedingTitle")}
      </p>
      <p className="text-sm text-foreground leading-relaxed break-words">
        {text ?? t("loading")}
      </p>
    </div>
  );
}
