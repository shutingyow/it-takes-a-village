"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { SupplyAlertModal } from "./modals/SupplyAlertModal";

interface SupplyAlertsBannerProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  alerts: Doc<"supplyAlerts">[];
}

export function SupplyAlertsBanner({
  trackerId,
  selectedCaregiver,
  alerts,
}: SupplyAlertsBannerProps) {
  const markRestocked = useMutation(api.supplyAlerts.markRestocked);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-yellow-700 font-semibold">⚠️ Supply Alerts</span>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs font-semibold text-yellow-800 bg-yellow-200 hover:bg-yellow-300 px-2 py-1 rounded"
          >
            + Add
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-yellow-700">No active alerts</p>
          ) : (
            alerts.map((alert) => (
            <div
              key={alert._id}
              className="flex items-center justify-between gap-2 text-sm text-yellow-800"
            >
              <span>{alert.item} running low</span>
              <button
                onClick={() => markRestocked({ alertId: alert._id })}
                className="text-xs font-medium text-green-700 hover:underline shrink-0"
              >
                ✓ Restocked
              </button>
            </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <SupplyAlertModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
