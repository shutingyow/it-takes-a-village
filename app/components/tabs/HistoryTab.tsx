"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatTime, formatDate } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityEntryCard, type ActivityEntry } from "../ActivityEntryCard";
import { FeedIntervalList } from "../FeedIntervalList";
import { EditActivitySheet } from "../EditActivitySheet";
import {
  ActivityTypeFilter,
  type ActivityFilterType,
} from "../ActivityTypeFilter";
import { useState } from "react";

interface HistoryTabProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
}

export function HistoryTab({
  trackerId,
  secretLink,
  selectedCaregiver,
}: HistoryTabProps) {
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

  const activity = useQuery(api.history.getActivity, {
    trackerId,
    limit: 100,
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

  if (!activity) {
    return (
      <div className="p-4 text-center text-muted text-sm">{t("loadingHistory")}</div>
    );
  }

  const groupedByDate: Record<string, typeof activity> = {};
  activity.forEach((entry) => {
    const date = formatDate(entry.time);
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(entry);
  });

  return (
    <div className="p-4 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
        {t("last7Days")}
      </p>

      <ActivityTypeFilter
        value={filter}
        onChange={setFilter}
        className="mb-4"
      />

      <div className="space-y-6">
        {Object.entries(groupedByDate).map(([date, entries]) => (
          <div key={date}>
            <div className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border">
              {date}
            </div>
            {filter === "feed" ? (
              <div className="bg-surface border border-border rounded-2xl px-3 py-2 min-w-0 overflow-hidden">
                <FeedIntervalList
                  feeds={entries.filter(
                    (
                      entry
                    ): entry is Extract<ActivityEntry, { entryType: "feed" }> =>
                      entry.entryType === "feed"
                  )}
                  order="newest"
                  onEdit={setEditingEntry}
                  onDelete={handleDelete}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <ActivityEntryCard
                    key={entry._id}
                    entry={entry}
                    timeLabel={formatTime(entry.time)}
                    onEdit={setEditingEntry}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {activity.length === 0 && (
        <div className="text-center py-8 text-muted text-sm bg-surface rounded-2xl border border-border">
          {filter === "all" ? t("noEntriesYet") : t("noMatchingEntries")}
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
