"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

type HealthType = "temperature" | "medication" | "weight";

interface HealthModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  healthType: HealthType;
  onClose: () => void;
}

const titles: Record<HealthType, string> = {
  temperature: "🌡️ Log Temperature",
  medication: "💊 Log Medication",
  weight: "⚖️ Log Weight",
};

export function HealthModal({
  trackerId,
  selectedCaregiver,
  healthType,
  onClose,
}: HealthModalProps) {
  const createHealth = useMutation(api.healthEntries.create);
  const [temperature, setTemperature] = useState(98.6);
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [weight, setWeight] = useState(10);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert("Please select a caregiver");
      return;
    }

    if (healthType === "medication" && !medicationName.trim()) {
      alert("Please enter a medication name");
      return;
    }

    setIsSubmitting(true);
    try {
      await createHealth({
        trackerId,
        caregiverName: selectedCaregiver,
        type: healthType,
        temperature: healthType === "temperature" ? temperature : undefined,
        medicationName:
          healthType === "medication" ? medicationName.trim() : undefined,
        dosage: healthType === "medication" ? dosage || undefined : undefined,
        weight: healthType === "weight" ? weight : undefined,
        timestamp: Date.now(),
        notes: notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create health entry:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{titles[healthType]}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {healthType === "temperature" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {temperature.toFixed(1)}°F
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTemperature(Math.max(95, temperature - 0.1))}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  −
                </button>
                <input
                  type="range"
                  min="95"
                  max="105"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => setTemperature(Math.min(105, temperature + 0.1))}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {healthType === "medication" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medication name:
                </label>
                <input
                  type="text"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  placeholder="Vitamin D, Tylenol..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dosage (optional):
                </label>
                <input
                  type="text"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="1 drop, 2.5ml..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </>
          )}

          {healthType === "weight" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight: {weight.toFixed(1)} lbs
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeight(Math.max(1, weight - 0.5))}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  −
                </button>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => setWeight(Math.min(50, weight + 0.5))}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  +
                </button>
              </div>
            </div>
          )}

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
