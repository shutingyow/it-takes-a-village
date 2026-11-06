"use client";

import { useState } from "react";
import { TodayHeader } from "../TodayHeader";
import {
  HomeCategoryGrid,
  type HomeCategory,
  type HomeTileCategory,
} from "../HomeCategoryGrid";
import { HomeCategoryDetail } from "../HomeCategoryDetail";
import { DueSoonCard } from "../DueSoonCard";
import { WellnessTipCard } from "../WellnessTipCard";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

interface HomeTabProps {
  secretLink: string;
  selectedCaregiver: string;
  babyName?: string;
  birthDate?: string;
  photoStorageId?: Id<"_storage">;
  timezone?: string;
  lastFeed?: Doc<"feedEntries"> | null;
  lastDiaper?: Doc<"diaperEntries"> | null;
  pumpScheduleEnabled?: boolean;
  onViewAllHistory?: () => void;
  onOpenMilestones?: () => void;
  onOpenSettings?: () => void;
  onQuickLog?: (type: HomeCategory) => void;
}

export function HomeTab({
  secretLink,
  selectedCaregiver,
  babyName,
  birthDate,
  photoStorageId,
  timezone,
  pumpScheduleEnabled,
  onOpenMilestones,
  onOpenSettings,
  onQuickLog,
}: HomeTabProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<HomeCategory | null>(null);

  const villageFallback =
    !birthDate && babyName ? t("babyVillage", { name: babyName }) : undefined;

  if (category) {
    return (
      <HomeCategoryDetail
        category={category}
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        onBack={() => setCategory(null)}
        onLog={(type) => onQuickLog?.(type)}
      />
    );
  }

  return (
    <div className="pb-2 min-w-0">
      <TodayHeader
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        babyName={babyName}
        birthDate={birthDate}
        photoStorageId={photoStorageId}
        villageFallback={villageFallback}
      />

      <HomeCategoryGrid
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        timezone={timezone}
        onSelect={(cat: HomeTileCategory) => setCategory(cat)}
        onQuickLog={
          onQuickLog
            ? (cat: HomeTileCategory) => onQuickLog(cat)
            : undefined
        }
      />

      <DueSoonCard
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        pumpScheduleEnabled={pumpScheduleEnabled}
      />

      <WellnessTipCard
        birthDate={birthDate}
        onOpenMilestones={onOpenMilestones}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
