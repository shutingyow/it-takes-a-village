"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const createTracker = useMutation(api.trackers.create);
  const [caregiverNames, setCaregiverNames] = useState([
    "Caregiver 1",
    "Caregiver 2",
    "Caregiver 3",
    "Caregiver 4",
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTracker = async () => {
    setIsCreating(true);
    try {
      const result = await createTracker({
        caregiverNames: caregiverNames.filter((n) => n.trim() !== ""),
      });
      router.push(`/tracker/${result.secretLink}`);
    } catch (error) {
      console.error("Failed to create tracker:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">👶 Baby Tracker</h1>
          <p className="text-gray-600">Shared caregiver log for your little one</p>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Set up caregiver names
            </h2>
            <div className="space-y-3">
              {caregiverNames.map((name, index) => (
                <input
                  key={index}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const newNames = [...caregiverNames];
                    newNames[index] = e.target.value;
                    setCaregiverNames(newNames);
                  }}
                  placeholder={`Caregiver ${index + 1}`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateTracker}
            disabled={isCreating}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create Tracker"}
          </button>

          <div className="text-sm text-gray-500 text-center">
            <p>You'll get a unique link to share with all caregivers.</p>
            <p className="mt-1">No login required!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
