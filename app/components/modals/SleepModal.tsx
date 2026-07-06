"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { formatDuration } from "@/app/lib/utils";

interface SleepModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onClose: () => void;
}

export function SleepModal({
  trackerId,
  selectedCaregiver,
  onClose,
}: SleepModalProps) {
  const startSleep = useMutation(api.sleepEntries.start);
  const endSleep = useMutation(api.sleepEntries.end);
  const createSleep = useMutation(api.sleepEntries.create);
  const activeSleep = useQuery(api.sleepEntries.getActive, { trackerId });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartSleep = async () => {
    if (!selectedCaregiver) {
      alert("Please select a caregiver");
      return;
    }

    setIsSubmitting(true);
    try {
      await startSleep({
        trackerId,
        caregiverName: selectedCaregiver,
        type: "nap",
        startTime: Date.now(),
      });
      onClose();
    } catch (error) {
      console.error("Failed to start sleep:", error);
      setIsSubmitting(false);
    }
  };

  const handleEndSleep = async () => {
    if (!activeSleep) return;

    setIsSubmitting(true);
    try {
      await endSleep({
        entryId: activeSleep._id,
        endTime: Date.now(),
      });
      onClose();
    } catch (error) {
      console.error("Failed to end sleep:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">💤 Log Sleep</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {activeSleep ? (
            <>
              <div className="text-center py-4">
                <div className="text-4xl mb-3">😴</div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Baby is sleeping
                </p>
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-2xl font-bold text-blue-900">
                    {formatDuration(activeSleep.startTime)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Started by {activeSleep.caregiverName}
                  </p>
                </div>
              </div>

              <button
                onClick={handleEndSleep}
                disabled={isSubmitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Ending..." : "☀️ END SLEEP NOW"}
              </button>
            </>
          ) : (
            <>
              <div className="text-center py-2">
                <p className="text-sm text-gray-600 mb-4">
                  Current Status: AWAKE
                </p>
              </div>

              <button
                onClick={handleStartSleep}
                disabled={isSubmitting}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Starting..." : "🌙 START SLEEP NOW"}
              </button>

              <div className="text-center py-2">
                <p className="text-sm text-gray-500">
                  Or log a past sleep session: (Coming soon)
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
