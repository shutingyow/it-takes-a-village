"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconPump } from "../icons";
import { EntryPhotoField } from "../EntryPhotoField";
import { EntryTimeField } from "../EntryTimeField";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";
import { hapticSuccess } from "@/app/lib/haptics";

type PumpEditEntry = Extract<ActivityEntry, { entryType: "pump" }>;

interface PumpModalProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: PumpEditEntry;
}

export function PumpModal({
  trackerId,
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: PumpModalProps) {
  const { t } = useLanguage();
  const createPump = useMutation(api.pumpEntries.create);
  const updatePump = useMutation(api.pumpEntries.update);
  const isEditing = Boolean(editEntry);

  const [amount, setAmount] = useState(editEntry?.amount ?? 150);
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>(
    editEntry?.photoIds ?? []
  );
  const [timestamp, setTimestamp] = useState(
    () => editEntry?.timestamp ?? Date.now()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addToStash, setAddToStash] = useState(!editEntry);
  const addBag = useMutation(api.milkStash.addBag);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        amount,
        timestamp,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      };

      if (editEntry) {
        await updatePump({ entryId: editEntry._id, ...payload });
      } else {
        const pumpId = await createPump({
          trackerId,
          caregiverName: selectedCaregiver,
          ...payload,
        });
        if (addToStash && amount > 0) {
          const d = new Date(timestamp);
          const frozenOn = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          await addBag({
            trackerId,
            caregiverName: selectedCaregiver,
            amountMl: amount,
            pumpedAt: timestamp,
            pumpEntryId: pumpId,
            frozenOn,
          });
        }
      }
      void hapticSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save pump entry:", error);
      alert(t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("pumpSession")}
      icon={<IconPump size={20} />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}
        <div>
          <label className="label-field">{t("pumpAmount", { amount })}</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAmount(Math.max(10, amount - 10))}
              className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
            >
              −
            </button>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <button
              type="button"
              onClick={() => setAmount(Math.min(300, amount + 10))}
              className="w-10 h-10 rounded-xl bg-[#f3ede7] font-semibold"
            >
              +
            </button>
          </div>
        </div>

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

        <EntryPhotoField
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
          photoIds={photoIds}
          onChange={setPhotoIds}
        />

        <EntryTimeField value={timestamp} onChange={setTimestamp} />

        {!isEditing && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={addToStash}
              onChange={(e) => setAddToStash(e.target.checked)}
              className="rounded border-border"
            />
            {t("stashAddFromPump")}
          </label>
        )}

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
