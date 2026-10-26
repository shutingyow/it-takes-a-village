"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconGrowth } from "../icons";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";

type GrowthEditEntry = Extract<ActivityEntry, { entryType: "growth" }>;

interface GrowthModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: GrowthEditEntry;
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseOptionalPositive(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed);
  if (isNaN(n) || n <= 0) return undefined;
  return n;
}

export function GrowthModal({
  trackerId,
  selectedCaregiver,
  onClose,
  editEntry,
}: GrowthModalProps) {
  const { t } = useLanguage();
  const create = useMutation(api.growthEntries.create);
  const update = useMutation(api.growthEntries.update);
  const isEditing = Boolean(editEntry);

  const [date, setDate] = useState(editEntry?.date ?? todayDateString());
  const [weight, setWeight] = useState(
    editEntry?.weight != null ? String(editEntry.weight) : ""
  );
  const [length, setLength] = useState(
    editEntry?.length != null ? String(editEntry.length) : ""
  );
  const [headCirc, setHeadCirc] = useState(
    editEntry?.headCircumference != null
      ? String(editEntry.headCircumference)
      : ""
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(weight.trim() || length.trim() || headCirc.trim());

  const handleSubmit = async () => {
    const w = parseOptionalPositive(weight);
    const len = parseOptionalPositive(length);
    const hc = parseOptionalPositive(headCirc);
    if (w == null && len == null && hc == null) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        date,
        weight: w,
        length: len,
        headCircumference: hc,
        notes: notes || undefined,
        timestamp: editEntry?.timestamp ?? Date.now(),
      };

      if (editEntry) {
        await update({ entryId: editEntry._id, ...payload });
      } else {
        await create({
          trackerId,
          caregiverName: selectedCaregiver,
          ...payload,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("updateFailed"));
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("logGrowth")}
      icon={<IconGrowth size={20} />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}
        <div>
          <label className="label-field">{t("growthDate")}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="label-field">{t("weightKgOptional")}</label>
          <input
            type="number"
            step="0.1"
            min="1"
            max="30"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 4.2"
            className="input-field"
          />
        </div>
        <div>
          <label className="label-field">{t("heightCm")}</label>
          <input
            type="number"
            step="0.1"
            min="40"
            max="80"
            inputMode="decimal"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            placeholder="e.g. 55"
            className="input-field"
          />
        </div>
        <div>
          <label className="label-field">{t("headCircCm")}</label>
          <input
            type="number"
            step="0.1"
            min="30"
            max="50"
            inputMode="decimal"
            value={headCirc}
            onChange={(e) => setHeadCirc(e.target.value)}
            placeholder="e.g. 36"
            className="input-field"
          />
        </div>
        <div>
          <label className="label-field">{t("notesOptional")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("growthNotesPlaceholder")}
            className="textarea-field"
            rows={2}
          />
        </div>
        {error && <p className="text-sm text-[#c45c5c]">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !canSave}
          className="btn-primary"
        >
          {saving
            ? t("saving")
            : isEditing
              ? t("saveChanges")
              : t("saveEntry")}
        </button>
      </div>
    </BottomSheet>
  );
}
