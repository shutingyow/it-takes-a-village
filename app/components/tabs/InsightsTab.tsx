"use client";

import { StatsView } from "../StatsView";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

interface InsightsTabProps {
  babyName?: string;
  birthDate?: string;
  secretLink: string;
  selectedCaregiver: string;
  timezone?: string;
  canEditBirthDate?: boolean;
}

export function InsightsTab({
  babyName,
  birthDate,
  secretLink,
  selectedCaregiver,
  timezone,
  canEditBirthDate = false,
}: InsightsTabProps) {
  const { t } = useLanguage();

  return (
    <StatsView
      babyName={babyName}
      birthDate={birthDate}
      secretLink={secretLink}
      selectedCaregiver={selectedCaregiver}
      timezone={timezone}
      canEditBirthDate={canEditBirthDate}
      onBack={undefined}
      title={t("tabInsights")}
    />
  );
}
