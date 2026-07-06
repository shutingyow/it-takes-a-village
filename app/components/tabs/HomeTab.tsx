"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { FeedModal } from "../modals/FeedModal";
import { SleepModal } from "../modals/SleepModal";
import { DiaperModal } from "../modals/DiaperModal";
import { PumpModal } from "../modals/PumpModal";

interface HomeTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

type ModalType = "feed" | "sleep" | "diaper" | "pump" | null;

export function HomeTab({ trackerId, selectedCaregiver }: HomeTabProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const quickActions = [
    { id: "feed" as const, emoji: "🍼", label: "FEED" },
    { id: "sleep" as const, emoji: "💤", label: "SLEEP" },
    { id: "diaper" as const, emoji: "💩", label: "DIAPER" },
    { id: "pump" as const, emoji: "🤱", label: "PUMP" },
  ];

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        QUICK ACTIONS
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => setActiveModal(action.id)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-6 px-4 rounded-lg transition-colors shadow-md"
          >
            <div className="text-3xl mb-2">{action.emoji}</div>
            <div className="text-sm">{action.label}</div>
          </button>
        ))}
      </div>

      {/* Modals */}
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
