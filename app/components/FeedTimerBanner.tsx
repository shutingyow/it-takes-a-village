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
import { SessionTimerBanner } from "./SessionTimerBanner";

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

  if (!state) return null;

  const time = formatElapsed(elapsedMs(state, now));
  const label =
    state.status === "paused"
      ? t("feedTimerBannerPaused", { time })
      : t("feedTimerBannerRunning", { time });
  const tapHint = t("feedTimerBannerTap");

  return (
    <SessionTimerBanner
      hidden={hidden}
      onOpen={onOpen}
      icon={<IconFeed size={18} className="text-white" />}
      label={label}
      tapHint={tapHint}
      pulseClassName={
        state.status === "running"
          ? "bg-[#f0a090] animate-pulse"
          : "bg-white/40"
      }
      ariaLabel={`${label}. ${tapHint}`}
    />
  );
}
