"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconWarning } from "../icons";

interface SupplyAlertModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onClose: () => void;
}

const commonItems = [
  "Diapers",
  "Wipes",
  "Formula",
  "Breast milk bags",
  "Bottles",
];

export function SupplyAlertModal({
  trackerId,
  selectedCaregiver,
  onClose,
}: SupplyAlertModalProps) {
  const { t } = useLanguage();
  const createAlert = useMutation(api.supplyAlerts.create);
  const [item, setItem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    if (!item.trim()) {
      alert(t("itemRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createAlert({
        trackerId,
        caregiverName: selectedCaregiver,
        item: item.trim(),
        timestamp: Date.now(),
      });
      onClose();
    } catch (error) {
      console.error("Failed to create supply alert:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      title={t("supplyAlert")}
      icon={<IconWarning size={20} className="text-warning" />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        <div>
          <label className="label-field">{t("whatsRunningLow")}</label>
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder={t("supplyPlaceholder")}
            className="input-field"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {commonItems.map((commonItem) => (
            <button
              key={commonItem}
              type="button"
              onClick={() => setItem(commonItem)}
              className={cn("chip", item === commonItem && "chip-selected")}
            >
              {commonItem}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-warning hover:bg-[#d9a83e] text-white font-semibold py-3.5 px-6 rounded-2xl transition-colors disabled:opacity-50"
        >
          {isSubmitting ? t("saving") : t("createAlert")}
        </button>
      </div>
    </BottomSheet>
  );
}
