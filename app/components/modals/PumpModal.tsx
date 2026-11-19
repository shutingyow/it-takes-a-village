"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconPump } from "../icons";
import { EntryPhotoField } from "../EntryPhotoField";
import { EntryTimeField } from "../EntryTimeField";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";
import { hapticSuccess } from "@/app/lib/haptics";
import {
  clearPumpTimer,
  elapsedMs,
  formatElapsed,
  loadPumpTimer,
  pumpTimerStorageKey,
  savePumpTimer,
  type PersistedPumpTimer,
} from "@/app/lib/pumpTimer";

type PumpEditEntry = Extract<ActivityEntry, { entryType: "pump" }>;
/** live = start; timing = active session panel; details = amount + save */
type PumpStep = "live" | "timing" | "details";

interface PumpModalProps {
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: PumpEditEntry;
}

function initialPumpStep(
  secretLink: string,
  editEntry?: PumpEditEntry
): PumpStep {
  if (editEntry) return "details";
  const timer = loadPumpTimer(pumpTimerStorageKey(secretLink));
  if (timer.status === "running" || timer.status === "paused") return "timing";
  if (timer.status === "stopped") return "details";
  return "live";
}

function formatLivePumpElapsed(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

export function PumpModal({
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: PumpModalProps) {
  const { t } = useLanguage();
  const createPump = useMutation(api.pumpEntries.create);
  const updatePump = useMutation(api.pumpEntries.update);
  const addBag = useMutation(api.milkStash.addBag);
  const isEditing = Boolean(editEntry);

  const [step, setStep] = useState<PumpStep>(() =>
    initialPumpStep(secretLink, editEntry)
  );
  const [pumpMode, setPumpMode] = useState<"live" | "past">("live");
  const [liveTimer, setLiveTimer] = useState<PersistedPumpTimer>(() =>
    loadPumpTimer(pumpTimerStorageKey(secretLink, editEntry?._id))
  );
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [amount, setAmount] = useState(editEntry?.amount ?? 150);
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>(
    editEntry?.photoIds ?? []
  );
  const [timestamp, setTimestamp] = useState(() => {
    if (editEntry?.timestamp) return editEntry.timestamp;
    const timer = loadPumpTimer(pumpTimerStorageKey(secretLink));
    if (
      (timer.status === "stopped" ||
        timer.status === "running" ||
        timer.status === "paused") &&
      timer.pumpStartedAt != null
    ) {
      return timer.pumpStartedAt;
    }
    return Date.now();
  });
  const [addToStash, setAddToStash] = useState(!editEntry);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerKey = pumpTimerStorageKey(secretLink, editEntry?._id);

  useEffect(() => {
    const refresh = () => {
      setLiveTimer(loadPumpTimer(timerKey));
      setLiveNow(Date.now());
    };
    refresh();
    window.addEventListener("pumpTimerChanged", refresh);
    return () => window.removeEventListener("pumpTimerChanged", refresh);
  }, [timerKey]);

  useEffect(() => {
    if (step !== "timing") return;
    if (liveTimer.status !== "running") return;
    const id = window.setInterval(() => setLiveNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [step, liveTimer.status]);

  const handleStartLivePump = () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }
    const startMs = Date.now();
    const next: PersistedPumpTimer = {
      status: "running",
      accumulatedMs: 0,
      segmentStartedAt: startMs,
      pumpStartedAt: startMs,
    };
    savePumpTimer(timerKey, next);
    setLiveTimer(next);
    setTimestamp(startMs);
    void hapticSuccess();
    onClose();
  };

  const handlePauseLivePump = () => {
    if (liveTimer.status !== "running" || liveTimer.segmentStartedAt == null) {
      return;
    }
    const pauseAt = Date.now();
    const next: PersistedPumpTimer = {
      ...liveTimer,
      status: "paused",
      accumulatedMs:
        liveTimer.accumulatedMs +
        Math.max(0, pauseAt - liveTimer.segmentStartedAt),
      segmentStartedAt: null,
    };
    savePumpTimer(timerKey, next);
    setLiveTimer(next);
    setLiveNow(pauseAt);
  };

  const handleResumeLivePump = () => {
    if (liveTimer.status !== "paused") return;
    const resumeAt = Date.now();
    const next: PersistedPumpTimer = {
      ...liveTimer,
      status: "running",
      segmentStartedAt: resumeAt,
    };
    savePumpTimer(timerKey, next);
    setLiveTimer(next);
    setLiveNow(resumeAt);
  };

  const handleEndLivePump = () => {
    const stopAt = Date.now();
    const total =
      liveTimer.status === "running" && liveTimer.segmentStartedAt != null
        ? liveTimer.accumulatedMs +
          Math.max(0, stopAt - liveTimer.segmentStartedAt)
        : liveTimer.accumulatedMs;
    const next: PersistedPumpTimer = {
      status: "stopped",
      accumulatedMs: total,
      segmentStartedAt: null,
      pumpStartedAt: liveTimer.pumpStartedAt,
    };
    savePumpTimer(timerKey, next);
    setLiveTimer(next);
    setLiveNow(stopAt);
    if (liveTimer.pumpStartedAt != null) {
      setTimestamp(liveTimer.pumpStartedAt);
    }
    setStep("details");
    void hapticSuccess();
  };

  const goPastPump = () => {
    setPumpMode("past");
    setStep("details");
  };

  const goLivePump = () => {
    clearPumpTimer(timerKey);
    const idle: PersistedPumpTimer = {
      status: "idle",
      accumulatedMs: 0,
      segmentStartedAt: null,
      pumpStartedAt: null,
    };
    setLiveTimer(idle);
    setPumpMode("live");
    setStep("live");
  };

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        amount,
        timestamp,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      };

      if (editEntry) {
        await updatePump({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: editEntry._id,
          ...payload,
        });
      } else {
        const pumpId = await createPump({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          ...payload,
        });
        if (addToStash && amount > 0) {
          const d = new Date(timestamp);
          const frozenOn = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          await addBag({
            secretLink,
            actingCaregiverName: selectedCaregiver,
            amountMl: amount,
            pumpedAt: timestamp,
            pumpEntryId: pumpId,
            frozenOn,
          });
        }
      }
      clearPumpTimer(timerKey);
      void hapticSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save pump entry:", error);
      alert(t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  const liveElapsedMs = elapsedMs(liveTimer, liveNow);
  const liveElapsedLabel =
    liveElapsedMs >= 60_000
      ? formatLivePumpElapsed(liveElapsedMs)
      : formatElapsed(liveElapsedMs);

  const liveSessionPanel = (
    <>
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-accent-pump-light/40 flex items-center justify-center mx-auto mb-3">
          <IconPump size={32} className="text-accent-pump" />
        </div>
        <p className="text-lg font-semibold text-foreground mb-1">
          {t("pumpingNow")}
        </p>
        {liveTimer.status === "paused" && (
          <p className="text-sm text-muted mb-3">{t("pumpTimerPaused")}</p>
        )}
        <div className="bg-accent-pump-light/35 rounded-2xl p-5 mt-3">
          <p className="text-3xl font-bold text-accent-pump tabular-nums">
            {liveElapsedLabel}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {liveTimer.status === "running" ? (
          <button
            type="button"
            onClick={handlePauseLivePump}
            className="btn-secondary flex-1 py-3"
          >
            {t("pumpTimerPause")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResumeLivePump}
            className="btn-primary flex-1 py-3"
          >
            {t("pumpTimerResume")}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleEndLivePump}
        className="w-full bg-secondary hover:bg-secondary/90 text-white font-medium py-4 px-6 rounded-xl transition-colors"
      >
        {t("endPumpNowButton")}
      </button>
    </>
  );

  const detailsForm = (
    <div className="space-y-4">
      {!isEditing && (
        <button
          type="button"
          onClick={goLivePump}
          className="text-sm text-primary font-medium"
        >
          ← {t("pumpModeLive")}
        </button>
      )}

      {!isEditing &&
        liveTimer.status === "stopped" &&
        liveTimer.accumulatedMs > 0 && (
          <p className="text-sm text-muted">
            {t("pumpTimedFor", {
              time:
                liveTimer.accumulatedMs >= 60_000
                  ? formatLivePumpElapsed(liveTimer.accumulatedMs)
                  : formatElapsed(liveTimer.accumulatedMs),
            })}
          </p>
        )}

      <div>
        <label className="label-field">{t("pumpAmount", { amount })}</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAmount(Math.max(10, amount - 10))}
            className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
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
            className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
          >
            +
          </button>
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

      <EntryPhotoField
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        photoIds={photoIds}
        onChange={setPhotoIds}
      />

      <EntryTimeField value={timestamp} onChange={setTimestamp} />

      {!isEditing && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={addToStash}
            onChange={(e) => setAddToStash(e.target.checked)}
            className="rounded border-border"
          />
          {t("stashAddFromPump")}
        </label>
      )}

      <button
        type="button"
        onClick={() => void handleSubmit()}
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
  );

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("logPump")}
      icon={<IconPump size={20} />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2 min-w-0 max-w-full overflow-x-clip">
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}

        {step === "live" && !isEditing && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPumpMode("live")}
                className={cn(
                  "btn-option flex-1",
                  pumpMode === "live"
                    ? "btn-option-selected"
                    : "btn-option-default"
                )}
              >
                {t("pumpModeLive")}
              </button>
              <button
                type="button"
                onClick={goPastPump}
                className={cn(
                  "btn-option flex-1",
                  pumpMode === "past"
                    ? "btn-option-selected"
                    : "btn-option-default"
                )}
              >
                {t("pumpModePast")}
              </button>
            </div>

            <div className="text-center py-2">
              <p className="text-sm text-muted leading-snug">
                {t("pumpLiveHint")}
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartLivePump}
              className="w-full bg-accent-pump hover:bg-accent-pump/90 text-white font-medium py-4 px-6 rounded-xl transition-colors"
            >
              {t("startPumpTimer")}
            </button>
          </div>
        )}

        {step === "timing" && !isEditing && (
          <div className="space-y-4">{liveSessionPanel}</div>
        )}

        {step === "details" && detailsForm}
      </div>
    </BottomSheet>
  );
}
