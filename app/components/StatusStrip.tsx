"use client";

import { formatTimeAgo, formatDuration } from "../lib/utils";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import {
  ActivityIcon,
  IconFeed,
  IconPump,
  IconSleep,
  IconSun,
} from "./icons";

interface StatusStripProps {
  lastFeed?: {
    type: "breast" | "bottle";
    amount?: number;
    side?: "left" | "right";
    bottleMilk?: "formula" | "breastmilk";
    timestamp: number;
    caregiverName: string;
  } | null;
  lastDiaper?: {
    type: "wet" | "dirty" | "both";
    timestamp: number;
    caregiverName: string;
  } | null;
  lastPump?: {
    amount: number;
    timestamp: number;
    caregiverName: string;
  } | null;
  activeSleep?: {
    startTime: number;
    caregiverName: string;
  } | null;
  lastCompletedSleep?: {
    startTime: number;
    endTime: number;
    caregiverName: string;
  } | null;
}

function StatusCard({
  type,
  label,
  value,
  detail,
  accentClass,
}: {
  type: "feed" | "diaper" | "pump";
  label: string;
  value: string;
  detail?: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-xl p-3 sm:p-4 card-shadow bg-surface border border-border min-w-0 sm:min-w-[140px] flex-1">
      <div className="flex items-center gap-2 mb-2">
        {type === "feed" && (
          <IconFeed size={16} className={accentClass} />
        )}
        {type === "diaper" && (
          <ActivityIcon type="diaper" size={16} className={accentClass} />
        )}
        {type === "pump" && (
          <IconPump size={16} className={accentClass} />
        )}
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <p className="text-base font-semibold text-foreground">{value}</p>
      {detail && (
        <p className="text-xs text-muted mt-1 truncate">{detail}</p>
      )}
    </div>
  );
}

export function StatusStrip({
  lastFeed,
  lastDiaper,
  lastPump,
  activeSleep,
  lastCompletedSleep,
}: StatusStripProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const isAwake = !activeSleep;
  const awakeTime =
    isAwake && lastCompletedSleep ? now - lastCompletedSleep.endTime : 0;

  const diaperLabel = (type: "wet" | "dirty" | "both") => {
    if (type === "wet") return t("wet");
    if (type === "dirty") return t("dirty");
    return t("wetDirty");
  };

  return (
    <div className="px-3 sm:px-4 pt-4 pb-2 min-w-0">
      <p className="section-label">{t("liveStatus")}</p>

      <div
        className={cn(
          "rounded-xl p-5 mb-3 card-shadow border",
          activeSleep
            ? "bg-accent-sleep-light border-accent-sleep/20"
            : "bg-secondary-light border-secondary/20"
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              {activeSleep ? (
                <IconSleep size={20} className="text-accent-sleep" />
              ) : (
                <IconSun size={20} className="text-secondary" />
              )}
              <span className="text-sm font-medium text-foreground">
                {activeSleep ? t("sleeping") : t("awake")}
              </span>
            </div>
            <p className="text-2xl font-semibold text-foreground tracking-tight">
              {activeSleep ? (
                formatDuration(activeSleep.startTime)
              ) : awakeTime > 0 ? (
                formatDuration(now - awakeTime)
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-muted mt-1">
              {activeSleep
                ? t("startedBy", { name: activeSleep.caregiverName })
                : lastCompletedSleep
                  ? t("sinceLastNap", { name: lastCompletedSleep.caregiverName })
                  : t("noSleepLogged")}
            </p>
          </div>
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full",
              activeSleep ? "bg-accent-sleep animate-pulse" : "bg-secondary"
            )}
          />
        </div>
      </div>

      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto overscroll-x-contain pb-1 -mx-0.5 px-0.5 max-w-full touch-pan-x">
        {lastFeed && (
          <StatusCard
            type="feed"
            label={t("feed")}
            value={formatTimeAgo(lastFeed.timestamp)}
            detail={
              lastFeed.type === "breast"
                ? `${t("breast")}${lastFeed.side ? ` (${lastFeed.side})` : ""} · ${lastFeed.caregiverName}`
                : `${t("bottle")}${
                    lastFeed.bottleMilk === "formula"
                      ? ` · ${t("formula")}`
                      : lastFeed.bottleMilk === "breastmilk"
                        ? ` · ${t("breastMilk")}`
                        : ""
                  } ${lastFeed.amount}ml · ${lastFeed.caregiverName}`
            }
            accentClass="text-accent-feed"
          />
        )}
        {lastDiaper && (
          <StatusCard
            type="diaper"
            label={t("diaper")}
            value={formatTimeAgo(lastDiaper.timestamp)}
            detail={`${diaperLabel(lastDiaper.type)} · ${lastDiaper.caregiverName}`}
            accentClass="text-accent-diaper"
          />
        )}
        {lastPump && (
          <StatusCard
            type="pump"
            label={t("pump")}
            value={formatTimeAgo(lastPump.timestamp)}
            detail={`${lastPump.amount}ml · ${lastPump.caregiverName}`}
            accentClass="text-accent-pump"
          />
        )}
        {!lastFeed && !lastDiaper && !lastPump && (
          <div className="rounded-xl p-4 card-shadow bg-surface border border-border flex-1 text-center">
            <p className="text-sm text-muted">{t("logActivityHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
