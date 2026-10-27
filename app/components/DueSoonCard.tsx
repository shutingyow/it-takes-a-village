"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import {
  cn,
  formatMinutesCompact,
  formatTime,
} from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconFeed, IconMedication, IconPump } from "./icons";
import {
  DEFAULT_FEED_INTERVAL_HOURS,
  isLateFeed,
  resolveNightFeedSettings,
} from "@/convex/lib/feedSchedule";
import {
  dismissLateFeedAck,
  isLateFeedAckDismissed,
} from "@/app/lib/feedScheduleAck";

interface DueSoonCardProps {
  trackerId: Id<"trackers">;
  pumpScheduleEnabled?: boolean;
}

type DueItem = {
  type: "feed" | "medication" | "pump";
  label: string;
  dueAt: number;
  status: "ok" | "approaching" | "overdue";
  minutesUntilDue: number;
};

function HeroDueCard({
  kind,
  title,
  item,
  emptyHint,
}: {
  kind: "feed" | "pump";
  title: string;
  item: DueItem | null;
  emptyHint: string;
}) {
  const { t } = useLanguage();
  const isOverdue = item?.status === "overdue";
  const isSoon = item?.status === "approaching";

  let primary = emptyHint;
  let secondary: string | null = null;

  if (item) {
    if (isOverdue) {
      primary = t("overdueBy", {
        time: formatMinutesCompact(item.minutesUntilDue),
      });
    } else if (item.minutesUntilDue < 60) {
      primary = t("dueIn", {
        time: formatMinutesCompact(item.minutesUntilDue),
      });
    } else {
      primary = t("dueIn", {
        time: formatMinutesCompact(item.minutesUntilDue),
      });
    }
    secondary = t("dueAtClock", { time: formatTime(item.dueAt) });
  }

  return (
    <div
      className={cn(
        "rounded-[1.35rem] px-4 py-4 card-shadow border min-w-0 flex-1",
        !item && "bg-surface border-border",
        !!item && isOverdue && "bg-terracotta-light border-terracotta/35",
        !!item && isSoon && !isOverdue && "bg-warning-light border-warning/30",
        !!item &&
          !isSoon &&
          !isOverdue &&
          (kind === "feed"
            ? "bg-accent-feed-light border-accent-feed/20"
            : "bg-accent-pump-light border-accent-pump/25")
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
            !item && "bg-beige-light",
            !!item && isOverdue && "bg-terracotta/20",
            !!item && isSoon && !isOverdue && "bg-warning/20",
            !!item &&
              !isSoon &&
              !isOverdue &&
              kind === "feed" &&
              "bg-accent-feed/15",
            !!item &&
              !isSoon &&
              !isOverdue &&
              kind === "pump" &&
              "bg-accent-pump/20"
          )}
        >
          {kind === "feed" ? (
            <IconFeed
              size={22}
              className={cn(
                isOverdue ? "text-terracotta" : "text-accent-feed"
              )}
            />
          ) : (
            <IconPump
              size={22}
              className={cn(
                isOverdue ? "text-terracotta" : "text-accent-pump"
              )}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted truncate">
            {title}
          </p>
          <p
            className={cn(
              "text-2xl font-bold tracking-tight mt-0.5 leading-tight break-words",
              isOverdue ? "text-terracotta" : "text-foreground",
              !item && "text-base font-semibold text-muted"
            )}
          >
            {primary}
          </p>
          {secondary && (
            <p className="text-sm font-medium text-muted mt-1 truncate">
              {secondary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DueSoonCard({
  trackerId,
  pumpScheduleEnabled,
}: DueSoonCardProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(Date.now());
  const [ackTick, setAckTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const dueStatus = useQuery(api.reminders.getDueStatus, { trackerId, now });
  const recentFeeds = useQuery(api.feedEntries.getRecent, {
    trackerId,
    limit: 2,
  });

  if (!dueStatus) {
    return (
      <div className="px-3 sm:px-4 pb-5 min-w-0">
        <p className="section-label">{t("whatsDue")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="h-24 rounded-2xl bg-beige-light animate-pulse" />
          <div className="h-24 rounded-2xl bg-beige-light animate-pulse" />
        </div>
      </div>
    );
  }

  const feedItem =
    dueStatus.items.find((item) => item.type === "feed") ?? null;
  const pumpItem =
    dueStatus.items.find((item) => item.type === "pump") ?? null;
  const showPump = !!pumpScheduleEnabled;
  const lastFeed = recentFeeds?.[0] ?? null;
  const previousFeed = recentFeeds?.[1] ?? null;
  const overdue = feedItem?.status === "overdue";
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
    feedItem != null &&
    isLateFeed({
      previousFeedAt: previousFeed.timestamp,
      thisFeedAt: lastFeed.timestamp,
      dayIntervalHours: dayHours,
      night,
    }) &&
    !isLateFeedAckDismissed(lastFeed._id);
  void ackTick;

  const medItems = dueStatus.items.filter(
    (item) =>
      item.type === "medication" &&
      (item.status === "approaching" || item.status === "overdue")
  );

  return (
    <div className="px-3 sm:px-4 pb-5 min-w-0">
      <p className="section-label">{t("whatsDue")}</p>
      <div className="grid grid-cols-1 gap-3">
        <HeroDueCard
          kind="feed"
          title={
            dueStatus.usingNightInterval
              ? t("nextFeedDueNight")
              : t("nextFeedDue")
          }
          item={feedItem}
          emptyHint={t("logFeedForDue")}
        />
        {showPump && (
          <HeroDueCard
            kind="pump"
            title={t("nextPumpDue")}
            item={pumpItem}
            emptyHint={t("noPumpDueYet")}
          />
        )}
      </div>

      {lateLogged && lastFeed && feedItem && (
        <div className="mt-2.5 flex items-start justify-between gap-2 rounded-xl bg-surface border border-border px-3 py-2.5">
          <p className="text-xs font-medium text-muted leading-snug min-w-0">
            {t("feedLateTimingPushed", {
              time: formatTime(feedItem.dueAt),
            })}
          </p>
          <button
            type="button"
            onClick={() => {
              dismissLateFeedAck(lastFeed._id);
              setAckTick((n) => n + 1);
            }}
            className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-primary px-1.5 py-0.5"
          >
            {t("gotIt")}
          </button>
        </div>
      )}

      {medItems.length > 0 && (
        <div className="space-y-2 mt-2.5">
          {medItems.map((item, i) => {
            const isOverdue = item.status === "overdue";
            const timeText = isOverdue
              ? t("overdueBy", {
                  time: formatMinutesCompact(item.minutesUntilDue),
                })
              : t("dueIn", {
                  time: formatMinutesCompact(item.minutesUntilDue),
                });
            return (
              <div
                key={`${item.label}-${i}`}
                className={cn(
                  "rounded-2xl px-4 py-3 card-shadow border flex items-center gap-3 min-h-[3.25rem]",
                  isOverdue
                    ? "bg-[#faf0f0] border-terracotta/30"
                    : "bg-warning-light border-warning/25"
                )}
              >
                <span
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                    isOverdue ? "bg-terracotta/15" : "bg-warning/15"
                  )}
                >
                  <IconMedication size={18} className="text-secondary" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {t("nextDoseDue")}: {item.label}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-semibold mt-0.5",
                      isOverdue ? "text-terracotta" : "text-[#8a7a50]"
                    )}
                  >
                    {timeText} · {formatTime(item.dueAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
