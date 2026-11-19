"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  elapsedMs,
  formatElapsed,
  loadPumpTimer,
  pumpTimerStorageKey,
  type PersistedPumpTimer,
} from "@/app/lib/pumpTimer";
import { IconPump } from "./icons";
import { SessionTimerBanner } from "./SessionTimerBanner";

interface PumpTimerBannerProps {
  secretLink: string;
  /** Hide while the pump sheet is already open. */
  hidden?: boolean;
  onOpen: () => void;
}

/** Compact bar while a pump timer runs in the background. */
export function PumpTimerBanner({
  secretLink,
  hidden = false,
  onOpen,
}: PumpTimerBannerProps) {
  const { t } = useLanguage();
  const [state, setState] = useState<PersistedPumpTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => {
      const next = loadPumpTimer(pumpTimerStorageKey(secretLink));
      if (next.status === "running" || next.status === "paused") {
        setState(next);
      } else {
        setState(null);
      }
      setNow(Date.now());
    };
    refresh();
    window.addEventListener("pumpTimerChanged", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pumpTimerChanged", refresh);
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
      ? t("pumpTimerBannerPaused", { time })
      : t("pumpTimerBannerRunning", { time });
  const tapHint = t("pumpTimerBannerTap");

  return (
    <SessionTimerBanner
      hidden={hidden}
      onOpen={onOpen}
      icon={<IconPump size={18} className="text-white" />}
      label={label}
      tapHint={tapHint}
      pulseClassName={
        state.status === "running"
          ? "bg-[#c4a574] animate-pulse"
          : "bg-white/40"
      }
      ariaLabel={`${label}. ${tapHint}`}
    />
  );
}
