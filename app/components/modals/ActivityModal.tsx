"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityIcon } from "../icons";
import { EntryTimeField } from "../EntryTimeField";
import { DurationMinutesField } from "../DurationMinutesField";
import type { ActivityEntry } from "../ActivityEntryCard";
import { ACTIVITY_KINDS, activityKindKey, type ActivityKind } from "@/app/lib/logKinds";

type ActivityEditEntry = Extract<ActivityEntry, { entryType: "activity" }>;

interface ActivityModalProps {
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: ActivityEditEntry;
}

export function ActivityModal({
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: ActivityModalProps) {
  const { t } = useLanguage();
  const createActivity = useMutation(api.activityEntries.create);
  const updateActivity = useMutation(api.activityEntries.update);
  const isEditing = Boolean(editEntry);

  const [kind, setKind] = useState<ActivityKind>(editEntry?.kind ?? "tummy");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    editEntry?.durationMinutes && editEntry.durationMinutes > 0
      ? editEntry.durationMinutes
      : null
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
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
        kind,
        timestamp,
        durationMinutes,
        notes: notes || undefined,
      };
      if (editEntry) {
        await updateActivity({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: editEntry._id,
          ...payload,
        });
      } else {
        await createActivity({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          kind,
          timestamp,
          durationMinutes: durationMinutes ?? undefined,
          notes: notes || undefined,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save activity:", error);
      alert(error instanceof Error ? error.message : t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("activityLogTitle")}
      icon={<ActivityIcon type="activity" size={20} className="text-primary" />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2 min-w-0">
        <div>
          <label className="label-field">{t("activityKindLabel")}</label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_KINDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={cn(
                  "btn-option min-h-11",
                  kind === id ? "btn-option-selected" : "btn-option-default"
                )}
              >
                {t(activityKindKey[id])}
              </button>
            ))}
          </div>
        </div>

        <DurationMinutesField
          id="activity-duration-minutes"
          label={t("feedDurationOptional")}
          hint={t("activityDurationHint")}
          value={durationMinutes}
          onChange={setDurationMinutes}
        />

        <div>
          <label className="label-field">{t("notesOptional")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
