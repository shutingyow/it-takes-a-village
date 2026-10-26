"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ActivityIcon } from "../icons";
import { EntryTimeField } from "../EntryTimeField";
import type { ActivityEntry } from "../ActivityEntryCard";
import { LoggedByHint } from "../LoggedByHint";
import {
  MOMENT_PRESETS,
  momentPresetKey,
  type MomentPreset,
} from "@/app/lib/logKinds";

type MomentEditEntry = Extract<ActivityEntry, { entryType: "moment" }>;

interface MomentModalProps {
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  editEntry?: MomentEditEntry;
}

export function MomentModal({
  secretLink,
  selectedCaregiver,
  onClose,
  editEntry,
}: MomentModalProps) {
  const { t } = useLanguage();
  const createMoment = useMutation(api.momentEntries.create);
  const updateMoment = useMutation(api.momentEntries.update);
  const isEditing = Boolean(editEntry);

  const [preset, setPreset] = useState<MomentPreset | null>(
    editEntry?.preset ?? null
  );
  const [text, setText] = useState(editEntry?.text ?? "");
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
    const custom = text.trim();
    if (!preset && !custom) {
      alert(t("momentNeedText"));
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        preset: custom ? undefined : preset ?? undefined,
        text: custom || undefined,
        timestamp,
        notes: notes || undefined,
      };
      if (editEntry) {
        await updateMoment({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          entryId: editEntry._id,
          ...payload,
        });
      } else {
        await createMoment({
          secretLink,
          actingCaregiverName: selectedCaregiver,
          ...payload,
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save moment:", error);
      alert(error instanceof Error ? error.message : t("updateFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      title={isEditing ? t("editEntry") : t("momentTitle")}
      icon={<ActivityIcon type="moment" size={20} className="text-terracotta" />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2 min-w-0">
        {isEditing && <LoggedByHint name={editEntry?.caregiverName} />}
        <div>
          <label className="label-field">{t("momentPresetLabel")}</label>
          <div className="flex flex-wrap gap-2">
            {MOMENT_PRESETS.map((id) => {
              const selected = preset === id && text.trim() === "";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPreset(id);
                    setText("");
                  }}
                  className={cn(
                    "px-3 py-2 rounded-full text-xs font-semibold border min-h-11 touch-manipulation",
                    selected
                      ? "bg-terracotta text-white border-terracotta"
                      : "bg-beige-light border-border text-foreground"
                  )}
                >
                  {t(momentPresetKey[id])}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="moment-custom" className="label-field">
            {t("momentCustomLabel")}
          </label>
          <input
            id="moment-custom"
            type="text"
            maxLength={160}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) setPreset(null);
            }}
            placeholder={t("momentCustomPlaceholder")}
            className="input-field"
          />
        </div>

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
