"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRef, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityIcon } from "../icons";
import { EntryTimeField } from "../EntryTimeField";
import { DurationMinutesField } from "../DurationMinutesField";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "../EntryTimeField";
import type { ActivityEntry } from "../ActivityEntryCard";

type NapEditEntry = Extract<ActivityEntry, { entryType: "nap" }>;

interface NapModalProps {
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: NapEditEntry;
}

function initialDuration(entry: NapEditEntry | undefined): number | null {
  if (!entry) return null;
  if (entry.durationMinutes && entry.durationMinutes > 0) {
    return entry.durationMinutes;
  }
  if (entry.endTime && entry.endTime > entry.startTime) {
    return Math.round((entry.endTime - entry.startTime) / 60000);
  }
  return null;
}

export function NapModal({
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: NapModalProps) {
  const { t } = useLanguage();
  const logNap = useMutation(api.sleepEntries.logNap);
  const updateNap = useMutation(api.sleepEntries.updateNap);
  const isEditing = Boolean(editEntry);

  const [startTime, setStartTime] = useState(
    () => editEntry?.startTime ?? Date.now()
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(() =>
    initialDuration(editEntry)
  );
  const [endTime, setEndTime] = useState<number | null>(
    editEntry?.endTime ?? null
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // New naps start at "now". A typed duration means the nap already happened,
  // so an untouched start is shifted back and the nap ends now.
  const autoStartRef = useRef(!isEditing);

  const handleStartChange = (next: number) => {
    setStartTime(next);
    autoStartRef.current = Math.abs(next - Date.now()) <= 2_000;
  };

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    const now = Date.now();
    let resolvedStart = startTime;
    let resolvedEnd = endTime ?? undefined;
    let resolvedMinutes = durationMinutes ?? undefined;
    if (resolvedEnd == null && resolvedMinutes != null) {
      const forwardEnd = resolvedStart + resolvedMinutes * 60_000;
      if (forwardEnd <= now) {
        resolvedEnd = forwardEnd;
      } else if (autoStartRef.current) {
        resolvedEnd = now;
        resolvedStart = now - resolvedMinutes * 60_000;
      } else {
        alert(t("pastSleepFutureEnd"));
        return;
      }
    }
    if (resolvedEnd != null && resolvedEnd <= resolvedStart) {
      alert(t("pastSleepInvalidTime"));
      return;
    }
    if (resolvedEnd != null && resolvedEnd > now) {
      alert(t("pastSleepFutureEnd"));
      return;
    }
    if (resolvedEnd != null) {
      resolvedMinutes = Math.max(
        1,
        Math.round((resolvedEnd - resolvedStart) / 60_000)
      );
    }

    setIsSubmitting(true);
    try {
      const payload = {
        startTime: resolvedStart,
        endTime: resolvedEnd,
        durationMinutes: resolvedMinutes,
        notes: notes || undefined,
      };
      if (editEntry) {
        await updateNap({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: editEntry._id,
          ...payload,
        });
      } else {
        await logNap({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          ...payload,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save nap:", error);
      alert(error instanceof Error ? error.message : t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("napLogTitle")}
      icon={<ActivityIcon type="nap" size={20} className="text-accent-sleep" />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2 min-w-0">
        <EntryTimeField
          value={startTime}
          onChange={handleStartChange}
          label={t("napStartLabel")}
        />

        <DurationMinutesField
          id="nap-duration-minutes"
          label={t("feedDurationOptional")}
          hint={t("napDurationHint")}
          value={durationMinutes}
          onChange={setDurationMinutes}
        />

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="label-field mb-0" htmlFor="nap-end-time">
              {t("napEndLabel")}
            </label>
            {endTime != null ? (
              <button
                type="button"
                onClick={() => setEndTime(null)}
                className="min-h-11 px-2 text-xs font-semibold text-terracotta touch-manipulation"
              >
                {t("clearEndTime")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setEndTime(
                    startTime + (durationMinutes ?? 30) * 60_000 > Date.now()
                      ? Date.now()
                      : startTime + (durationMinutes ?? 30) * 60_000
                  )
                }
                className="min-h-11 px-2 text-xs font-semibold text-primary touch-manipulation"
              >
                {t("addEndTime")}
              </button>
            )}
          </div>
          {endTime != null && (
            <input
              id="nap-end-time"
              type="datetime-local"
              value={toDatetimeLocalValue(endTime)}
              onChange={(e) => setEndTime(fromDatetimeLocalValue(e.target.value))}
              className="input-field"
            />
          )}
          <p className="text-xs text-muted mt-1.5">{t("napEndHint")}</p>
          <p className="text-xs text-muted mt-1">{t("napStillGoing")}</p>
        </div>

        <div>
          <label className="label-field">{t("notesOptional")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="textarea-field"
            rows={2}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting
            ? t("saving")
            : isEditing
              ? t("saveChanges")
              : t("saveEntry")}
        </button>
      </div>
    </BottomSheet>
  );
}
