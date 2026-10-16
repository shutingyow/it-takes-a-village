"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { cn } from "@/app/lib/utils";
import {
  clearFeedTimer,
  elapsedMs,
  elapsedToDurationMinutes,
  formatElapsed,
  loadFeedTimer,
  saveFeedTimer,
  type PersistedFeedTimer,
} from "@/app/lib/feedTimer";

interface FeedTimerProps {
  storageKey: string;
  onDurationMinutes: (minutes: number | null) => void;
  /** Stamp When to feed start when Start is pressed (new logs only if When untouched). */
  shouldStampStart: boolean;
  onStampStart?: (startMs: number) => void;
}

export function FeedTimer({
  storageKey,
  onDurationMinutes,
  shouldStampStart,
  onStampStart,
}: FeedTimerProps) {
  const { t } = useLanguage();
  const [state, setState] = useState<PersistedFeedTimer>({
    status: "idle",
    accumulatedMs: 0,
    segmentStartedAt: null,
    feedStartedAt: null,
  });
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setState(loadFeedTimer(storageKey));
    setHydrated(true);
    setNow(Date.now());
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    saveFeedTimer(storageKey, state);
  }, [storageKey, state, hydrated]);

  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.status]);

  const ms = elapsedMs(state, now);
  const display = formatElapsed(ms);

  const persist = (next: PersistedFeedTimer) => {
    setState(next);
    saveFeedTimer(storageKey, next);
  };

  const handleStart = () => {
    const startMs = Date.now();
    setNow(startMs);
    if (shouldStampStart && onStampStart) {
      onStampStart(startMs);
    }
    persist({
      status: "running",
      accumulatedMs: 0,
      segmentStartedAt: startMs,
      feedStartedAt: startMs,
    });
  };

  const handlePause = () => {
    if (state.status !== "running" || state.segmentStartedAt == null) return;
    const pauseAt = Date.now();
    setNow(pauseAt);
    persist({
      ...state,
      status: "paused",
      accumulatedMs:
        state.accumulatedMs + Math.max(0, pauseAt - state.segmentStartedAt),
      segmentStartedAt: null,
    });
  };

  const handleResume = () => {
    if (state.status !== "paused") return;
    const resumeAt = Date.now();
    setNow(resumeAt);
    persist({
      ...state,
      status: "running",
      segmentStartedAt: resumeAt,
    });
  };

  const handleStop = () => {
    const stopAt = Date.now();
    setNow(stopAt);
    const total =
      state.status === "running" && state.segmentStartedAt != null
        ? state.accumulatedMs + Math.max(0, stopAt - state.segmentStartedAt)
        : state.accumulatedMs;
    const minutes = elapsedToDurationMinutes(total);
    onDurationMinutes(minutes);
    persist({
      status: "stopped",
      accumulatedMs: total,
      segmentStartedAt: null,
      feedStartedAt: state.feedStartedAt,
    });
  };

  const handleReset = () => {
    clearFeedTimer(storageKey);
    setState({
      status: "idle",
      accumulatedMs: 0,
      segmentStartedAt: null,
      feedStartedAt: null,
    });
    setNow(Date.now());
  };

  const statusLabel =
    state.status === "running"
      ? t("feedTimerRunning")
      : state.status === "paused"
        ? t("feedTimerPaused")
        : state.status === "stopped"
          ? t("feedTimerStopped")
          : null;

  return (
    <div className="rounded-2xl border border-border bg-accent-feed-light/60 px-4 py-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-foreground">
          {t("feedTimerLabel")}
        </p>
        {statusLabel && (
          <span
            className={cn(
              "text-xs font-medium",
              state.status === "running"
                ? "text-terracotta"
                : "text-muted"
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <p className="text-xs text-muted mb-3">{t("feedTimerHint")}</p>

      <p
        className="text-center text-4xl font-semibold tracking-tight tabular-nums text-foreground mb-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {display}
      </p>

      <div className="flex gap-2">
        {state.status === "idle" && (
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary flex-1 py-3"
          >
            {t("feedTimerStart")}
          </button>
        )}

        {state.status === "running" && (
          <>
            <button
              type="button"
              onClick={handlePause}
              className="btn-secondary flex-1 py-3"
            >
              {t("feedTimerPause")}
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="flex-1 py-3 px-4 rounded-xl bg-terracotta text-white font-medium touch-manipulation"
            >
              {t("feedTimerStop")}
            </button>
          </>
        )}

        {state.status === "paused" && (
          <>
            <button
              type="button"
              onClick={handleResume}
              className="btn-primary flex-1 py-3"
            >
              {t("feedTimerResume")}
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="flex-1 py-3 px-4 rounded-xl bg-terracotta text-white font-medium touch-manipulation"
            >
              {t("feedTimerStop")}
            </button>
          </>
        )}

        {state.status === "stopped" && (
          <>
            <button
              type="button"
              onClick={handleStart}
              className="btn-primary flex-1 py-3"
            >
              {t("feedTimerStart")}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary flex-1 py-3"
            >
              {t("feedTimerReset")}
            </button>
          </>
        )}
      </div>

      {(state.status === "running" || state.status === "paused") && (
        <button
          type="button"
          onClick={handleReset}
          className="mt-2 w-full min-h-11 text-xs font-semibold text-muted touch-manipulation"
        >
          {t("feedTimerReset")}
        </button>
      )}
    </div>
  );
}
