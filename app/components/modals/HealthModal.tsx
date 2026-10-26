"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  IconGrowth,
  IconMedication,
  IconTemperature,
} from "../icons";
import { EntryTimeField } from "../EntryTimeField";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";

type HealthType = "temperature" | "medication" | "weight";
type HealthEditEntry = Extract<ActivityEntry, { entryType: "health" }>;

interface HealthModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  healthType: HealthType;
  onClose: () => void;
  editEntry?: HealthEditEntry;
}

export function HealthModal({
  trackerId,
  selectedCaregiver,
  healthType,
  onClose,
  editEntry,
}: HealthModalProps) {
  const { t } = useLanguage();
  const createHealth = useMutation(api.healthEntries.create);
  const updateHealth = useMutation(api.healthEntries.update);
  const isEditing = Boolean(editEntry);
  const resolvedType: HealthType = editEntry?.type ?? healthType;

  const [temperature, setTemperature] = useState(
    editEntry?.temperature ?? 37.0
  );
  const [medicationName, setMedicationName] = useState(
    editEntry?.medicationName ?? ""
  );
  const [dosage, setDosage] = useState(editEntry?.dosage ?? "");
  const [weight, setWeight] = useState(editEntry?.weight ?? 4.0);
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [timestamp, setTimestamp] = useState(
    () => editEntry?.timestamp ?? Date.now()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titles: Record<
    HealthType,
    { label: string; icon: React.ReactNode }
  > = {
    temperature: {
      label: t("logTemperature"),
      icon: <IconTemperature size={20} />,
    },
    medication: {
      label: t("logMedication"),
      icon: <IconMedication size={20} />,
    },
    weight: {
      label: t("weight"),
      icon: <IconGrowth size={20} />,
    },
  };

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    if (resolvedType === "medication" && !medicationName.trim()) {
      alert(t("medicationRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type: resolvedType,
        temperature: resolvedType === "temperature" ? temperature : undefined,
        medicationName:
          resolvedType === "medication" ? medicationName.trim() : undefined,
        dosage: resolvedType === "medication" ? dosage || undefined : undefined,
        weight: resolvedType === "weight" ? weight : undefined,
        timestamp,
        notes: notes || undefined,
      };

      if (editEntry) {
        await updateHealth({ entryId: editEntry._id, ...payload });
      } else {
        await createHealth({
          trackerId,
          caregiverName: selectedCaregiver,
          ...payload,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save health entry:", error);
      alert(t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  const { label, icon } = titles[resolvedType];

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : label}
      icon={icon}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}
        {resolvedType === "temperature" && (
          <div>
            <label className="label-field">
              {t("tempC")}: {temperature.toFixed(1)}°C
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTemperature(Math.max(36.0, temperature - 0.1))}
                className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
              >
                −
              </button>
              <input
                type="range"
                min="36"
                max="40"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <button
                type="button"
                onClick={() => setTemperature(Math.min(40.0, temperature + 0.1))}
                className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
              >
                +
              </button>
            </div>
          </div>
        )}

        {resolvedType === "medication" && (
          <>
            <div>
              <label className="label-field">{t("medicationName")}</label>
              <input
                type="text"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                placeholder={t("medicationPlaceholder")}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">{t("dosage")}</label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder={t("dosagePlaceholder")}
                className="input-field"
              />
            </div>
          </>
        )}

        {resolvedType === "weight" && (
          <div>
            <label className="label-field">
              {t("weight")}: {weight.toFixed(1)} kg
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWeight(Math.max(1, Math.round((weight - 0.1) * 10) / 10))}
                className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
              >
                −
              </button>
              <input
                type="range"
                min="1"
                max="30"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <button
                type="button"
                onClick={() => setWeight(Math.min(30, Math.round((weight + 0.1) * 10) / 10))}
                className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
              >
                +
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="label-field">{t("notesOptional")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("observationsPlaceholder")}
            className="textarea-field"
            rows={2}
          />
        </div>

        <EntryTimeField value={timestamp} onChange={setTimestamp} />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting
            ? t("saving")
            : isEditing
              ? t("saveChanges")
              : t("saveEntry")}
        </button>
      </div>
    </BottomSheet>
  );
}
