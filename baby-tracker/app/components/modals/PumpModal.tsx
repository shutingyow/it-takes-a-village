"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

interface PumpModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onClose: () => void;
}

export function PumpModal({
  trackerId,
  selectedCaregiver,
  onClose,
}: PumpModalProps) {
  const createPump = useMutation(api.pumpEntries.create);
  const [amount, setAmount] = useState(150);
  const [side, setSide] = useState<"left" | "right" | "both">("both");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert("Please select a caregiver");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPump({
        trackerId,
        caregiverName: selectedCaregiver,
        amount,
        side,
        timestamp: Date.now(),
        notes: notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create pump entry:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">🤱 Pump Session</h2>
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
              Amount: {amount} ml
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAmount(Math.max(10, amount - 10))}
                className="px-3 py-1 bg-gray-200 rounded"
              >
                −
              </button>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="flex-1"
              />
              <button
                onClick={() => setAmount(Math.min(300, amount + 10))}
                className="px-3 py-1 bg-gray-200 rounded"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Side (optional):
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSide("left")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                  side === "left"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                L
              </button>
              <button
                onClick={() => setSide("right")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                  side === "right"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                R
              </button>
              <button
                onClick={() => setSide("both")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                  side === "both"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                Both
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              rows={2}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "SAVE ENTRY"}
          </button>
        </div>
      </div>
    </div>
  );
}
