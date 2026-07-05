"use client";

import { Id } from "@/convex/_generated/dataModel";

interface NotesTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function NotesTab({ trackerId, selectedCaregiver }: NotesTabProps) {
  return (
    <div className="p-4">
      <div className="bg-blue-50 rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Notes & Handover
        </h3>
        <p className="text-sm text-gray-600">
          Coming soon: Add handover notes and photo uploads
        </p>
      </div>
    </div>
  );
}
