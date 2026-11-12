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
  onQuickLog,
}: HomeTabProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<HomeCategory | null>(null);
  const [showDueDetail, setShowDueDetail] = useState(false);

  const villageFallback =
    !birthDate && babyName ? t("babyVillage", { name: babyName }) : undefined;

  if (showDueDetail) {
    return (
      <DueSoonCard
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        pumpScheduleEnabled={pumpScheduleEnabled}
        detail
        onBack={() => setShowDueDetail(false)}
      />
    );
  }

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
    <div className="flex flex-col min-h-full min-w-0">
      <TodayHeader
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        babyName={babyName}
        birthDate={birthDate}
        photoStorageId={photoStorageId}
        villageFallback={villageFallback}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <HomeCategoryGrid
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
          timezone={timezone}
          showPump={!!pumpScheduleEnabled}
          fillHeight
          onSelect={(cat: HomeTileCategory) => setCategory(cat)}
          onQuickLog={
            onQuickLog
              ? (cat: HomeTileCategory) => onQuickLog(cat)
              : undefined
          }
        />
      </div>

      <DueSoonCard
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        pumpScheduleEnabled={pumpScheduleEnabled}
        onOpenDetail={() => setShowDueDetail(true)}
      />
    </div>
  );
}
