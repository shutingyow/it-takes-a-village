"use client";

import { Id } from "@/convex/_generated/dataModel";

interface UpcomingTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function UpcomingTab({ trackerId, selectedCaregiver }: UpcomingTabProps) {
  return (
    <div className="p-4">
      <div className="bg-blue-50 rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">📅</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Upcoming Appointments
        </h3>
        <p className="text-sm text-gray-600">
          Coming soon: Track pediatrician visits and vaccinations
        </p>
      </div>
    </div>
  );
}
