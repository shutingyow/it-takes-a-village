"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { isFeedTimerRecording } from "@/app/lib/feedTimer";
import { formatDuration } from "@/app/lib/utils";
import { IconSleep } from "./icons";
import { SessionTimerBanner } from "./SessionTimerBanner";

interface SleepTimerBannerProps {
  secretLink: string;
  selectedCaregiver: string;
  /** Hide while the sleep sheet is already open. */
  hidden?: boolean;
  onOpen: () => void;
}

/**
 * Compact bar while a sleep session is active so caregivers can leave the
 * log sheet and still see / reopen End sleep.
 */
export function SleepTimerBanner({
  secretLink,
  selectedCaregiver,
  hidden = false,
  onOpen,
}: SleepTimerBannerProps) {
  const { t } = useLanguage();
  const activeSleep = useQuery(
    api.sleepEntries.getActive,
    selectedCaregiver
      ? { secretLink, actingCaregiverName: selectedCaregiver }
      : "skip"
  );
  const [now, setNow] = useState(() => Date.now());
  const [feedAlsoActive, setFeedAlsoActive] = useState(false);

  useEffect(() => {
    if (!activeSleep) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeSleep?._id, activeSleep]);

  useEffect(() => {
    const refreshFeed = () => {
      setFeedAlsoActive(isFeedTimerRecording(secretLink));
    };
    refreshFeed();
    window.addEventListener("feedTimerChanged", refreshFeed);
    window.addEventListener("focus", refreshFeed);
    return () => {
      window.removeEventListener("feedTimerChanged", refreshFeed);
      window.removeEventListener("focus", refreshFeed);
    };
  }, [secretLink]);

  if (!activeSleep) return null;

  const time = formatDuration(activeSleep.startTime, now);
  const label =
    activeSleep.type === "nap"
      ? t("sleepTimerBannerNap", { time })
      : t("sleepTimerBannerNight", { time });
  const tapHint = t("sleepTimerBannerTap");

  return (
    <SessionTimerBanner
      hidden={hidden}
      onOpen={onOpen}
      icon={<IconSleep size={18} className="text-white" />}
      label={label}
      tapHint={tapHint}
      stackIndex={feedAlsoActive ? 1 : 0}
      pulseClassName="bg-accent-sleep animate-pulse"
      ariaLabel={`${label}. ${tapHint}`}
    />
  );
}
