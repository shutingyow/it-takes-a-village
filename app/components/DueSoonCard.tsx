"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import {
  cn,
  formatDuration,
  formatMinutesCompact,
  formatTime,
} from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { ActivityIcon, IconFeed, IconMedication, IconPump } from "./icons";
import {
  DEFAULT_FEED_INTERVAL_HOURS,
  isLateFeed,
  resolveNightFeedSettings,
} from "@/convex/lib/feedSchedule";
import {
  dismissLateFeedAck,
  isLateFeedAckDismissed,
} from "@/app/lib/feedScheduleAck";

type DueKind = "feed" | "pump" | "sleep";

interface DueSoonCardProps {
  secretLink: string;
  selectedCaregiver: string;
  pumpScheduleEnabled?: boolean;
  /** Compact row on Today; click opens the detail view. */
  onOpenDetail?: () => void;
  /** Full click-in page with back. */
  detail?: boolean;
  onBack?: () => void;
  /** Open category / session from a detail row (ongoing → open, else → log). */
  onOpenKind?: (kind: DueKind, mode: "open" | "log") => void;
}

type DueItem = {
  type: "feed" | "medication" | "pump" | "sleep";
  label: string;
  dueAt: number;
  status: "ok" | "approaching" | "overdue" | "ongoing";
  minutesUntilDue: number;
  caregiverName?: string;
};

function sleepTitle(
  item: DueItem | null,
  t: (key: TranslationKey) => string
): string {
  if (item?.status === "ongoing") {
    return item.label === "sleep" ? t("sleepOngoing") : t("napOngoing");
  }
  return item?.label === "sleep" ? t("nextSleepDue") : t("nextNapDue");
}

function feedTitle(
  usingNight: boolean,
  ongoing: boolean,
  t: (key: TranslationKey) => string
): string {
  if (ongoing) return t("feedOngoingTitle");
  return usingNight ? t("nextFeedDueNight") : t("nextFeedDue");
}

function pumpTitle(
  ongoing: boolean,
  t: (key: TranslationKey) => string
): string {
  return ongoing ? t("pumpOngoing") : t("nextPumpDue");
}

function duePrimary(
  item: DueItem | null,
  emptyHint: string,
  t: (
    key: "overdueBy" | "dueIn" | "ongoingElapsed",
    vars: { time: string }
  ) => string
): string {
  if (!item) return emptyHint;
  if (item.status === "ongoing") {
    return t("ongoingElapsed", {
      time: formatDuration(item.dueAt),
    });
  }
  if (item.status === "overdue") {
    return t("overdueBy", {
      time: formatMinutesCompact(item.minutesUntilDue),
    });
  }
  return t("dueIn", {
    time: formatMinutesCompact(item.minutesUntilDue),
  });
}

function statusChipKey(
  item: DueItem | null
):
  | "dueStatusOngoing"
  | "dueStatusOverdue"
  | "dueStatusDue"
  | "dueStatusOk"
  | "dueStatusNone" {
  if (!item) return "dueStatusNone";
  if (item.status === "ongoing") return "dueStatusOngoing";
  if (item.status === "overdue") return "dueStatusOverdue";
  if (item.status === "approaching") return "dueStatusDue";
  return "dueStatusOk";
}

function DueRow({
  kind,
  title,
  item,
  emptyHint,
  detail,
  onOpen,
}: {
  kind: DueKind;
  title: string;
  item: DueItem | null;
  emptyHint: string;
  detail?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useLanguage();
  const isOverdue = item?.status === "overdue";
  const isOngoing = item?.status === "ongoing";
  const primary = duePrimary(item, emptyHint, t);
  const chipKey = statusChipKey(item);
  const actionLabel = isOngoing ? t("whatsDueTapToOpen") : t("whatsDueTapToLog");

  const iconWrap = cn(
    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
    isOverdue
      ? "bg-terracotta/12"
      : isOngoing
        ? kind === "feed"
          ? "bg-accent-feed/10"
          : kind === "pump"
            ? "bg-accent-pump/10"
            : "bg-accent-sleep/10"
        : "bg-beige-light"
  );

  const icon = (() => {
    if (kind === "feed") {
      return (
        <IconFeed
          size={17}
          className={
            isOverdue
              ? "text-terracotta"
              : isOngoing
                ? "text-accent-feed"
                : "text-accent-feed"
          }
        />
      );
    }
    if (kind === "pump") {
      return (
        <IconPump
          size={17}
          className={isOverdue ? "text-terracotta" : "text-accent-pump"}
        />
      );
    }
    return (
      <ActivityIcon
        type="nap"
        size={17}
        className={isOverdue ? "text-terracotta" : "text-accent-sleep"}
      />
    );
  })();

  const body = (
    <>
      <span className={iconWrap}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {title}
          </p>
          {detail && (
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded-md",
                isOverdue
                  ? "bg-terracotta/12 text-terracotta"
                  : isOngoing
                    ? "bg-primary-light text-primary"
                    : item
                      ? "bg-beige-light text-muted"
                      : "bg-beige-light text-muted"
              )}
            >
              {t(chipKey)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-sm tabular-nums mt-0.5 min-w-0",
            isOverdue
              ? "font-semibold text-terracotta"
              : isOngoing
                ? "font-semibold text-foreground"
                : item
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted"
          )}
        >
          {primary}
          {item && item.status !== "ongoing" && (
            <span className="text-muted font-medium ml-1.5">
              · {formatTime(item.dueAt)}
            </span>
          )}
          {isOngoing && item?.caregiverName && (
            <span className="text-muted font-medium ml-1.5">
              · {t("startedBy", { name: item.caregiverName })}
            </span>
          )}
        </p>
      </div>
      {detail && onOpen && (
        <span className="text-xs font-semibold text-primary shrink-0">
          {actionLabel}
          <span className="text-muted ml-0.5" aria-hidden>
            ›
          </span>
        </span>
      )}
    </>
  );

  if (detail && onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-3 min-w-0 py-3 text-left"
      >
        {body}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5 min-w-0 py-1.5">{body}</div>
  );
}

function useDueSoonData(
  secretLink: string,
  selectedCaregiver: string,
  now: number
) {
  const dueStatus = useQuery(api.reminders.getDueStatus, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    now,
  });
  const recentFeeds = useQuery(api.feedEntries.getRecentMilk, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    limit: 2,
  });
  return { dueStatus, recentFeeds };
}

export function DueSoonCard({
  secretLink,
  selectedCaregiver,
  pumpScheduleEnabled,
  onOpenDetail,
  detail = false,
  onBack,
  onOpenKind,
}: DueSoonCardProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(Date.now());
  const [ackTick, setAckTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const { dueStatus, recentFeeds } = useDueSoonData(
    secretLink,
    selectedCaregiver,
    now
  );

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
  const sleepItem =
    dueStatus.items.find((item) => item.type === "sleep") ?? null;
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
    feedItem?.status !== "ongoing" &&
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

  const headlineCandidates = [
    feedItem,
    showPump ? pumpItem : null,
    sleepItem,
    ...medItems,
  ].filter((item): item is DueItem => item != null);

  // Overdue / approaching beat ongoing for the Home strip; ongoing still wins over "ok".
  const urgent =
    headlineCandidates.find((item) => item.status === "overdue") ??
    headlineCandidates.find((item) => item.status === "approaching") ??
    headlineCandidates.find((item) => item.status === "ongoing") ??
    headlineCandidates.find((item) => item.status === "ok") ??
    headlineCandidates[0] ??
    null;

  const urgentTitle = !urgent
    ? t("whatsDueAllClear")
    : urgent.type === "feed"
      ? feedTitle(!!dueStatus.usingNightInterval, urgent.status === "ongoing", t)
      : urgent.type === "pump"
        ? pumpTitle(urgent.status === "ongoing", t)
        : urgent.type === "sleep"
          ? sleepTitle(urgent, t)
          : urgent.label;

  const urgentLine = !urgent
    ? t("whatsDueAllClear")
    : urgent.status === "ongoing"
      ? `${urgentTitle} · ${formatDuration(urgent.dueAt)}`
      : `${urgentTitle} · ${duePrimary(urgent, "", t)}`;

  if (!detail) {
    return (
      <div className="px-4 pb-3 min-w-0">
        <button
          type="button"
          onClick={onOpenDetail}
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 shadow-sm text-left flex items-center gap-3 min-w-0"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {t("whatsDue")}
            </p>
            <p
              className={cn(
                "text-sm font-semibold truncate mt-0.5",
                urgent?.status === "overdue"
                  ? "text-terracotta"
                  : "text-foreground"
              )}
            >
              {urgentLine}
              {urgent && urgent.status !== "ongoing" && (
                <span className="text-muted font-medium">
                  {" "}
                  · {formatTime(urgent.dueAt)}
                </span>
              )}
            </p>
          </div>
          <span className="text-muted text-lg leading-none shrink-0" aria-hidden>
            ›
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="pb-2 min-w-0">
      <div className="px-4 pt-2 pb-1">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-primary py-2 pr-2"
        >
          ← {t("categoryBackHome")}
        </button>
      </div>

      <div className="px-4 pb-4 min-w-0">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-[#fffaf7] to-white px-1 pt-3 pb-1 shadow-sm">
          <div className="px-3 pb-3 border-b border-border/70">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {t("whatsDue")}
            </p>
            <h2 className="text-lg font-semibold text-foreground mt-0.5 leading-snug">
              {urgentLine}
            </h2>
            <p className="text-xs text-muted mt-1 leading-snug">
              {t("whatsDueSubtitle")}
            </p>
          </div>

          <DueRow
            kind="feed"
            title={feedTitle(
              !!dueStatus.usingNightInterval,
              feedItem?.status === "ongoing",
              t
            )}
            item={feedItem}
            emptyHint={t("logFeedForDue")}
            detail
            onOpen={
              onOpenKind
                ? () =>
                    onOpenKind(
                      "feed",
                      feedItem?.status === "ongoing" ? "open" : "log"
                    )
                : undefined
            }
          />
          <div className="border-t border-border/70 mx-3" />
          <DueRow
            kind="sleep"
            title={sleepTitle(sleepItem, t)}
            item={sleepItem}
            emptyHint={t("noSleepDueYet")}
            detail
            onOpen={
              onOpenKind
                ? () =>
                    onOpenKind(
                      "sleep",
                      sleepItem?.status === "ongoing" ? "open" : "log"
                    )
                : undefined
            }
          />
          {showPump ? (
            <>
              <div className="border-t border-border/70 mx-3" />
              <DueRow
                kind="pump"
                title={pumpTitle(pumpItem?.status === "ongoing", t)}
                item={pumpItem}
                emptyHint={t("noPumpDueYet")}
                detail
                onOpen={
                  onOpenKind
                    ? () =>
                        onOpenKind(
                          "pump",
                          pumpItem?.status === "ongoing" ? "open" : "log"
                        )
                    : undefined
                }
              />
            </>
          ) : (
            <p className="text-[11px] text-muted px-3 py-2.5 border-t border-border/70 mx-3 mt-1">
              {t("pumpRemindersOptionalHint")}
            </p>
          )}

          {lateLogged && lastFeed && feedItem && (
            <div className="mx-3 mb-2 mt-1 flex items-start justify-between gap-2 rounded-lg bg-beige-light/80 px-2.5 py-2">
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
            <div className="mx-3 mb-2 mt-1 space-y-1 border-t border-border/70 pt-2">
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
                    className="flex items-center gap-2.5 min-w-0 py-1.5 px-0.5"
                  >
                    <span className="w-9 h-9 rounded-xl bg-beige-light flex items-center justify-center shrink-0">
                      <IconMedication
                        size={15}
                        className={
                          isOverdue ? "text-terracotta" : "text-secondary"
                        }
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.label}
                      </p>
                      <p
                        className={cn(
                          "text-xs font-semibold tabular-nums mt-0.5",
                          isOverdue ? "text-terracotta" : "text-muted"
                        )}
                      >
                        {timeText}
                        <span className="text-muted font-medium ml-1">
                          · {formatTime(item.dueAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
