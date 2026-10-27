"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  elapsedMs,
  feedTimerStorageKey,
  formatElapsed,
  loadFeedTimer,
  type PersistedFeedTimer,
} from "@/app/lib/feedTimer";
import { IconFeed } from "./icons";
import { cn } from "@/app/lib/utils";

interface FeedTimerBannerProps {
  secretLink: string;
  /** Hide while the feed sheet is already open. */
  hidden?: boolean;
  onOpen: () => void;
}

/**
 * Compact bar while a feed timer runs in the background so caregivers can
 * leave the log sheet and still see / reopen the timer.
 */
export function FeedTimerBanner({
  secretLink,
  hidden = false,
  onOpen,
}: FeedTimerBannerProps) {
  const { t } = useLanguage();
  const [state, setState] = useState<PersistedFeedTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => {
      const next = loadFeedTimer(feedTimerStorageKey(secretLink));
      if (next.status === "running" || next.status === "paused") {
        setState(next);
      } else {
        setState(null);
      }
      setNow(Date.now());
    };
    refresh();
    window.addEventListener("feedTimerChanged", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("feedTimerChanged", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [secretLink]);

  useEffect(() => {
    if (!state || state.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state?.status, state]);

  if (hidden || !state) return null;

  const time = formatElapsed(elapsedMs(state, now));
  const label =
    state.status === "paused"
      ? t("feedTimerBannerPaused", { time })
      : t("feedTimerBannerRunning", { time });

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-3">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "pointer-events-auto max-w-lg w-full flex items-center gap-3 rounded-2xl px-3.5 py-3",
          "bg-[#3d2c2a] text-white shadow-lg border border-white/10",
          "touch-manipulation active:opacity-90"
        )}
        aria-label={`${label}. ${t("feedTimerBannerTap")}`}
      >
        <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <IconFeed size={18} className="text-white" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold tabular-nums truncate">
            {label}
          </span>
          <span className="block text-[11px] text-white/70 mt-0.5">
            {t("feedTimerBannerTap")}
          </span>
        </span>
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            state.status === "running" ? "bg-[#f0a090] animate-pulse" : "bg-white/40"
          )}
        />
      </button>
    </div>
  );
}
