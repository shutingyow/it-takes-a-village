"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatBabyAge, formatHeaderDate } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { useState } from "react";
import { IconPlus } from "./icons";
import { BabyAvatar } from "./BabyAvatar";

interface TodayHeaderProps {
  secretLink: string;
  selectedCaregiver: string;
  babyName?: string;
  birthDate?: string;
  photoStorageId?: Id<"_storage">;
  villageFallback?: string;
}

export function TodayHeader({
  secretLink,
  selectedCaregiver,
  babyName,
  birthDate,
  photoStorageId,
  villageFallback,
}: TodayHeaderProps) {
  const { t } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);

  const generatePhotoUploadUrl = useMutation(api.trackers.generatePhotoUploadUrl);
  const updatePhoto = useMutation(api.trackers.updatePhoto);

  const trimmedBabyName = babyName?.trim();
  const mainTitle = trimmedBabyName || t("babyFallback");
  const age = birthDate ? formatBabyAge(birthDate) : null;
  const subtitle = age ?? villageFallback;

  const uploadPhoto = async (file: File) => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    setIsUploading(true);
    try {
      const postUrl = await generatePhotoUploadUrl({
        secretLink,
        actingCaregiverName: selectedCaregiver,
      });
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) {
        throw new Error(`Upload failed (${result.status})`);
      }
      const { storageId } = (await result.json()) as {
        storageId: Id<"_storage">;
      };
      if (!storageId) {
        throw new Error("Upload response missing storageId");
      }
      await updatePhoto({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        photoStorageId: storageId,
      });
    } catch (error) {
      console.error("Failed to upload baby photo:", error);
      alert(t("uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <header className="px-4 pt-1 pb-1">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase truncate">
            {formatHeaderDate()}
          </p>
          <h1 className="text-[clamp(1.5rem,7vw,1.85rem)] font-bold text-foreground leading-[1.1] mt-0.5 tracking-tight break-words">
            {mainTitle}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted mt-0.5 leading-snug truncate">
              {subtitle}
            </p>
          )}
        </div>

        <label
          className={`relative shrink-0 cursor-pointer touch-manipulation ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
          aria-label={photoStorageId ? t("changePhoto") : t("addPhoto")}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-beige-light border-[3px] border-beige flex items-center justify-center overflow-hidden shadow-sm">
            <BabyAvatar storageId={photoStorageId} alt={mainTitle} size="md" />
          </div>
          <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-terracotta text-white flex items-center justify-center border-[2px] border-background shadow-sm">
            <IconPlus size={12} strokeWidth={2.5} />
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </header>
  );
}
