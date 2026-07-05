"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatTime, formatDate, formatDuration } from "@/app/lib/utils";

interface HistoryTabProps {
  trackerId: Id<"trackers">;
}

export function HistoryTab({ trackerId }: HistoryTabProps) {
  const activity = useQuery(api.history.getActivity, {
    trackerId,
    limit: 100,
    type: "all",
  });

  if (!activity) {
    return (
      <div className="p-4 text-center text-gray-600">Loading history...</div>
    );
  }

  // Group by date
  const groupedByDate: Record<string, typeof activity> = {};
  activity.forEach((entry) => {
    const date = formatDate(entry.time);
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(entry);
  });

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-sm text-gray-600">Last 7 days</h2>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByDate).map(([date, entries]) => (
          <div key={date}>
            <div className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b">
              {date}
            </div>
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry._id} className="flex gap-3">
                  <div className="text-sm text-gray-600 min-w-[60px]">
                    {formatTime(entry.time)}
                  </div>
                  <div className="flex-1">
                    {entry.entryType === "feed" && (
                      <div>
                        <span className="text-sm font-medium">
                          🍼 {entry.type === "breast" ? "Breast" : "Bottle"} Feed
                        </span>
                        <div className="text-xs text-gray-600">
                          {entry.type === "breast"
                            ? entry.side && entry.duration
                              ? `${entry.side} side, ${entry.duration}m`
                              : "Breast feed"
                            : `${entry.amount}ml`}
                          {" • by "}{entry.caregiverName}
                        </div>
                      </div>
                    )}
                    {entry.entryType === "sleep" && (
                      <div>
                        <span className="text-sm font-medium">
                          💤 Sleep {entry.endTime ? "Session" : "(Active)"}
                        </span>
                        <div className="text-xs text-gray-600">
                          {entry.endTime
                            ? formatDuration(entry.startTime, entry.endTime)
                            : "Currently sleeping"}
                          {" • by "}{entry.caregiverName}
                        </div>
                      </div>
                    )}
                    {entry.entryType === "diaper" && (
                      <div>
                        <span className="text-sm font-medium">
                          💩 Diaper - {entry.type}
                        </span>
                        <div className="text-xs text-gray-600">
                          by {entry.caregiverName}
                        </div>
                      </div>
                    )}
                    {entry.entryType === "pump" && (
                      <div>
                        <span className="text-sm font-medium">
                          🤱 Pump - {entry.amount}ml
                        </span>
                        <div className="text-xs text-gray-600">
                          {entry.side && `${entry.side} side • `}by {entry.caregiverName}
                        </div>
                      </div>
                    )}
                    {entry.entryType === "health" && (
                      <div>
                        <span className="text-sm font-medium">
                          🏥 Health - {entry.type}
                        </span>
                        <div className="text-xs text-gray-600">
                          by {entry.caregiverName}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activity.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No entries yet. Start logging activities!
        </div>
      )}
    </div>
  );
}
