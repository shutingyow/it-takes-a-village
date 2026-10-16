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

interface NextFeedBannerProps {
  trackerId: Id<"trackers">;
}

/** High-contrast next-feed countdown + time since last feed/pump. */
export function NextFeedBanner({ trackerId }: NextFeedBannerProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dueStatus = useQuery(api.reminders.getDueStatus, { trackerId, now });
  const lastFeed = useQuery(api.feedEntries.getLast, { trackerId });
  const lastPump = useQuery(api.pumpEntries.getLast, { trackerId });
  const feed = dueStatus?.items.find((item) => item.type === "feed");

  if (dueStatus === undefined) {
    return (
      <div className="px-4 pb-2">
        <div className="h-16 rounded-2xl bg-beige-light animate-pulse" />
      </div>
    );
  }

  const overdue = feed?.status === "overdue";
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
            {t("nextFeedDue")}
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
