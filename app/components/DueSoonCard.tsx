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

function dueLabel(
  item: DueItem | null,
  emptyHint: string,
  t: (key: "overdueBy" | "dueIn", vars: { time: string }) => string
): string {
  if (!item) return emptyHint;
  if (item.status === "overdue") {
    return t("overdueBy", {
      time: formatMinutesCompact(item.minutesUntilDue),
    });
  }
  return t("dueIn", {
    time: formatMinutesCompact(item.minutesUntilDue),
  });
}

function DueRow({
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
  const primary = dueLabel(item, emptyHint, t);

  return (
    <div className="flex items-center gap-2.5 min-w-0 py-1.5">
      <span
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
          isOverdue ? "bg-terracotta/10" : "bg-beige-light"
        )}
      >
        {kind === "feed" ? (
          <IconFeed
            size={15}
            className={isOverdue ? "text-terracotta" : "text-accent-feed"}
          />
        ) : (
          <IconPump
            size={15}
            className={isOverdue ? "text-terracotta" : "text-accent-pump"}
          />
        )}
      </span>
      <p className="text-xs font-semibold text-muted shrink-0 w-[4.5rem] truncate">
        {title}
      </p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums min-w-0 flex-1 truncate",
          isOverdue ? "text-terracotta" : "text-foreground",
          !item && "font-medium text-muted"
        )}
      >
        {primary}
        {item && (
          <span className="text-muted font-medium ml-1.5">
            · {formatTime(item.dueAt)}
          </span>
        )}
      </p>
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
      <div className="px-4 pb-3 min-w-0">
        <div className="h-14 rounded-xl bg-surface border border-border animate-pulse" />
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
    <div className="px-4 pb-3 min-w-0">
      <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-0.5">
          {t("whatsDue")}
        </p>
        <DueRow
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
          <>
            <div className="border-t border-border/70" />
            <DueRow
              kind="pump"
              title={t("nextPumpDue")}
              item={pumpItem}
              emptyHint={t("noPumpDueYet")}
            />
          </>
        )}

        {lateLogged && lastFeed && feedItem && (
          <div className="mt-1.5 flex items-start justify-between gap-2 rounded-lg bg-beige-light/80 px-2 py-1.5">
            <p className="text-[11px] font-medium text-muted leading-snug min-w-0">
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
              className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-primary px-1"
            >
              {t("gotIt")}
            </button>
          </div>
        )}

        {medItems.length > 0 && (
          <div className="mt-1.5 space-y-1 border-t border-border/70 pt-1.5">
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
                  className="flex items-center gap-2 min-w-0 py-0.5"
                >
                  <IconMedication
                    size={14}
                    className={
                      isOverdue ? "text-terracotta shrink-0" : "text-secondary shrink-0"
                    }
                  />
                  <p className="text-xs font-medium text-foreground truncate min-w-0 flex-1">
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-semibold tabular-nums shrink-0",
                      isOverdue ? "text-terracotta" : "text-muted"
                    )}
                  >
                    {timeText}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
