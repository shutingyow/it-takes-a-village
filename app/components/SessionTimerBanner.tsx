"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/lib/utils";

export interface SessionTimerBannerProps {
  /** Hide while the matching log sheet is already open. */
  hidden?: boolean;
  onOpen: () => void;
  icon: ReactNode;
  label: string;
  tapHint: string;
  /** Soft accent for the pulse dot (feed / sleep / later pump). */
  pulseClassName?: string;
  /** Stack above another banner (0 = default bottom slot). */
  stackIndex?: number;
  ariaLabel?: string;
}

/**
 * Shared bottom timing chip for live feed / sleep (and later pump) sessions.
 */
export function SessionTimerBanner({
  hidden = false,
  onOpen,
  icon,
  label,
  tapHint,
  pulseClassName = "bg-[#f0a090] animate-pulse",
  stackIndex = 0,
  ariaLabel,
}: SessionTimerBannerProps) {
  if (hidden) return null;

  const offsetRem = 4.75 + stackIndex * 4.25;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
      style={{
        bottom: `calc(${offsetRem}rem + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "pointer-events-auto max-w-lg w-full flex items-center gap-3 rounded-2xl px-3.5 py-3",
          "bg-[#3d2c2a] text-white shadow-lg border border-white/10",
          "touch-manipulation active:opacity-90"
        )}
        aria-label={ariaLabel ?? `${label}. ${tapHint}`}
      >
        <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold tabular-nums truncate">
            {label}
          </span>
          <span className="block text-[11px] text-white/70 mt-0.5">
            {tapHint}
          </span>
        </span>
        <span className={cn("w-2 h-2 rounded-full shrink-0", pulseClassName)} />
      </button>
    </div>
  );
}
