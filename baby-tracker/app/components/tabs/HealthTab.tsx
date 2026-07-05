"use client";

import { Id } from "@/convex/_generated/dataModel";

interface HealthTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function HealthTab({ trackerId, selectedCaregiver }: HealthTabProps) {
  return (
    <div className="p-4">
      <div className="space-y-3">
        <button className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 text-blue-900 font-semibold py-4 px-4 rounded-lg transition-colors text-left">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌡️</span>
            <div className="flex-1">
              <div className="font-semibold">TEMPERATURE</div>
              <div className="text-sm text-blue-700">Coming soon</div>
            </div>
          </div>
        </button>

        <button className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 text-blue-900 font-semibold py-4 px-4 rounded-lg transition-colors text-left">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💊</span>
            <div className="flex-1">
              <div className="font-semibold">MEDICATION / VITAMINS</div>
              <div className="text-sm text-blue-700">Coming soon</div>
            </div>
          </div>
        </button>

        <button className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 text-blue-900 font-semibold py-4 px-4 rounded-lg transition-colors text-left">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚖️</span>
            <div className="flex-1">
              <div className="font-semibold">WEIGHT CHECK</div>
              <div className="text-sm text-blue-700">Coming soon</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
