"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import {
  clearFeedTimer,
  feedTimerStorageKey,
} from "@/app/lib/feedTimer";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconFeed } from "../icons";
import { EntryPhotoField } from "../EntryPhotoField";
import { EntryTimeField } from "../EntryTimeField";
import { FeedTimer } from "../FeedTimer";
import type { ActivityEntry } from "../ActivityEntryCard";

type FeedEditEntry = Extract<ActivityEntry, { entryType: "feed" }>;

interface FeedModalProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: FeedEditEntry;
}

type BottleTemperature = "room" | "warm40";
type BottleMilk = "formula" | "breastmilk";

const MAX_DURATION_MINUTES = 24 * 60;

function DurationMinutesField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const { t } = useLanguage();

  const setFromDigits = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") {
      onChange(null);
      return;
    }
    const parsed = Number.parseInt(digits, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      onChange(null);
      return;
    }
    onChange(Math.min(MAX_DURATION_MINUTES, parsed));
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <label htmlFor="feed-duration-minutes" className="label-field mb-0">
          {t("feedDurationLabel")}
        </label>
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 px-2 text-xs font-semibold text-terracotta touch-manipulation"
          >
            {t("clearDuration")}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 min-w-0">
        <input
          id="feed-duration-minutes"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="—"
          value={value ?? ""}
          onChange={(e) => setFromDigits(e.target.value)}
          className="input-field w-28 shrink-0 text-center text-lg font-semibold tabular-nums"
          aria-label={`${t("feedDurationLabel")} (${t("durationMinutesUnit")})`}
        />
        <span className="text-sm text-muted">{t("durationMinutesUnit")}</span>
      </div>
      <p className="text-xs text-muted mt-1.5">{t("feedDurationHint")}</p>
    </div>
  );
}

function inferBottleMilk(entry: FeedEditEntry): BottleMilk | undefined {
  if (entry.bottleMilk === "formula" || entry.bottleMilk === "breastmilk") {
    return entry.bottleMilk;
  }
  const notes = entry.notes?.toLowerCase() ?? "";
  if (notes.includes("breastmilk") || notes.includes("breast milk")) {
    return "breastmilk";
  }
  if (notes.includes("formula")) {
    return "formula";
  }
  return undefined;
}

export function FeedModal({
  trackerId,
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: FeedModalProps) {
  const { t } = useLanguage();
  const createFeed = useMutation(api.feedEntries.create);
  const updateFeed = useMutation(api.feedEntries.update);
  const isEditing = Boolean(editEntry);

  const [step, setStep] = useState<"type" | "details">(
    editEntry ? "details" : "type"
  );
  const [feedType, setFeedType] = useState<"breast" | "bottle">(
    editEntry?.type ?? "breast"
  );
  const [side, setSide] = useState<"left" | "right">(
    editEntry?.side ?? "left"
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(() => {
    const minutes = editEntry?.durationMinutes ?? editEntry?.duration;
    return minutes && minutes > 0 ? minutes : null;
  });
  const [amount, setAmount] = useState(editEntry?.amount ?? 120);
  const [bottleMilk, setBottleMilk] = useState<BottleMilk | undefined>(() =>
    editEntry && editEntry.type === "bottle"
      ? inferBottleMilk(editEntry)
      : undefined
  );
  const [bottleTemperature, setBottleTemperature] = useState<
    BottleTemperature | undefined
  >(
    editEntry?.bottleTemperature === "room" ||
      editEntry?.bottleTemperature === "warm40"
      ? editEntry.bottleTemperature
      : undefined
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>(
    editEntry?.photoIds ?? []
  );
  const [timestamp, setTimestamp] = useState(
    () => editEntry?.timestamp ?? Date.now()
  );
  const [timeTouched, setTimeTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerKey = feedTimerStorageKey(secretLink, editEntry?._id);
  const shouldStampStart = !isEditing && !timeTouched;

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }
    if (feedType === "bottle" && !bottleMilk) {
      alert(t("selectBottleMilk"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type: feedType,
        side: feedType === "breast" ? side : undefined,
        duration: durationMinutes ?? undefined,
        durationMinutes: durationMinutes ?? undefined,
        amount: feedType === "bottle" ? amount : undefined,
        bottleMilk: feedType === "bottle" ? bottleMilk : undefined,
        bottleTemperature:
          feedType === "bottle" ? bottleTemperature : undefined,
        timestamp,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      };

      if (editEntry) {
        await updateFeed({ entryId: editEntry._id, ...payload });
      } else {
        await createFeed({
          trackerId,
          caregiverName: selectedCaregiver,
          ...payload,
        });
      }
      clearFeedTimer(timerKey);
      onClose();
    } catch (error) {
      console.error("Failed to save feed:", error);
      alert(t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  const durationSection = (
    <>
      <FeedTimer
        storageKey={timerKey}
        onDurationMinutes={setDurationMinutes}
        shouldStampStart={shouldStampStart}
        onStampStart={setTimestamp}
      />
      <DurationMinutesField
        value={durationMinutes}
        onChange={setDurationMinutes}
      />
    </>
  );

  const timeField = (
    <EntryTimeField
      value={timestamp}
      onChange={(next) => {
        setTimeTouched(true);
        setTimestamp(next);
      }}
    />
  );

  const photoField = (
    <EntryPhotoField
      secretLink={secretLink}
      selectedCaregiver={selectedCaregiver}
      photoIds={photoIds}
      onChange={setPhotoIds}
    />
  );

  const saveLabel = isSubmitting
    ? t("saving")
    : isEditing
      ? t("saveChanges")
      : t("saveEntry");

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("logFeed")}
      icon={<IconFeed size={20} />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        {step === "type" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("selectFeedType")}</p>
            <button
              type="button"
              onClick={() => {
                setFeedType("breast");
                setBottleMilk(undefined);
                setStep("details");
              }}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              {t("breastFeeding")}
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedType("bottle");
                setBottleMilk(undefined);
                setStep("details");
              }}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              {t("bottleFeeding")}
            </button>
          </div>
        )}

        {step === "details" && feedType === "breast" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("type")}
              className="text-sm text-primary font-medium"
            >
              {t("changeType")}
            </button>

            {durationSection}

            <div>
              <label className="label-field">{t("sideOptional")}</label>
              <div className="flex gap-2">
                {(["left", "right"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={cn(
                      "btn-option flex-1",
                      side === s ? "btn-option-selected" : "btn-option-default"
                    )}
                  >
                    {s === "left" ? t("left") : t("right")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-field">{t("notesOptional")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("feedNotesPlaceholder")}
                className="textarea-field"
                rows={2}
              />
            </div>

            {photoField}

            {timeField}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary"
            >
              {saveLabel}
            </button>
          </div>
        )}

        {step === "details" && feedType === "bottle" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("type")}
              className="text-sm text-primary font-medium"
            >
              {t("changeType")}
            </button>

            {durationSection}

            <div>
              <label className="label-field">{t("bottleMilkType")}</label>
              <div className="flex gap-2">
                {(
                  [
                    { id: "formula" as const, label: t("formula") },
                    { id: "breastmilk" as const, label: t("breastMilk") },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBottleMilk(opt.id)}
                    className={cn(
                      "btn-option flex-1 py-3.5 text-base",
                      bottleMilk === opt.id
                        ? "btn-option-selected"
                        : "btn-option-default"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {!bottleMilk && (
                <p className="mt-1.5 text-xs text-muted">{t("selectBottleMilk")}</p>
              )}
            </div>

            <div>
              <label className="label-field">{t("amountMl", { amount })}</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAmount(Math.max(10, amount - 10))}
                  className="w-10 h-10 rounded-xl bg-[#f3ede7] text-foreground font-semibold"
                >
                  −
                </button>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <button
                  type="button"
                  onClick={() => setAmount(Math.min(300, amount + 10))}
                  className="w-10 h-10 rounded-xl bg-[#f3ede7] text-foreground font-semibold"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="label-field">{t("bottleTemperature")}</label>
              <div className="flex gap-2">
                {(
                  [
                    { id: "room" as const, label: t("bottleTempRoom") },
                    { id: "warm40" as const, label: t("bottleTempWarm40") },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setBottleTemperature(
                        bottleTemperature === opt.id ? undefined : opt.id
                      )
                    }
                    className={cn(
                      "btn-option flex-1",
                      bottleTemperature === opt.id
                        ? "btn-option-selected"
                        : "btn-option-default"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-field">{t("notesOptional")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("observationsPlaceholder")}
                className="textarea-field"
                rows={2}
              />
            </div>

            {photoField}

            {timeField}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !bottleMilk}
              className="btn-primary"
            >
              {saveLabel}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
