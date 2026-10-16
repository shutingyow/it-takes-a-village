"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  formatDuration,
  formatMinutesCompact,
  formatTime,
} from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { isFeedTimerRecording } from "@/app/lib/feedTimer";
import {
  IconChevronRight,
  IconFeed,
  IconPump,
  IconReminders,
} from "./icons";

interface ReminderHomeCardProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  enabled: boolean;
  onOpen: () => void;
}

function formatLiveCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  return `${s}s`;
}

export function ReminderHomeCard({
  trackerId,
  secretLink,
  enabled,
  onOpen,
}: ReminderHomeCardProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const sync = () => setRecording(isFeedTimerRecording(secretLink));
    sync();
    window.addEventListener("feedTimerChanged", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("feedTimerChanged", sync);
      window.removeEventListener("focus", sync);
    };
  }, [secretLink]);

  const dueStatus = useQuery(api.reminders.getDueStatus, {
    trackerId,
    now: Math.floor(now / 60_000) * 60_000,
  });
  const lastFeed = useQuery(api.feedEntries.getLast, { trackerId });
  const lastPump = useQuery(api.pumpEntries.getLast, { trackerId });

  const feedItem = dueStatus?.items.find((item) => item.type === "feed");
  const msUntilDue = feedItem ? feedItem.dueAt - now : null;
  const overdue = feedItem?.status === "overdue";

  let feedCountdown: string | null = null;
  if (feedItem && !recording) {
    if (overdue) {
      feedCountdown = t("overdueBy", {
        time: formatMinutesCompact(
          Math.max(1, Math.round(Math.abs(msUntilDue ?? 0) / 60_000))
        ),
      });
    } else if (msUntilDue != null) {
      feedCountdown = t("dueIn", {
        time: formatLiveCountdown(msUntilDue),
      });
    }
  }

  const sinceFeed = lastFeed
    ? t("sinceLastFeed", { time: formatDuration(lastFeed.timestamp, now) })
    : null;
  const sincePump = lastPump
    ? t("sinceLastPump", { time: formatDuration(lastPump.timestamp, now) })
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-4 mb-5 flex w-auto flex-col gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left card-shadow touch-manipulation active:opacity-90"
    >
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-terracotta-light flex items-center justify-center shrink-0 overflow-hidden">
          <IconReminders size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {t("reminderHomeTitle")}
          </p>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            {enabled ? t("reminderHomeOn") : t("reminderHomeOff")}
          </p>
        </div>
        <span className="text-xs font-semibold text-terracotta shrink-0 flex items-center gap-0.5">
          {t("reminderHomeCta")}
          <IconChevronRight size={16} />
        </span>
      </div>

      {(sinceFeed || sincePump || feedCountdown) && (
        <div className="rounded-xl bg-beige-light/70 border border-border/60 px-3 py-2.5 space-y-1.5">
          {feedCountdown && (
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted shrink-0">
                <IconFeed size={13} className="text-accent-feed" />
                {t("nextFeedDue")}
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums text-right truncate">
                {feedCountdown}
                {feedItem && !overdue && (
                  <span className="text-xs font-medium text-muted ml-1.5">
                    {t("dueAtClock", { time: formatTime(feedItem.dueAt) })}
                  </span>
                )}
              </span>
            </div>
          )}
          {sinceFeed && (
            <p className="text-xs text-muted tabular-nums flex items-center gap-1.5 min-w-0">
              <IconFeed size={12} className="text-accent-feed shrink-0" />
              <span className="truncate">{sinceFeed}</span>
            </p>
          )}
          {sincePump && (
            <p className="text-xs text-muted tabular-nums flex items-center gap-1.5 min-w-0">
              <IconPump size={12} className="text-accent-pump shrink-0" />
              <span className="truncate">{sincePump}</span>
            </p>
          )}
        </div>
      )}
    </button>
  );
}
