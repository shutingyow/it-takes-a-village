"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

interface SupplyAlertModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onClose: () => void;
}

const commonItems = [
  "Diapers",
  "Wipes",
  "Formula",
  "Breast milk bags",
  "Bottles",
];

export function SupplyAlertModal({
  trackerId,
  selectedCaregiver,
  onClose,
}: SupplyAlertModalProps) {
  const createAlert = useMutation(api.supplyAlerts.create);
  const [item, setItem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert("Please select a caregiver");
      return;
    }

    if (!item.trim()) {
      alert("Please enter an item name");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAlert({
        trackerId,
        caregiverName: selectedCaregiver,
        item: item.trim(),
        timestamp: Date.now(),
      });
      onClose();
    } catch (error) {
      console.error("Failed to create supply alert:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">⚠️ Supply Alert</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What&apos;s running low?
            </label>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Diapers, formula..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {commonItems.map((commonItem) => (
              <button
                key={commonItem}
                onClick={() => setItem(commonItem)}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
              >
                {commonItem}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "CREATE ALERT"}
          </button>
        </div>
      </div>
    </div>
  );
}
