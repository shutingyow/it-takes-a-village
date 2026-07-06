"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

interface FeedModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onClose: () => void;
}

export function FeedModal({
  trackerId,
  selectedCaregiver,
  onClose,
}: FeedModalProps) {
  const createFeed = useMutation(api.feedEntries.create);
  const [step, setStep] = useState<"type" | "details">("type");
  const [feedType, setFeedType] = useState<"breast" | "bottle">("breast");
  const [side, setSide] = useState<"left" | "right">("left");
  const [duration, setDuration] = useState(15);
  const [amount, setAmount] = useState(120);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert("Please select a caregiver");
      return;
    }

    setIsSubmitting(true);
    try {
      await createFeed({
        trackerId,
        caregiverName: selectedCaregiver,
        type: feedType,
        side: feedType === "breast" ? side : undefined,
        duration: feedType === "breast" ? duration : undefined,
        amount: feedType === "bottle" ? amount : undefined,
        timestamp: Date.now(),
        notes: notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create feed:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">🍼 Log Feed</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {step === "type" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Select feed type:</p>
              <button
                onClick={() => {
                  setFeedType("breast");
                  setStep("details");
                }}
                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold py-4 px-4 rounded-lg transition-colors"
              >
                🤱 BREAST FEEDING
              </button>
              <button
                onClick={() => {
                  setFeedType("bottle");
                  setStep("details");
                }}
                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold py-4 px-4 rounded-lg transition-colors"
              >
                🍼 BOTTLE FEEDING
              </button>
            </div>
          )}

          {step === "details" && feedType === "breast" && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("type")}
                className="text-sm text-blue-600 hover:underline"
              >
                ← Change type
              </button>

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
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (optional): {duration} minutes
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDuration(Math.max(1, duration - 5))}
                    className="px-3 py-1 bg-gray-200 rounded"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex-1"
                  />
                  <button
                    onClick={() => setDuration(Math.min(60, duration + 5))}
                    className="px-3 py-1 bg-gray-200 rounded"
                  >
                    +
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
                  placeholder="Baby seemed extra hungry..."
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
          )}

          {step === "details" && feedType === "bottle" && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("type")}
                className="text-sm text-blue-600 hover:underline"
              >
                ← Change type
              </button>

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
          )}
        </div>
      </div>
    </div>
  );
}
