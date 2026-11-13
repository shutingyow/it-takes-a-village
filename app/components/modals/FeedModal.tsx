"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import {
  clearFeedTimer,
  elapsedMs,
  elapsedToDurationMinutes,
  feedTimerStorageKey,
  formatElapsed,
  isFeedTimerRecording,
  loadFeedTimer,
  saveFeedTimer,
  type PersistedFeedTimer,
} from "@/app/lib/feedTimer";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconFeed } from "../icons";
import { EntryPhotoField } from "../EntryPhotoField";
import { EntryTimeField } from "../EntryTimeField";
import { EntryWhenFields } from "../EntryWhenFields";
import { FeedTimer } from "../FeedTimer";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";
import {
  canLogSolids,
  solidsFirstInFeedPicker,
} from "@/app/lib/babyAge";
import {
  daysFrozen,
  resolveFrozenOn,
} from "@/app/lib/milkStashDates";
import { hapticSuccess } from "@/app/lib/haptics";

type FeedEditEntry = Extract<ActivityEntry, { entryType: "feed" }>;
type FeedType = "breast" | "bottle" | "solids";
/** live = start; timing = active session panel; details = type + fields + save */
type FeedStep = "live" | "timing" | "details";

interface FeedModalProps {
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: FeedEditEntry;
  birthDate?: string;
}

type BottleMilk = "formula" | "breastmilk";

const MAX_DURATION_MINUTES = 24 * 60;
const MAX_SOLIDS_GRAMS = 2000;

function initialFeedStep(
  secretLink: string,
  editEntry?: FeedEditEntry
): FeedStep {
  if (editEntry) return "details";
  const timer = loadFeedTimer(feedTimerStorageKey(secretLink));
  if (timer.status === "running" || timer.status === "paused") return "timing";
  // After stop: type + details on one screen (no type-only sheet).
  if (timer.status === "stopped") return "details";
  return "live";
}

function formatLiveFeedElapsed(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

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
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <label htmlFor="feed-duration-minutes" className="label-field mb-0">
          {t("feedDurationLabel")}
        </label>
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 px-2 text-xs font-semibold text-terracotta touch-manipulation shrink-0"
          >
            {t("clearDuration")}
          </button>
        )}
      </div>
      <div className="input-field flex items-center gap-2 min-w-0 w-full max-w-full box-border py-0">
        <input
          id="feed-duration-minutes"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="—"
          value={value ?? ""}
          onChange={(e) => setFromDigits(e.target.value)}
          className="min-w-0 flex-1 bg-transparent border-0 outline-none text-center text-lg font-semibold tabular-nums py-3 focus:ring-0"
          aria-label={`${t("feedDurationLabel")} (${t("durationMinutesUnit")})`}
        />
        <span className="text-sm text-muted shrink-0 pr-1">
          {t("durationMinutesUnit")}
        </span>
      </div>
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
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
  birthDate,
}: FeedModalProps) {
  const { t } = useLanguage();
  const createFeed = useMutation(api.feedEntries.create);
  const updateFeed = useMutation(api.feedEntries.update);
  const markStashUsed = useMutation(api.milkStash.markUsed);
  const tracker = useQuery(api.trackers.getBySecret, { secretLink });
  const stashBags = useQuery(
    api.milkStash.listAvailable,
    selectedCaregiver
      ? { secretLink, actingCaregiverName: selectedCaregiver }
      : "skip"
  );
  const isEditing = Boolean(editEntry);
  const [stashBagId, setStashBagId] = useState<Id<"milkStashBags"> | "">("");

  const resolvedBirthDate = birthDate ?? tracker?.birthDate;
  const solidsAvailable =
    editEntry?.type === "solids" || canLogSolids(resolvedBirthDate);
  const solidsFirst = solidsFirstInFeedPicker(resolvedBirthDate);

  const [step, setStep] = useState<FeedStep>(() =>
    initialFeedStep(secretLink, editEntry)
  );
  const [feedMode, setFeedMode] = useState<"live" | "past">("live");
  const [feedType, setFeedType] = useState<FeedType>(
    editEntry?.type ?? "breast"
  );
  const [liveTimer, setLiveTimer] = useState<PersistedFeedTimer>(() =>
    loadFeedTimer(feedTimerStorageKey(secretLink, editEntry?._id))
  );
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [side, setSide] = useState<"left" | "right">(
    editEntry?.side ?? "left"
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(() => {
    const minutes = editEntry?.durationMinutes ?? editEntry?.duration;
    if (minutes && minutes > 0) return minutes;
    if (!editEntry) {
      const timer = loadFeedTimer(feedTimerStorageKey(secretLink));
      if (timer.status === "stopped") {
        return elapsedToDurationMinutes(timer.accumulatedMs);
      }
    }
    return null;
  });
  const [amount, setAmount] = useState(editEntry?.amount ?? 120);
  const [bottleMilk, setBottleMilk] = useState<BottleMilk | undefined>(() =>
    editEntry && editEntry.type === "bottle"
      ? inferBottleMilk(editEntry)
      : undefined
  );
  const [foodName, setFoodName] = useState(editEntry?.foodName ?? "");
  const [amountGrams, setAmountGrams] = useState<number | null>(() => {
    const grams = editEntry?.amountGrams;
    return grams && grams > 0 ? grams : null;
  });
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>(
    editEntry?.photoIds ?? []
  );
  const [timestamp, setTimestamp] = useState(
    () => editEntry?.timestamp ?? Date.now()
  );
  const [feedStartAt, setFeedStartAt] = useState(() => {
    if (editEntry?.timestamp) return editEntry.timestamp;
    const timer = loadFeedTimer(feedTimerStorageKey(secretLink));
    if (
      (timer.status === "stopped" ||
        timer.status === "running" ||
        timer.status === "paused") &&
      timer.feedStartedAt != null
    ) {
      return timer.feedStartedAt;
    }
    return Date.now();
  });
  const [feedEndAt, setFeedEndAt] = useState(() => {
    if (editEntry?.timestamp) {
      const mins = editEntry.durationMinutes ?? editEntry.duration;
      if (mins && mins > 0) return editEntry.timestamp + mins * 60_000;
    }
    const timer = loadFeedTimer(feedTimerStorageKey(secretLink));
    if (timer.status === "stopped" && timer.feedStartedAt != null) {
      return timer.feedStartedAt + timer.accumulatedMs;
    }
    return Date.now();
  });
  // Live toggle is for past/manual logging only; active timing uses `timing` step.
  const [timeLive, setTimeLive] = useState(
    () => !editEntry && isFeedTimerRecording(secretLink)
  );
  const [timeTouched, setTimeTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerKey = feedTimerStorageKey(secretLink, editEntry?._id);
  const shouldStampStart = !isEditing && !timeTouched;

  useEffect(() => {
    const refresh = () => {
      setLiveTimer(loadFeedTimer(timerKey));
      setLiveNow(Date.now());
    };
    refresh();
    window.addEventListener("feedTimerChanged", refresh);
    return () => window.removeEventListener("feedTimerChanged", refresh);
  }, [timerKey]);

  useEffect(() => {
    if (step !== "timing") return;
    if (liveTimer.status !== "running") return;
    const id = window.setInterval(() => setLiveNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [step, liveTimer.status]);

  const handleStartLiveFeed = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }
    // Type (breast/bottle/solids) is chosen on the post-stop details screen.
    if (feedType === "solids") setFeedType("breast");
    const startMs = Date.now();
    const next: PersistedFeedTimer = {
      status: "running",
      accumulatedMs: 0,
      segmentStartedAt: startMs,
      feedStartedAt: startMs,
    };
    saveFeedTimer(timerKey, next);
    setLiveTimer(next);
    setFeedStartAt(startMs);
    setTimeTouched(true);
    setTimeLive(true);
    void hapticSuccess();
    onClose();
  };

  const handlePauseLiveFeed = () => {
    if (liveTimer.status !== "running" || liveTimer.segmentStartedAt == null) {
      return;
    }
    const pauseAt = Date.now();
    const next: PersistedFeedTimer = {
      ...liveTimer,
      status: "paused",
      accumulatedMs:
        liveTimer.accumulatedMs +
        Math.max(0, pauseAt - liveTimer.segmentStartedAt),
      segmentStartedAt: null,
    };
    saveFeedTimer(timerKey, next);
    setLiveTimer(next);
    setLiveNow(pauseAt);
  };

  const handleResumeLiveFeed = () => {
    if (liveTimer.status !== "paused") return;
    const resumeAt = Date.now();
    const next: PersistedFeedTimer = {
      ...liveTimer,
      status: "running",
      segmentStartedAt: resumeAt,
    };
    saveFeedTimer(timerKey, next);
    setLiveTimer(next);
    setLiveNow(resumeAt);
  };

  const handleEndLiveFeed = () => {
    const stopAt = Date.now();
    const total =
      liveTimer.status === "running" && liveTimer.segmentStartedAt != null
        ? liveTimer.accumulatedMs +
          Math.max(0, stopAt - liveTimer.segmentStartedAt)
        : liveTimer.accumulatedMs;
    const minutes = elapsedToDurationMinutes(total);
    const next: PersistedFeedTimer = {
      status: "stopped",
      accumulatedMs: total,
      segmentStartedAt: null,
      feedStartedAt: liveTimer.feedStartedAt,
    };
    saveFeedTimer(timerKey, next);
    setLiveTimer(next);
    setLiveNow(stopAt);
    setDurationMinutes(minutes);
    setFeedEndAt(stopAt);
    if (liveTimer.feedStartedAt != null) {
      setFeedStartAt(liveTimer.feedStartedAt);
    }
    setTimeTouched(true);
    setTimeLive(false);
    setStep("details");
    void hapticSuccess();
  };

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }
    if (feedType === "bottle" && !bottleMilk) {
      alert(t("selectBottleMilk"));
      return;
    }
    if (feedType === "solids" && !foodName.trim()) {
      alert(t("selectSolidsFood"));
      return;
    }

    let resolvedStart = feedStartAt;
    let resolvedEnd = feedEndAt;
    if (feedType === "breast" || feedType === "bottle") {
      if (resolvedEnd <= resolvedStart && durationMinutes != null) {
        resolvedEnd = resolvedStart + durationMinutes * 60_000;
      }
      if (resolvedEnd <= resolvedStart) {
        alert(t("feedEndBeforeStart"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const rangeDurationMins =
        feedType === "breast" || feedType === "bottle"
          ? Math.max(1, Math.round((resolvedEnd - resolvedStart) / 60_000))
          : null;
      const breastDuration =
        durationMinutes ?? rangeDurationMins ?? undefined;
      const payload = {
        type: feedType,
        side: feedType === "breast" ? side : undefined,
        duration:
          feedType === "solids"
            ? undefined
            : feedType === "bottle"
              ? rangeDurationMins ?? undefined
              : breastDuration,
        durationMinutes:
          feedType === "solids"
            ? undefined
            : feedType === "bottle"
              ? rangeDurationMins ?? undefined
              : breastDuration,
        amount: feedType === "bottle" ? amount : undefined,
        bottleMilk: feedType === "bottle" ? bottleMilk : undefined,
        foodName: feedType === "solids" ? foodName.trim() : undefined,
        amountGrams:
          feedType === "solids" ? amountGrams ?? undefined : undefined,
        timestamp:
          feedType === "breast" || feedType === "bottle"
            ? resolvedStart
            : timestamp,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      };

      if (editEntry) {
        await updateFeed({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: editEntry._id,
          ...payload,
        });
      } else {
        await createFeed({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          ...payload,
        });
        if (
          feedType === "bottle" &&
          bottleMilk === "breastmilk" &&
          stashBagId
        ) {
          await markStashUsed({
            secretLink,
            bagId: stashBagId,
            actingCaregiverName: selectedCaregiver,
          });
        }
      }
      clearFeedTimer(timerKey);
      void hapticSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save feed:", error);
      alert(t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  const whenFields = (
    <EntryWhenFields
      startAt={feedStartAt}
      endAt={feedEndAt}
      onStartChange={(next) => {
        setTimeTouched(true);
        setFeedStartAt(next);
      }}
      onEndChange={(next) => {
        setTimeTouched(true);
        setFeedEndAt(next);
      }}
    />
  );

  const liveTimerToggle = (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[#faf6f2] px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {t("timeItLive")}
        </p>
        <p className="text-xs text-muted leading-snug">{t("timeItLiveHint")}</p>
      </div>
      <input
        type="checkbox"
        checked={timeLive}
        onChange={(e) => setTimeLive(e.target.checked)}
        className="size-4 accent-primary shrink-0"
      />
    </label>
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

  const typeButtons: Array<{ id: FeedType; label: string }> = [
    { id: "breast", label: t("breastFeeding") },
    { id: "bottle", label: t("bottleFeeding") },
  ];
  if (solidsAvailable) {
    const solidsBtn = { id: "solids" as const, label: t("solidsFeeding") };
    if (solidsFirst) typeButtons.unshift(solidsBtn);
    else typeButtons.push(solidsBtn);
  }

  const pickType = (next: FeedType) => {
    setFeedType(next);
    if (next !== "bottle") setBottleMilk(undefined);
    if (next === "solids") setTimeLive(false);
  };

  const goPastFeed = () => {
    setFeedMode("past");
    setTimeLive(false);
    setStep("details");
  };

  const liveElapsedMs = elapsedMs(liveTimer, liveNow);
  const liveElapsedLabel =
    liveElapsedMs >= 60_000
      ? formatLiveFeedElapsed(liveElapsedMs)
      : formatElapsed(liveElapsedMs);

  const typePicker = (
    <div>
      <label className="label-field">{t("selectFeedType")}</label>
      <div className="flex flex-col gap-2">
        {typeButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => pickType(btn.id)}
            className={cn(
              "btn-option w-full py-3.5",
              feedType === btn.id
                ? "btn-option-selected"
                : "btn-option-default",
              btn.id === "solids" &&
                feedType !== "solids" &&
                "border-accent-solids text-accent-solids"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );

  const liveSessionPanel = (
    <>
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-accent-feed-light/40 flex items-center justify-center mx-auto mb-3">
          <IconFeed size={32} className="text-accent-feed" />
        </div>
        <p className="text-lg font-semibold text-foreground mb-1">
          {t("babyFeeding")}
        </p>
        {liveTimer.status === "paused" && (
          <p className="text-sm text-muted mb-3">{t("feedTimerPaused")}</p>
        )}
        <div className="bg-accent-feed-light/35 rounded-2xl p-5 mt-3">
          <p className="text-3xl font-bold text-accent-feed tabular-nums">
            {liveElapsedLabel}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {liveTimer.status === "running" ? (
          <button
            type="button"
            onClick={handlePauseLiveFeed}
            className="btn-secondary flex-1 py-3"
          >
            {t("feedTimerPause")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResumeLiveFeed}
            className="btn-primary flex-1 py-3"
          >
            {t("feedTimerResume")}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleEndLiveFeed}
        className="w-full bg-secondary hover:bg-secondary/90 text-white font-medium py-4 px-6 rounded-xl transition-colors"
      >
        {t("endFeedNowButton")}
      </button>
    </>
  );

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("logFeed")}
      icon={<IconFeed size={20} />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2 min-w-0 max-w-full overflow-x-clip">
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}

        {step === "live" && !isEditing && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFeedMode("live")}
                className={cn(
                  "btn-option flex-1",
                  feedMode === "live"
                    ? "btn-option-selected"
                    : "btn-option-default"
                )}
              >
                {t("feedModeLive")}
              </button>
              <button
                type="button"
                onClick={goPastFeed}
                className={cn(
                  "btn-option flex-1",
                  feedMode === "past"
                    ? "btn-option-selected"
                    : "btn-option-default"
                )}
              >
                {t("feedModePast")}
              </button>
            </div>

            <div className="text-center py-2">
              <p className="text-sm text-muted leading-snug">
                {t("feedLiveHint")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleStartLiveFeed()}
              className="w-full bg-accent-feed hover:bg-accent-feed/90 text-white font-medium py-4 px-6 rounded-xl transition-colors"
            >
              {t("startFeedTimer")}
            </button>
          </div>
        )}

        {step === "timing" && !isEditing && (
          <div className="space-y-4">{liveSessionPanel}</div>
        )}

        {step === "details" && (
          <div className="space-y-4 min-w-0 max-w-full">
            {!isEditing && feedMode === "past" && (
              <button
                type="button"
                onClick={() => {
                  setFeedMode("live");
                  setStep("live");
                }}
                className="text-sm text-primary font-medium"
              >
                ← {t("feedModeLive")}
              </button>
            )}

            {typePicker}

            {feedType === "breast" && (
              <>
                {timeLive ? (
                  <FeedTimer
                    storageKey={timerKey}
                    onDurationMinutes={setDurationMinutes}
                    shouldStampStart={shouldStampStart}
                    onStampStart={(startMs) => {
                      setFeedStartAt(startMs);
                      setTimeTouched(true);
                    }}
                    onStampEnd={(endMs) => {
                      setFeedEndAt(endMs);
                      setTimeTouched(true);
                    }}
                  />
                ) : (
                  <>
                    {whenFields}
                    {feedMode === "past" && liveTimerToggle}
                    <DurationMinutesField
                      value={durationMinutes}
                      onChange={setDurationMinutes}
                    />
                  </>
                )}

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
                          side === s
                            ? "btn-option-selected"
                            : "btn-option-default"
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

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {saveLabel}
                </button>
              </>
            )}

            {feedType === "bottle" && (
              <>
                {timeLive ? (
                  <FeedTimer
                    storageKey={timerKey}
                    onDurationMinutes={setDurationMinutes}
                    shouldStampStart={shouldStampStart}
                    onStampStart={(startMs) => {
                      setFeedStartAt(startMs);
                      setTimeTouched(true);
                    }}
                    onStampEnd={(endMs) => {
                      setFeedEndAt(endMs);
                      setTimeTouched(true);
                    }}
                  />
                ) : (
                  whenFields
                )}

                <div>
                  <label className="label-field">
                    {t("amountMl", { amount })}
                  </label>
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
                  <label className="label-field">{t("bottleMilkType")}</label>
                  <div className="flex gap-2">
                    {(
                      [
                        { id: "formula" as const, label: t("formula") },
                        {
                          id: "breastmilk" as const,
                          label: t("breastMilk"),
                        },
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
                    <p className="mt-1.5 text-xs text-muted">
                      {t("selectBottleMilk")}
                    </p>
                  )}
                </div>

                {!isEditing &&
                  bottleMilk === "breastmilk" &&
                  stashBags &&
                  stashBags.length > 0 && (
                    <div>
                      <label className="label-field">{t("stashUseBag")}</label>
                      <select
                        value={stashBagId}
                        onChange={(e) =>
                          setStashBagId(
                            e.target.value as Id<"milkStashBags"> | ""
                          )
                        }
                        className="input-field"
                      >
                        <option value="">{t("stashUseNone")}</option>
                        {stashBags.map((bag) => {
                          const frozen = resolveFrozenOn(bag);
                          const days = daysFrozen(frozen);
                          return (
                            <option key={bag._id} value={bag._id}>
                              {bag.amountMl} ml · {frozen} · {days}d
                            </option>
                          );
                        })}
                      </select>
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
                  onClick={handleSubmit}
                  disabled={isSubmitting || !bottleMilk}
                  className="btn-primary"
                >
                  {saveLabel}
                </button>
              </>
            )}

            {feedType === "solids" && (
              <>
                <div>
                  <label htmlFor="solids-food" className="label-field">
                    {t("solidsFoodLabel")}
                  </label>
                  <input
                    id="solids-food"
                    type="text"
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    placeholder={t("solidsFoodPlaceholder")}
                    className="input-field"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label htmlFor="solids-grams" className="label-field mb-0">
                      {t("solidsAmountOptional")}
                    </label>
                    {amountGrams != null && (
                      <button
                        type="button"
                        onClick={() => setAmountGrams(null)}
                        className="min-h-11 px-2 text-xs font-semibold text-terracotta touch-manipulation"
                      >
                        {t("clearDuration")}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      id="solids-grams"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      placeholder="—"
                      value={amountGrams ?? ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        if (digits === "") {
                          setAmountGrams(null);
                          return;
                        }
                        const parsed = Number.parseInt(digits, 10);
                        if (!Number.isFinite(parsed) || parsed < 1) {
                          setAmountGrams(null);
                          return;
                        }
                        setAmountGrams(Math.min(MAX_SOLIDS_GRAMS, parsed));
                      }}
                      className="input-field w-28 shrink-0 text-center text-lg font-semibold tabular-nums"
                    />
                    <span className="text-sm text-muted">g</span>
                  </div>
                </div>

                <div>
                  <label className="label-field">{t("notesOptional")}</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("solidsNotesPlaceholder")}
                    className="textarea-field"
                    rows={2}
                  />
                </div>

                {photoField}

                <EntryTimeField value={timestamp} onChange={setTimestamp} />

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !foodName.trim()}
                  className="btn-primary"
                >
                  {saveLabel}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
