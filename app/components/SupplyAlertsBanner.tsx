"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { SupplyAlertModal } from "./modals/SupplyAlertModal";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconCheck, IconWarning } from "./icons";

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
  const { t } = useLanguage();
  const markRestocked = useMutation(api.supplyAlerts.markRestocked);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-warning-light border-b border-warning/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#8a7340] font-medium text-sm flex items-center gap-2">
            <IconWarning size={16} className="shrink-0" />
            {t("supplyAlertsBanner")}
          </span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs font-semibold text-[#9a7b2a] bg-warning/20 hover:bg-warning/30 px-3 py-1 rounded-full transition-colors"
          >
            + {t("add")}
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-[#9a7b2a]/80">{t("noActiveAlerts")}</p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert._id}
                className="flex items-center justify-between gap-2 text-sm text-[#9a7b2a]"
              >
                <span>{t("runningLow", { item: alert.item })}</span>
                <button
                  type="button"
                  onClick={() => markRestocked({ alertId: alert._id })}
                  className="text-xs font-medium text-secondary hover:underline shrink-0 flex items-center gap-1"
                >
                  <IconCheck size={12} />
                  {t("restocked")}
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
