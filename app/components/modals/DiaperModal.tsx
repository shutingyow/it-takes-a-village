"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityIcon } from "../icons";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { EntryPhotoField } from "../EntryPhotoField";
import { EntryTimeField } from "../EntryTimeField";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";

type DiaperEditEntry = Extract<ActivityEntry, { entryType: "diaper" }>;

interface DiaperModalProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: DiaperEditEntry;
}

type DiaperColour =
  | "yellow"
  | "green"
  | "brown"
  | "black"
  | "red"
  | "white"
  | "other";

type DiaperConsistency =
  | "seedy"
  | "loose"
  | "firm"
  | "watery"
  | "mucous"
  | "other";

const COLOURS: Array<{ id: DiaperColour; labelKey: TranslationKey }> = [
  { id: "yellow", labelKey: "colourYellow" },
  { id: "green", labelKey: "colourGreen" },
  { id: "brown", labelKey: "colourBrown" },
  { id: "black", labelKey: "colourBlack" },
  { id: "red", labelKey: "colourRed" },
  { id: "white", labelKey: "colourWhite" },
  { id: "other", labelKey: "colourOther" },
];

const CONSISTENCIES: Array<{ id: DiaperConsistency; labelKey: TranslationKey }> =
  [
    { id: "seedy", labelKey: "consistencySeedy" },
    { id: "loose", labelKey: "consistencyLoose" },
    { id: "firm", labelKey: "consistencyFirm" },
    { id: "watery", labelKey: "consistencyWatery" },
    { id: "mucous", labelKey: "consistencyMucous" },
    { id: "other", labelKey: "consistencyOther" },
  ];

export function DiaperModal({
  trackerId,
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: DiaperModalProps) {
  const { t } = useLanguage();
  const createDiaper = useMutation(api.diaperEntries.create);
  const updateDiaper = useMutation(api.diaperEntries.update);
  const isEditing = Boolean(editEntry);

  const [type, setType] = useState<"wet" | "dirty" | "both">(
    editEntry?.type ?? "wet"
  );
  const [colour, setColour] = useState<DiaperColour | undefined>(
    editEntry?.colour
  );
  const [consistency, setConsistency] = useState<DiaperConsistency | undefined>(
    editEntry?.consistency
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>(
    editEntry?.photoIds ?? []
  );
  const [timestamp, setTimestamp] = useState(
    () => editEntry?.timestamp ?? Date.now()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const types = [
    { id: "wet" as const, label: t("wet") },
    { id: "dirty" as const, label: t("dirty") },
    { id: "both" as const, label: t("both") },
  ];

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    setIsSubmitting(true);
    try {
      const hasStool = type === "dirty" || type === "both";
      const payload = {
        type,
        colour: hasStool ? colour : undefined,
        consistency: hasStool ? consistency : undefined,
        timestamp,
        notes: notes || undefined,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
      };

      if (editEntry) {
        await updateDiaper({ entryId: editEntry._id, ...payload });
      } else {
        await createDiaper({
          trackerId,
          caregiverName: selectedCaregiver,
          ...payload,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save diaper entry:", error);
      alert(t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("diaperChange")}
      icon={<ActivityIcon type="diaper" size={20} className="text-accent-diaper" />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}
        <div>
          <label className="label-field">{t("type")}</label>
          <div className="space-y-2">
            {types.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setType(item.id)}
                className={cn(
                  "btn-option",
                  type === item.id ? "btn-option-selected" : "btn-option-default"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {(type === "dirty" || type === "both") && (
          <>
            <div>
              <label className="label-field">{t("diaperColour")}</label>
              <div className="flex flex-wrap gap-2">
                {COLOURS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setColour(colour === c.id ? undefined : c.id)
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      colour === c.id
                        ? "bg-accent-diaper-light border-accent-diaper text-[#9a8260]"
                        : "bg-[#faf6f2] border-border text-muted"
                    )}
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-field">{t("diaperConsistency")}</label>
              <div className="flex flex-wrap gap-2">
                {CONSISTENCIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setConsistency(consistency === c.id ? undefined : c.id)
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      consistency === c.id
                        ? "bg-accent-diaper-light border-accent-diaper text-[#9a8260]"
                        : "bg-[#faf6f2] border-border text-muted"
                    )}
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="label-field">{t("notesOptional")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("diaperNotesPlaceholder")}
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
