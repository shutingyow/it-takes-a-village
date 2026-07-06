"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { HealthModal } from "../modals/HealthModal";
import { formatTimeAgo } from "@/app/lib/utils";

interface HealthTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

type HealthType = "temperature" | "medication" | "weight";

const healthItems: {
  id: HealthType;
  emoji: string;
  label: string;
}[] = [
  { id: "temperature", emoji: "🌡️", label: "TEMPERATURE" },
  { id: "medication", emoji: "💊", label: "MEDICATION / VITAMINS" },
  { id: "weight", emoji: "⚖️", label: "WEIGHT CHECK" },
];

export function HealthTab({ trackerId, selectedCaregiver }: HealthTabProps) {
  const [activeModal, setActiveModal] = useState<HealthType | null>(null);
  const lastTemp = useQuery(api.healthEntries.getByType, {
    trackerId,
    type: "temperature",
    limit: 1,
  });
  const lastMed = useQuery(api.healthEntries.getByType, {
    trackerId,
    type: "medication",
    limit: 1,
  });
  const lastWeight = useQuery(api.healthEntries.getByType, {
    trackerId,
    type: "weight",
    limit: 1,
  });

  const lastByType: Record<HealthType, string> = {
    temperature: lastTemp?.[0]
      ? `${lastTemp[0].temperature?.toFixed(1)}°F • ${formatTimeAgo(lastTemp[0].timestamp)}`
      : "Never",
    medication: lastMed?.[0]
      ? `${lastMed[0].medicationName} • ${formatTimeAgo(lastMed[0].timestamp)}`
      : "Never",
    weight: lastWeight?.[0]
      ? `${lastWeight[0].weight?.toFixed(1)} lbs • ${formatTimeAgo(lastWeight[0].timestamp)}`
      : "Never",
  };

  return (
    <div className="p-4">
      <h2 className="text-sm text-gray-600 mb-4">Tap to log a health entry:</h2>
      <div className="space-y-3">
        {healthItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveModal(item.id)}
            className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 text-blue-900 font-semibold py-4 px-4 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{item.label}</div>
                <div className="text-sm text-blue-700">
                  Last: {lastByType[item.id]}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {activeModal && (
        <HealthModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          healthType={activeModal}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
