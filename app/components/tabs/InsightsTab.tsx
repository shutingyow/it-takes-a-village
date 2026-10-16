"use client";

import { StatsView } from "../StatsView";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { Id } from "@/convex/_generated/dataModel";

interface InsightsTabProps {
  trackerId: Id<"trackers">;
  babyName?: string;
  birthDate?: string;
  secretLink: string;
  selectedCaregiver: string;
}

export function InsightsTab({
  trackerId,
  babyName,
  birthDate,
  secretLink,
  selectedCaregiver,
}: InsightsTabProps) {
  const { t } = useLanguage();

  return (
    <StatsView
      trackerId={trackerId}
      babyName={babyName}
      birthDate={birthDate}
      secretLink={secretLink}
      selectedCaregiver={selectedCaregiver}
      onBack={undefined}
      title={t("tabInsights")}
    />
  );
}
