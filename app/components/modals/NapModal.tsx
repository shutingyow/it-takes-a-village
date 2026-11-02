"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityIcon } from "../icons";
import { EntryWhenFields } from "../EntryWhenFields";
import { FeedTimer } from "../FeedTimer";
import {
  clearFeedTimer,
  isNapTimerRecording,
  napTimerStorageKey,
} from "@/app/lib/feedTimer";
import { hapticSuccess } from "@/app/lib/haptics";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";

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
  const [endTime, setEndTime] = useState(
    () => editEntry?.endTime ?? Date.now()
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(() =>
    initialDuration(editEntry)
  );
  const [timeLive, setTimeLive] = useState(
    () => !editEntry && isNapTimerRecording(secretLink)
  );
  const [timeTouched, setTimeTouched] = useState(false);
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerKey = napTimerStorageKey(secretLink, editEntry?._id);
  const shouldStampStart = !isEditing && !timeTouched;

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    const now = Date.now();
    const liveRecording = timeLive && isNapTimerRecording(secretLink);
    let resolvedStart = startTime;
    let resolvedEnd: number | undefined = endTime;
    let resolvedMinutes = durationMinutes ?? undefined;

    // Live timer still running → log an ongoing nap (no end yet).
    if (liveRecording) {
      resolvedEnd = undefined;
      resolvedMinutes = undefined;
    } else {
      if (resolvedEnd <= resolvedStart && resolvedMinutes != null) {
        resolvedEnd = resolvedStart + resolvedMinutes * 60_000;
      }
      if (resolvedEnd <= resolvedStart) {
        alert(t("pastSleepInvalidTime"));
        return;
      }
      if (resolvedEnd > now) {
        alert(t("pastSleepFutureEnd"));
        return;
      }
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
      if (!liveRecording) {
        clearFeedTimer(timerKey);
      }
      void hapticSuccess();
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
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}

        <EntryWhenFields
          startAt={startTime}
          endAt={endTime}
          onStartChange={(next) => {
            setTimeTouched(true);
            setStartTime(next);
          }}
          onEndChange={(next) => {
            setTimeTouched(true);
            setEndTime(next);
          }}
        />

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[#faf6f2] px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("timeItLive")}
            </p>
            <p className="text-xs text-muted leading-snug">
              {t("timeItLiveHint")}
            </p>
          </div>
          <input
            type="checkbox"
            checked={timeLive}
            onChange={(e) => setTimeLive(e.target.checked)}
            className="size-4 accent-primary shrink-0"
          />
        </label>

        {timeLive && (
          <FeedTimer
            storageKey={timerKey}
            label={t("napTimerLabel")}
            hint={t("napTimerHint")}
            onDurationMinutes={setDurationMinutes}
            shouldStampStart={shouldStampStart}
            onStampStart={(startMs) => {
              setStartTime(startMs);
              setTimeTouched(true);
            }}
            onStampEnd={(endMs) => {
              setEndTime(endMs);
              setTimeTouched(true);
            }}
          />
        )}

        {timeLive && (
          <p className="text-xs text-muted">{t("napStillGoing")}</p>
        )}

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
