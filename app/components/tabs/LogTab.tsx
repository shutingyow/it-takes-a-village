"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { FeedModal } from "../modals/FeedModal";
import { SleepModal } from "../modals/SleepModal";
import { DiaperModal } from "../modals/DiaperModal";
import { PumpModal } from "../modals/PumpModal";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatTimeAgo } from "@/app/lib/utils";

interface LogTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

type ModalType = "feed" | "sleep" | "diaper" | "pump" | null;

export function LogTab({ trackerId, selectedCaregiver }: LogTabProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const lastFeed = useQuery(api.feedEntries.getLast, { trackerId });
  const lastDiaper = useQuery(api.diaperEntries.getLast, { trackerId });
  const lastPump = useQuery(api.pumpEntries.getLast, { trackerId });
  const activeSleep = useQuery(api.sleepEntries.getActive, { trackerId });

  const logItems = [
    {
      id: "feed" as const,
      emoji: "🍼",
      label: "FEED BABY",
      last: lastFeed ? formatTimeAgo(lastFeed.timestamp) : "Never",
    },
    {
      id: "sleep" as const,
      emoji: "💤",
      label: "SLEEP",
      last: activeSleep ? "Currently sleeping" : "Awake",
    },
    {
      id: "diaper" as const,
      emoji: "💩",
      label: "DIAPER CHANGE",
      last: lastDiaper ? formatTimeAgo(lastDiaper.timestamp) : "Never",
    },
    {
      id: "pump" as const,
      emoji: "🤱",
      label: "PUMP",
      last: lastPump ? formatTimeAgo(lastPump.timestamp) : "Never",
    },
  ];

  return (
    <div className="p-4">
      <h2 className="text-sm text-gray-600 mb-4">Tap an activity to log:</h2>
      <div className="space-y-3">
        {logItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveModal(item.id)}
            className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 text-blue-900 font-semibold py-4 px-4 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{item.label}</div>
                <div className="text-sm text-blue-700">Last: {item.last}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {activeModal === "feed" && (
        <FeedModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "sleep" && (
        <SleepModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "diaper" && (
        <DiaperModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "pump" && (
        <PumpModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
