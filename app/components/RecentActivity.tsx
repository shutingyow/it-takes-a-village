"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatTime } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityEntryCard, type ActivityEntry } from "./ActivityEntryCard";
import { FeedIntervalList } from "./FeedIntervalList";
import { EditActivitySheet } from "./EditActivitySheet";
import {
  ActivityTypeFilter,
  RECENT_ACTIVITY_FILTERS,
  type ActivityFilterType,
} from "./ActivityTypeFilter";
import { useState } from "react";

const RECENT_LIMIT = 8;

interface RecentActivityProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  onViewAll?: () => void;
}

export function RecentActivity({
  trackerId,
  secretLink,
  selectedCaregiver,
  onViewAll,
}: RecentActivityProps) {
  const { t } = useLanguage();
  const [editingEntry, setEditingEntry] = useState<ActivityEntry | null>(null);
  const [filter, setFilter] = useState<ActivityFilterType>("all");

  const removeFeed = useMutation(api.feedEntries.remove);
  const removeDiaper = useMutation(api.diaperEntries.remove);
  const removePump = useMutation(api.pumpEntries.remove);
  const removeHealth = useMutation(api.healthEntries.remove);
  const removeSleep = useMutation(api.sleepEntries.remove);
  const removeGrowth = useMutation(api.growthEntries.remove);
  const removeActivity = useMutation(api.activityEntries.remove);
  const removeMoment = useMutation(api.momentEntries.remove);

  const anyActivity = useQuery(api.history.getActivity, {
    trackerId,
    limit: 1,
    type: "all",
  });

  const activity = useQuery(api.history.getActivity, {
    trackerId,
    limit: filter === "all" ? 40 : RECENT_LIMIT,
    type: filter,
  });

  const handleDelete = async (entry: ActivityEntry) => {
    if (!confirm(t("confirmDeleteEntry"))) return;
    try {
      if (entry.entryType === "feed") {
        await removeFeed({ entryId: entry._id });
      } else if (entry.entryType === "diaper") {
        await removeDiaper({ entryId: entry._id });
      } else if (entry.entryType === "pump") {
        await removePump({ entryId: entry._id });
      } else if (entry.entryType === "health") {
        await removeHealth({ entryId: entry._id });
      } else if (entry.entryType === "sleep" || entry.entryType === "nap") {
        await removeSleep({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: entry._id,
        });
      } else if (entry.entryType === "growth") {
        await removeGrowth({ entryId: entry._id });
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

  const visibleActivity =
    activity === undefined
      ? undefined
      : (filter === "all"
          ? activity.filter((entry) => entry.entryType !== "sleep")
          : activity
        ).slice(0, RECENT_LIMIT);

  if (anyActivity === undefined || activity === undefined || visibleActivity === undefined) {
    return (
      <div className="px-4 mt-2 pb-4">
        <p className="text-xs text-muted">{t("loadingHistory")}</p>
      </div>
    );
  }

  // Hide section entirely when the tracker has no activity at all
  if (anyActivity.length === 0) {
    return null;
  }

  return (
    <div className="px-4 mt-2 pb-8 min-w-0">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="section-label mb-0">{t("recentActivity")}</p>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-terracotta px-2 py-1.5 -mr-1 rounded-lg active:bg-terracotta-light touch-manipulation shrink-0"
          >
            {t("viewAllHistory")}
          </button>
        )}
      </div>

      <ActivityTypeFilter
        value={filter}
        onChange={setFilter}
        types={RECENT_ACTIVITY_FILTERS}
        className="mb-3"
      />

      {visibleActivity.length === 0 ? (
        <div className="text-center py-6 text-muted text-sm bg-surface rounded-2xl border border-border">
          {t("noMatchingEntries")}
        </div>
      ) : filter === "feed" ? (
        <div className="bg-surface border border-border rounded-2xl px-3 py-2 min-w-0 overflow-hidden">
          <FeedIntervalList
            feeds={visibleActivity.filter(
              (entry): entry is Extract<ActivityEntry, { entryType: "feed" }> =>
                entry.entryType === "feed"
            )}
            order="newest"
            onEdit={setEditingEntry}
            onDelete={handleDelete}
          />
        </div>
      ) : (
        <div className="pl-1 min-w-0">
          {visibleActivity.map((entry, index) => (
            <ActivityEntryCard
              key={entry._id}
              entry={entry}
              timeLabel={formatTime(entry.time)}
              isLast={index === visibleActivity.length - 1}
              onEdit={setEditingEntry}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

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
