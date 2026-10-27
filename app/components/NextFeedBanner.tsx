"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  cn,
  formatMinutesCompact,
  formatTime,
  formatTimeAgo,
} from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconFeed, IconPump } from "./icons";
import {
  DEFAULT_FEED_INTERVAL_HOURS,
  isLateFeed,
  resolveNightFeedSettings,
} from "@/convex/lib/feedSchedule";
import {
  dismissLateFeedAck,
  isLateFeedAckDismissed,
} from "@/app/lib/feedScheduleAck";

interface NextFeedBannerProps {
  trackerId: Id<"trackers">;
}

/** High-contrast next-feed countdown + late/overdue acknowledgment. */
export function NextFeedBanner({ trackerId }: NextFeedBannerProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const [ackTick, setAckTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dueStatus = useQuery(api.reminders.getDueStatus, { trackerId, now });
  const recentFeeds = useQuery(api.feedEntries.getRecentMilk, {
    trackerId,
    limit: 2,
  });
  const lastPump = useQuery(api.pumpEntries.getLast, { trackerId });
  const feed = dueStatus?.items.find((item) => item.type === "feed");
  const lastFeed = recentFeeds?.[0] ?? null;
  const previousFeed = recentFeeds?.[1] ?? null;

  if (dueStatus === undefined) {
    return (
      <div className="px-4 pb-2">
        <div className="h-16 rounded-2xl bg-beige-light animate-pulse" />
      </div>
    );
  }

  const overdue = feed?.status === "overdue";
  const night = resolveNightFeedSettings({
    nightFeedIntervalEnabled: dueStatus.nightFeedIntervalEnabled,
    nightFeedIntervalHours: dueStatus.nightFeedIntervalHours,
    nightFeedWindowStart: dueStatus.nightFeedWindowStart,
    nightFeedWindowEnd: dueStatus.nightFeedWindowEnd,
  });
  const dayHours = dueStatus.feedIntervalHours ?? DEFAULT_FEED_INTERVAL_HOURS;

  const lateLogged =
    !overdue &&
    lastFeed != null &&
    previousFeed != null &&
    isLateFeed({
      previousFeedAt: previousFeed.timestamp,
      thisFeedAt: lastFeed.timestamp,
      dayIntervalHours: dayHours,
      night,
    }) &&
    !isLateFeedAckDismissed(lastFeed._id);

  // ackTick forces re-read after dismiss (localStorage).
  void ackTick;

  const primary = !feed
    ? t("logFeedForDue")
    : overdue
      ? t("overdueBy", { time: formatMinutesCompact(feed.minutesUntilDue) })
      : t("dueIn", { time: formatMinutesCompact(feed.minutesUntilDue) });

  const sinceFeed = lastFeed
    ? t("sinceLastFeed", { time: formatTimeAgo(lastFeed.timestamp) })
    : null;
  const sincePump = lastPump
    ? t("sinceLastPump", { time: formatTimeAgo(lastPump.timestamp) })
    : null;

  const eyebrow = overdue
    ? t("feedOverdueTitle")
    : dueStatus.usingNightInterval
      ? t("nextFeedDueNight")
      : t("nextFeedDue");

  return (
    <div className="px-4 pb-2">
      <div
        className={cn(
          "rounded-2xl border-2 px-3.5 py-3 flex items-start gap-3 min-w-0",
          overdue
            ? "bg-[#fff5f5] border-[#b42318]"
            : "bg-[#fffaf8] border-[#c45c5c]/70"
        )}
      >
        <span
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border-2",
            overdue
              ? "bg-white border-[#b42318] text-[#b42318]"
              : "bg-white border-[#c45c5c] text-[#9b2c2c]"
          )}
        >
          <IconFeed size={22} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-wide",
              overdue ? "text-[#b42318]" : "text-[#9b2c2c]"
            )}
          >
            {eyebrow}
          </p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums leading-tight mt-0.5",
              overdue ? "text-[#8a1c12]" : "text-[#2d2420]"
            )}
          >
            {primary}
            {feed && (
              <span className="text-sm font-semibold text-[#5c4a42] ml-1.5">
                · {formatTime(feed.dueAt)}
              </span>
            )}
          </p>

          {overdue && (
            <p className="mt-1.5 text-xs font-medium text-[#8a1c12]/90">
              {t("feedOverdueHint")}
            </p>
          )}

          {lateLogged && lastFeed && feed && (
            <div className="mt-2 flex items-start justify-between gap-2 rounded-xl bg-white/80 border border-[#e8cfc8] px-2.5 py-2">
              <p className="text-xs font-medium text-[#5c4a42] leading-snug min-w-0">
                {t("feedLateTimingPushed", {
                  time: formatTime(feed.dueAt),
                })}
              </p>
              <button
                type="button"
                onClick={() => {
                  dismissLateFeedAck(lastFeed._id);
                  setAckTick((n) => n + 1);
                }}
                className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#9b2c2c] px-1.5 py-0.5"
              >
                {t("gotIt")}
              </button>
            </div>
          )}

          {(sinceFeed || sincePump) && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-[#3d3530]">
              {sinceFeed && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <IconFeed
                    size={12}
                    strokeWidth={2.25}
                    className="text-[#9b2c2c] shrink-0"
                  />
                  <span className="truncate">{sinceFeed}</span>
                </span>
              )}
              {sincePump && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <IconPump
                    size={12}
                    strokeWidth={2.25}
                    className="text-[#1769a8] shrink-0"
                  />
                  <span className="truncate">{sincePump}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
