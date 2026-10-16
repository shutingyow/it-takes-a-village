"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import { cn, formatDateTime, formatDuration } from "@/app/lib/utils";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconSleep } from "../icons";
import { EntryPhotoField } from "../EntryPhotoField";
import type { ActivityEntry } from "../ActivityEntryCard";

type SleepEditEntry = Extract<ActivityEntry, { entryType: "sleep" }>;

interface SleepModalProps {
  trackerId: Id<"trackers">;
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
  trackerId,
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
  const activeSleep = useQuery(
    api.sleepEntries.getActive,
    editEntry ? "skip" : { trackerId }
  );
  const lastSleep = useQuery(
    api.sleepEntries.getLast,
    editEntry ? "skip" : { trackerId }
  );
  const isEditing = Boolean(editEntry);

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
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>(
    editEntry?.photoIds ?? []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        trackerId,
        caregiverName: selectedCaregiver,
        type: sleepType,
        startTime: Date.now(),
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to start sleep:", error);
      alert(error instanceof Error ? error.message : t("failedToStartSleep"));
      setIsSubmitting(false);
    }
  };

  const handleEndSleep = async () => {
    if (!activeSleep) return;

    setIsSubmitting(true);
    try {
      await endSleep({
        entryId: activeSleep._id,
        endTime: Date.now(),
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to end sleep:", error);
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
        trackerId,
        caregiverName: selectedCaregiver,
        type: sleepType,
        startTime: pastStartTime,
        endTime: pastEndTime,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      });
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
        entryId: editEntry._id,
        type: sleepType,
        startTime: pastStartTime,
        endTime: editEntry.endTime != null ? pastEndTime : undefined,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update sleep:", error);
      alert(error instanceof Error ? error.message : t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  const photoField = (
    <EntryPhotoField
      secretLink={secretLink}
      selectedCaregiver={selectedCaregiver}
      photoIds={photoIds}
      onChange={setPhotoIds}
    />
  );

  if (isEditing && editEntry) {
    const hasEnd = editEntry.endTime != null;
    return (
      <BottomSheet
        title={t("editEntry")}
        icon={<IconSleep size={20} />}
        onClose={onClose}
      >
        <div className="space-y-4 pt-2">
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
                    sleepType === type
                      ? "btn-option-selected"
                      : "btn-option-default"
                  )}
                >
                  {type === "nap" ? t("nap") : t("night")}
                </button>
              ))}
            </div>
          </div>

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

          {hasEnd && pastDurationPreview && (
            <div className="bg-accent-sleep-light rounded-2xl p-4 text-center">
              <p className="text-sm text-muted mb-1">{t("durationPreview")}</p>
              <p className="text-2xl font-bold text-accent-sleep">
                {pastDurationPreview}
              </p>
            </div>
          )}

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
          activeSleep ? (
            <>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-accent-sleep-light flex items-center justify-center mx-auto mb-3">
                  <IconSleep size={32} className="text-accent-sleep" />
                </div>
                <p className="text-lg font-semibold text-foreground mb-3">
                  {t("babySleeping")}
                </p>
                <div className="bg-accent-sleep-light rounded-2xl p-5">
                  <p className="text-3xl font-bold text-accent-sleep">
                    {formatDuration(activeSleep.startTime)}
                  </p>
                  <p className="text-sm text-muted mt-2">
                    {t("startedByName", { name: activeSleep.caregiverName })}
                  </p>
                </div>
              </div>

              {photoField}

              <button
                type="button"
                onClick={handleEndSleep}
                disabled={isSubmitting}
                className="w-full bg-secondary hover:bg-secondary/90 text-white font-medium py-4 px-6 rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? t("ending") : t("endSleepNowButton")}
              </button>
            </>
          ) : (
            <>
              <div className="text-center py-2">
                <p className="text-sm text-muted">{t("currentlyAwake")}</p>
              </div>

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
                        sleepType === type
                          ? "btn-option-selected"
                          : "btn-option-default"
                      )}
                    >
                      {type === "nap" ? t("nap") : t("night")}
                    </button>
                  ))}
                </div>
              </div>

              {photoField}

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
                      sleepType === type
                        ? "btn-option-selected"
                        : "btn-option-default"
                    )}
                  >
                    {type === "nap" ? t("nap") : t("night")}
                  </button>
                ))}
              </div>
            </div>

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

            {pastDurationPreview && (
              <div className="bg-accent-sleep-light rounded-2xl p-4 text-center">
                <p className="text-sm text-muted mb-1">{t("durationPreview")}</p>
                <p className="text-2xl font-bold text-accent-sleep">
                  {pastDurationPreview}
                </p>
                <p className="text-xs text-muted mt-2">
                  {formatDateTime(pastStartTime)} → {formatDateTime(pastEndTime)}
                </p>
              </div>
            )}

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
