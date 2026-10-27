"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import {
  formatDate,
  formatMinutesCompact,
  formatTime,
  formatTimeAgo,
} from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { ActivityEntryCard, type ActivityEntry } from "./ActivityEntryCard";
import { EditActivitySheet } from "./EditActivitySheet";
import { FeedIntervalList } from "./FeedIntervalList";
import type { HomeCategory } from "./HomeCategoryGrid";
import { ActivityIcon, type ActivityType } from "./icons";

const CATEGORY_META: Record<
  HomeCategory,
  {
    labelKey: TranslationKey;
    icon: ActivityType;
    historyType: "feed" | "diaper" | "pump" | "activity" | "nap" | "moment";
    accent: string;
    text: string;
  }
> = {
  feed: {
    labelKey: "feed",
    icon: "feed",
    historyType: "feed",
    accent: "bg-accent-feed-light",
    text: "text-accent-feed",
  },
  diaper: {
    labelKey: "diaper",
    icon: "diaper",
    historyType: "diaper",
    accent: "bg-accent-diaper-light",
    text: "text-accent-diaper",
  },
  pump: {
    labelKey: "pump",
    icon: "pump",
    historyType: "pump",
    accent: "bg-accent-pump-light",
    text: "text-accent-pump",
  },
  activity: {
    labelKey: "filterActivity",
    icon: "activity",
    historyType: "activity",
    accent: "bg-primary-light",
    text: "text-primary",
  },
  nap: {
    labelKey: "nap",
    icon: "nap",
    historyType: "nap",
    accent: "bg-accent-sleep-light",
    text: "text-accent-sleep",
  },
  moment: {
    labelKey: "filterMoments",
    icon: "moment",
    historyType: "moment",
    accent: "bg-terracotta-light",
    text: "text-terracotta",
  },
};

interface HomeCategoryDetailProps {
  category: HomeCategory;
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  onBack: () => void;
  onLog: (type: HomeCategory) => void;
}

export function HomeCategoryDetail({
  category,
  trackerId,
  secretLink,
  selectedCaregiver,
  onBack,
  onLog,
}: HomeCategoryDetailProps) {
  const { t } = useLanguage();
  const meta = CATEGORY_META[category];
  const [now, setNow] = useState(() => Date.now());
  const [editingEntry, setEditingEntry] = useState<ActivityEntry | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dueStatus = useQuery(
    api.reminders.getDueStatus,
    category === "feed" || category === "pump"
      ? { trackerId, now }
      : "skip"
  );

  const activity = useQuery(api.history.getActivity, {
    trackerId,
    limit: 50,
    type: meta.historyType,
  });

  const removeFeed = useMutation(api.feedEntries.remove);
  const removeDiaper = useMutation(api.diaperEntries.remove);
  const removePump = useMutation(api.pumpEntries.remove);
  const removeSleep = useMutation(api.sleepEntries.remove);
  const removeActivity = useMutation(api.activityEntries.remove);
  const removeMoment = useMutation(api.momentEntries.remove);

  const dueItem =
    dueStatus?.items.find((item) => item.type === category) ?? null;
  const lastEntry = activity?.[0];

  const groupedByDate = useMemo(() => {
    if (!activity) return [];
    const groups: Array<{ date: string; entries: typeof activity }> = [];
    const indexByDate = new Map<string, number>();
    for (const entry of activity) {
      const date = formatDate(entry.time);
      const existing = indexByDate.get(date);
      if (existing === undefined) {
        indexByDate.set(date, groups.length);
        groups.push({ date, entries: [entry] });
      } else {
        groups[existing]!.entries.push(entry);
      }
    }
    return groups;
  }, [activity]);

  const handleDelete = async (entry: ActivityEntry) => {
    if (!confirm(t("confirmDeleteEntry"))) return;
    try {
      if (entry.entryType === "feed") {
        await removeFeed({ entryId: entry._id });
      } else if (entry.entryType === "diaper") {
        await removeDiaper({ entryId: entry._id });
      } else if (entry.entryType === "pump") {
        await removePump({ entryId: entry._id });
      } else if (entry.entryType === "sleep" || entry.entryType === "nap") {
        await removeSleep({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: entry._id,
        });
      } else if (entry.entryType === "activity") {
        await removeActivity({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: entry._id,
        });
      } else if (entry.entryType === "moment") {
        await removeMoment({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: entry._id,
        });
      }
    } catch (error) {
      console.error("Failed to delete entry:", error);
      alert(t("deleteFailed"));
    }
  };

  let duePrimary: string | null = null;
  let dueSecondary: string | null = null;
  if (dueItem) {
    if (dueItem.status === "overdue") {
      duePrimary = t("overdueBy", {
        time: formatMinutesCompact(dueItem.minutesUntilDue),
      });
    } else {
      duePrimary = t("dueIn", {
        time: formatMinutesCompact(dueItem.minutesUntilDue),
      });
    }
    dueSecondary = t("dueAtClock", { time: formatTime(dueItem.dueAt) });
  }

  return (
    <div className="pb-8 min-w-0">
      <div className="px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 text-sm font-semibold text-primary flex items-center gap-1"
        >
          ← {t("categoryBackHome")}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span
            className={`w-12 h-12 rounded-2xl ${meta.accent} flex items-center justify-center`}
          >
            <ActivityIcon
              type={meta.icon}
              size={24}
              className={meta.text}
            />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">
              {t(meta.labelKey)}
            </h2>
            {lastEntry ? (
              <p className="text-xs text-muted mt-0.5">
                {t("lastEntry")}: {formatTimeAgo(lastEntry.time)} ·{" "}
                {formatTime(lastEntry.time)}
              </p>
            ) : (
              <p className="text-xs text-muted mt-0.5">{t("noLastEntryYet")}</p>
            )}
          </div>
        </div>

        {(category === "feed" || category === "pump") && (
          <div
            className={
              category === "feed"
                ? "rounded-2xl border border-[#e0a8a0] bg-[#f0c4bc] px-4 py-3.5 mb-4"
                : `rounded-2xl border border-border px-4 py-3 mb-4 ${meta.accent}`
            }
          >
            <div className="flex items-start gap-3">
              <span
                className={
                  category === "feed"
                    ? "w-11 h-11 rounded-xl bg-white/35 border border-white/70 flex items-center justify-center shrink-0 text-[#fff8f6]"
                    : `w-11 h-11 rounded-xl ${meta.accent} flex items-center justify-center shrink-0`
                }
              >
                <ActivityIcon
                  type={meta.icon}
                  size={22}
                  strokeWidth={2.4}
                  className={
                    category === "feed" ? "text-[#fff8f6]" : meta.text
                  }
                />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    category === "feed"
                      ? "text-xs font-bold uppercase tracking-wider text-white/90 mb-1"
                      : "text-xs font-semibold uppercase tracking-wider text-muted mb-1"
                  }
                >
                  {category === "feed"
                    ? dueItem?.status === "overdue"
                      ? t("feedOverdueTitle")
                      : t("nextFeedDue")
                    : t("nextPumpDue")}
                </p>
                {duePrimary ? (
                  <>
                    <p
                      className={
                        category === "feed"
                          ? "text-xl font-bold text-white"
                          : `text-lg font-bold ${meta.text}`
                      }
                    >
                      {duePrimary}
                    </p>
                    {dueSecondary && (
                      <p
                        className={
                          category === "feed"
                            ? "text-sm font-medium text-white/80 mt-0.5"
                            : "text-xs text-muted mt-0.5"
                        }
                      >
                        {dueSecondary}
                      </p>
                    )}
                  </>
                ) : (
                  <p
                    className={
                      category === "feed"
                        ? "text-sm font-medium text-white/85"
                        : "text-sm text-muted"
                    }
                  >
                    {category === "feed"
                      ? t("logFeedForDue")
                      : t("noPumpDueYet")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onLog(category)}
          className="btn-primary w-full mb-5"
        >
          {t("categoryLogCta", { type: t(meta.labelKey) })}
        </button>
      </div>

      <div className="px-4 min-w-0">
        <p className="section-label">{t("categoryRecent")}</p>
        {activity === undefined ? (
          <p className="text-xs text-muted">{t("loadingHistory")}</p>
        ) : activity.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm bg-surface rounded-2xl border border-border">
            {t("categoryEmpty")}
          </div>
        ) : (
          <div className="space-y-5 min-w-0">
            {groupedByDate.map(({ date, entries }) => (
              <div key={date} className="min-w-0">
                <div className="text-sm font-semibold text-foreground mb-2.5 pb-1.5 border-b border-border">
                  {date}
                </div>
                {category === "feed" ? (
                  <div className="bg-surface border border-border rounded-2xl px-3 py-2 min-w-0 overflow-hidden">
                    <FeedIntervalList
                      feeds={entries.filter(
                        (
                          entry
                        ): entry is Extract<
                          ActivityEntry,
                          { entryType: "feed" }
                        > => entry.entryType === "feed"
                      )}
                      order="newest"
                      onEdit={setEditingEntry}
                      onDelete={handleDelete}
                    />
                  </div>
                ) : (
                  <div className="pl-1 min-w-0">
                    {entries.map((entry, index) => (
                      <ActivityEntryCard
                        key={entry._id}
                        entry={entry}
                        timeLabel={formatTime(entry.time)}
                        isLast={index === entries.length - 1}
                        onEdit={setEditingEntry}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingEntry && (
        <EditActivitySheet
          entry={editingEntry}
          trackerId={trackerId}
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
