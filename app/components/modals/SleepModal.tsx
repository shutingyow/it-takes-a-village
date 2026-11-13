"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import { cn, formatDateTime, formatDuration } from "@/app/lib/utils";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconSleep } from "../icons";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";

type SleepEditEntry = Extract<
  ActivityEntry,
  { entryType: "sleep" | "nap" }
>;

interface SleepModalProps {
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: SleepEditEntry;
}

type SleepMode = "live" | "past";

function toDatetimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function getDefaultPastTimes(lastSleepEnd?: number) {
  const now = Date.now();
  const defaultStart = lastSleepEnd ?? now - 2 * 60 * 60 * 1000;
  return {
    start: toDatetimeLocalValue(defaultStart),
    end: toDatetimeLocalValue(now),
  };
}

export function SleepModal({
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: SleepModalProps) {
  const { t } = useLanguage();
  const startSleep = useMutation(api.sleepEntries.start);
  const endSleep = useMutation(api.sleepEntries.end);
  const createSleep = useMutation(api.sleepEntries.create);
  const updateSleep = useMutation(api.sleepEntries.update);
  const isEditing = Boolean(editEntry);
  const isEditingActive =
    Boolean(editEntry) && editEntry != null && editEntry.endTime == null;
  // Always load village-wide active sleep when logging new sleep, so we show
  // End instead of Start if someone else's timer is already running.
  const activeSleep = useQuery(
    api.sleepEntries.getActive,
    isEditing && !isEditingActive
      ? "skip"
      : { secretLink, actingCaregiverName: selectedCaregiver }
  );
  const lastSleep = useQuery(
    api.sleepEntries.getLast,
    isEditing ? "skip" : { secretLink, actingCaregiverName: selectedCaregiver }
  );
  const liveSession =
    isEditingActive && editEntry
      ? {
          _id: editEntry._id,
          startTime: editEntry.startTime,
          caregiverName: editEntry.caregiverName,
          type: editEntry.type,
        }
      : activeSleep ?? null;

  const [mode, setMode] = useState<SleepMode>("live");
  const [sleepType, setSleepType] = useState<"nap" | "night">(
    editEntry?.type ?? "nap"
  );
  const [startDateTime, setStartDateTime] = useState(() =>
    toDatetimeLocalValue(
      editEntry?.startTime ?? Date.now() - 2 * 60 * 60 * 1000
    )
  );
  const [endDateTime, setEndDateTime] = useState(() =>
    toDatetimeLocalValue(
      editEntry?.endTime ?? editEntry?.startTime ?? Date.now()
    )
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveNow, setLiveNow] = useState(() => Date.now());

  const pastStartTime = useMemo(
    () => new Date(startDateTime).getTime(),
    [startDateTime]
  );
  const pastEndTime = useMemo(
    () => new Date(endDateTime).getTime(),
    [endDateTime]
  );

  const pastDurationPreview = useMemo(() => {
    if (!startDateTime || !endDateTime || pastEndTime <= pastStartTime) {
      return null;
    }
    return formatDuration(pastStartTime, pastEndTime);
  }, [startDateTime, endDateTime, pastStartTime, pastEndTime]);

  useEffect(() => {
    if (!liveSession) return;
    const id = window.setInterval(() => setLiveNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [liveSession?._id, liveSession]);

  const switchToPastMode = () => {
    const defaults = getDefaultPastTimes(lastSleep?.endTime);
    setStartDateTime(defaults.start);
    setEndDateTime(defaults.end);
    setMode("past");
  };

  const handleStartSleep = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    setIsSubmitting(true);
    try {
      await startSleep({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        type: sleepType,
        startTime: Date.now(),
      });
      const { hapticSuccess } = await import("@/app/lib/haptics");
      void hapticSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to start sleep:", error);
      alert(error instanceof Error ? error.message : t("failedToStartSleep"));
      setIsSubmitting(false);
    }
  };

  const handleEndSleep = async () => {
    if (!liveSession) return;

    setIsSubmitting(true);
    try {
      await endSleep({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        entryId: liveSession._id,
        endTime: Date.now(),
      });
      const { hapticSuccess } = await import("@/app/lib/haptics");
      void hapticSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to end sleep:", error);
      alert(error instanceof Error ? error.message : t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  const handleLogPastSleep = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    if (pastEndTime <= pastStartTime) {
      alert(t("pastSleepInvalidTime"));
      return;
    }

    if (pastEndTime > Date.now()) {
      alert(t("pastSleepFutureEnd"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createSleep({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        type: sleepType,
        startTime: pastStartTime,
        endTime: pastEndTime,
        notes: notes || undefined,
      });
      const { hapticSuccess } = await import("@/app/lib/haptics");
      void hapticSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to log past sleep:", error);
      alert(error instanceof Error ? error.message : t("failedToLogPastSleep"));
      setIsSubmitting(false);
    }
  };

  const handleUpdateSleep = async () => {
    if (!editEntry) return;

    if (editEntry.endTime != null && pastEndTime <= pastStartTime) {
      alert(t("pastSleepInvalidTime"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSleep({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        entryId: editEntry._id,
        type: sleepType,
        startTime: pastStartTime,
        endTime: editEntry.endTime != null ? pastEndTime : undefined,
        notes: notes || undefined,
      });
      const { hapticSuccess } = await import("@/app/lib/haptics");
      void hapticSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to update sleep:", error);
      alert(error instanceof Error ? error.message : t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  const sleepTypePicker = (
    <div>
      <label className="label-field">{t("sleepType")}</label>
      <div className="flex gap-2">
        {(["nap", "night"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSleepType(type)}
            className={cn(
              "btn-option flex-1",
              sleepType === type ? "btn-option-selected" : "btn-option-default"
            )}
          >
            {type === "nap" ? t("nap") : t("night")}
          </button>
        ))}
      </div>
    </div>
  );

  const notesField = (
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
  );

  const durationHint =
    pastDurationPreview != null ? (
      <p className="text-sm text-muted tabular-nums">
        {t("durationPreview")}: {pastDurationPreview}
      </p>
    ) : null;

  const liveTimerPanel = liveSession ? (
    <>
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-accent-sleep-light flex items-center justify-center mx-auto mb-3">
          <IconSleep size={32} className="text-accent-sleep" />
        </div>
        <p className="text-lg font-semibold text-foreground mb-3">
          {t("babySleeping")}
        </p>
        <div className="bg-accent-sleep-light rounded-2xl p-5">
          <p className="text-3xl font-bold text-accent-sleep tabular-nums">
            {formatDuration(liveSession.startTime, liveNow)}
          </p>
          <p className="text-sm text-muted mt-2">
            {t("startedByName", { name: liveSession.caregiverName })}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleEndSleep}
        disabled={isSubmitting}
        className="w-full bg-secondary hover:bg-secondary/90 text-white font-medium py-4 px-6 rounded-xl transition-colors disabled:opacity-50"
      >
        {isSubmitting ? t("ending") : t("endSleepNowButton")}
      </button>
    </>
  ) : null;

  // Editing an in-progress nap/sleep → same end-timer UI as Log Sleep.
  if (isEditingActive && editEntry) {
    return (
      <BottomSheet
        title={t("logSleep")}
        icon={<IconSleep size={20} />}
        onClose={onClose}
      >
        <div className="space-y-4 pt-2">
          <LoggedByHint name={editEntry.caregiverName} />
          {liveTimerPanel}
        </div>
      </BottomSheet>
    );
  }

  // Completed nap and night share one bedtime-style edit layout.
  if (isEditing && editEntry) {
    const hasEnd = editEntry.endTime != null;
    return (
      <BottomSheet
        title={t("editEntry")}
        icon={<IconSleep size={20} />}
        onClose={onClose}
      >
        <div className="space-y-4 pt-2">
          <LoggedByHint name={editEntry.caregiverName} />
          {sleepTypePicker}

          <div>
            <label className="label-field">{t("startTime")}</label>
            <input
              type="datetime-local"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
              className="input-field"
            />
          </div>

          {hasEnd && (
            <div>
              <label className="label-field">{t("endTime")}</label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="input-field"
              />
            </div>
          )}

          {hasEnd && durationHint}

          {notesField}

          <button
            type="button"
            onClick={handleUpdateSleep}
            disabled={isSubmitting || (hasEnd && !pastDurationPreview)}
            className="btn-primary"
          >
            {isSubmitting ? t("saving") : t("saveChanges")}
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title={t("logSleep")}
      icon={<IconSleep size={20} />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("live")}
            className={cn(
              "btn-option flex-1",
              mode === "live" ? "btn-option-selected" : "btn-option-default"
            )}
          >
            {t("sleepModeLive")}
          </button>
          <button
            type="button"
            onClick={switchToPastMode}
            className={cn(
              "btn-option flex-1",
              mode === "past" ? "btn-option-selected" : "btn-option-default"
            )}
          >
            {t("sleepModePast")}
          </button>
        </div>

        {mode === "live" ? (
          liveSession ? (
            liveTimerPanel
          ) : activeSleep === undefined ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted">{t("loadingHistory")}</p>
            </div>
          ) : (
            <>
              <div className="text-center py-2">
                <p className="text-sm text-muted">{t("currentlyAwake")}</p>
              </div>

              {sleepTypePicker}

              <button
                type="button"
                onClick={handleStartSleep}
                disabled={isSubmitting}
                className="w-full bg-accent-sleep hover:bg-accent-sleep/90 text-white font-medium py-4 px-6 rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? t("starting") : t("startSleepNowButton")}
              </button>
            </>
          )
        ) : (
          <>
            {sleepTypePicker}

            <div>
              <label className="label-field">{t("startTime")}</label>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-field">{t("endTime")}</label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="input-field"
              />
            </div>

            {durationHint}
            {pastDurationPreview && (
              <p className="text-xs text-muted">
                {formatDateTime(pastStartTime)} → {formatDateTime(pastEndTime)}
              </p>
            )}

            {notesField}

            <button
              type="button"
              onClick={handleLogPastSleep}
              disabled={isSubmitting || !pastDurationPreview}
              className="btn-primary"
            >
              {isSubmitting ? t("saving") : t("logPastSleep")}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
