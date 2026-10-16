"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { cn } from "@/app/lib/utils";
import type { TranslationKey } from "@/app/lib/i18n/en";

type Mood = "happy" | "calm" | "tired" | "stressed" | "grateful";

const MOODS: Array<{ id: Mood; labelKey: TranslationKey }> = [
  { id: "happy", labelKey: "moodHappy" },
  { id: "calm", labelKey: "moodCalm" },
  { id: "tired", labelKey: "moodTired" },
  { id: "stressed", labelKey: "moodStressed" },
  { id: "grateful", labelKey: "moodGrateful" },
];

interface DailyDiarySectionProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  dateKey: string;
}

export function DailyDiarySection({
  trackerId,
  secretLink,
  selectedCaregiver,
  dateKey,
}: DailyDiarySectionProps) {
  const { t } = useLanguage();
  const diary = useQuery(api.diaryEntries.getForDay, { trackerId, dateKey });
  const upsert = useMutation(api.diaryEntries.upsert);

  const [content, setContent] = useState("");
  const [mood, setMood] = useState<Mood | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (diary === undefined) return;
    setContent(diary?.content ?? "");
    setMood(diary?.mood);
    setSavedFlash(false);
  }, [diary, dateKey]);

  const dirty =
    diary === undefined
      ? false
      : content.trim() !== (diary?.content ?? "").trim() ||
        mood !== diary?.mood;

  const handleSave = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }
    setIsSaving(true);
    try {
      await upsert({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        dateKey,
        content,
        mood,
      });
      setSavedFlash(true);
    } catch (error) {
      console.error("Failed to save diary:", error);
      alert(t("diarySaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
      <p className="text-sm font-semibold text-foreground mb-0.5">
        {t("diaryTitle")}
      </p>
      <p className="text-xs text-muted mb-3">{t("diaryPrompt")}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMood((prev) => (prev === m.id ? undefined : m.id))}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors touch-manipulation min-h-[36px]",
              mood === m.id
                ? "bg-terracotta text-white"
                : "bg-beige-light text-muted hover:text-foreground"
            )}
            aria-pressed={mood === m.id}
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSavedFlash(false);
        }}
        placeholder={t("diaryPlaceholder")}
        className="textarea-field"
        rows={3}
        disabled={diary === undefined}
      />

      <div className="flex items-center justify-between gap-2 mt-3">
        <p className="text-[11px] text-muted min-w-0">
          {savedFlash && !dirty
            ? t("diarySaved")
            : diary?.caregiverName
              ? t("diaryLastBy", { name: diary.caregiverName })
              : t("diaryOnePerDay")}
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || diary === undefined || !dirty}
          className={cn(
            "shrink-0 px-3 py-2 rounded-xl text-xs font-semibold touch-manipulation min-h-[40px]",
            dirty && !isSaving
              ? "bg-terracotta text-white"
              : "bg-beige-light text-muted cursor-not-allowed"
          )}
        >
          {isSaving ? t("saving") : t("saveDiary")}
        </button>
      </div>
    </div>
  );
}
