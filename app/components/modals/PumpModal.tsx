"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconPump } from "../icons";
import { EntryPhotoField } from "../EntryPhotoField";
import { EntryTimeField } from "../EntryTimeField";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";

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
  const [side, setSide] = useState<"left" | "right" | "both">(
    editEntry?.side ?? "both"
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>(
    editEntry?.photoIds ?? []
  );
  const [timestamp, setTimestamp] = useState(
    () => editEntry?.timestamp ?? Date.now()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        amount,
        side,
        timestamp,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      };

      if (editEntry) {
        await updatePump({ entryId: editEntry._id, ...payload });
      } else {
        await createPump({
          trackerId,
          caregiverName: selectedCaregiver,
          ...payload,
        });
      }
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
          <label className="label-field">{t("pumpSide")}</label>
          <div className="flex gap-2">
            {(
              [
                { id: "left" as const, label: t("left") },
                { id: "right" as const, label: t("right") },
                { id: "both" as const, label: t("both") },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSide(s.id)}
                className={cn(
                  "btn-option flex-1 py-2.5",
                  side === s.id ? "btn-option-selected" : "btn-option-default"
                )}
              >
                {s.label}
              </button>
            ))}
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
