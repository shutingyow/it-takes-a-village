"use client";

import { useEffect, useState } from "react";
import { TodayHeader } from "../TodayHeader";
import {
  HomeCategoryGrid,
  type HomeCategory,
  type HomeTileCategory,
} from "../HomeCategoryGrid";
import { HomeCategoryDetail } from "../HomeCategoryDetail";
import { ReminderHomeCard } from "../ReminderHomeCard";
import { WellnessTipCard } from "../WellnessTipCard";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { getDeviceRemindersEnabled } from "@/app/lib/deviceNotifications";

interface HomeTabProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  babyName?: string;
  birthDate?: string;
  photoStorageId?: Id<"_storage">;
  lastFeed?: Doc<"feedEntries"> | null;
  lastDiaper?: Doc<"diaperEntries"> | null;
  pumpScheduleEnabled?: boolean;
  onViewAllHistory?: () => void;
  onQuickLog?: (type: HomeCategory) => void;
  onOpenReminders?: () => void;
}

export function HomeTab({
  trackerId,
  secretLink,
  selectedCaregiver,
  babyName,
  birthDate,
  photoStorageId,
  onQuickLog,
  onOpenReminders,
}: HomeTabProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<HomeCategory | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setRemindersEnabled(getDeviceRemindersEnabled());
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("deviceRemindersChanged", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("deviceRemindersChanged", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const villageFallback =
    !birthDate && babyName ? t("babyVillage", { name: babyName }) : undefined;

  if (category) {
    return (
      <HomeCategoryDetail
        category={category}
        trackerId={trackerId}
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
        trackerId={trackerId}
        onSelect={(cat: HomeTileCategory) => setCategory(cat)}
        onQuickLog={
          onQuickLog
            ? (cat: HomeTileCategory) => onQuickLog(cat)
            : undefined
        }
      />

      {onOpenReminders && (
        <ReminderHomeCard
          trackerId={trackerId}
          secretLink={secretLink}
          enabled={remindersEnabled}
          onOpen={onOpenReminders}
        />
      )}

      <WellnessTipCard />
    </div>
  );
}
