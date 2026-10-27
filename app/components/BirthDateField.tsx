"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatBabyAge } from "@/app/lib/utils";

interface BirthDateFieldProps {
  secretLink: string;
  actingCaregiverName: string;
  birthDate?: string;
  compact?: boolean;
  /** Only admins can edit. Non-admins see a read-only value when set. */
  canEdit?: boolean;
}

export function BirthDateField({
  secretLink,
  actingCaregiverName,
  birthDate,
  compact = false,
  canEdit = false,
}: BirthDateFieldProps) {
  const { t } = useLanguage();
  const updateBirthDate = useMutation(api.trackers.updateBirthDate);
  const [value, setValue] = useState(birthDate ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(birthDate ?? "");
  }, [birthDate]);

  const unchanged = value === (birthDate ?? "");
  const ageLabel = birthDate ? formatBabyAge(birthDate) : null;

  if (!canEdit) {
    if (!birthDate) return null;
    return (
      <div
        className={
          compact
            ? "min-w-0"
            : "mb-4 bg-surface border border-border rounded-2xl p-4 card-shadow min-w-0"
        }
      >
        <p className="label-field mb-1">{t("birthDate")}</p>
        <p className="text-sm text-foreground break-words">
          {birthDate}
          {ageLabel ? ` · ${ageLabel}` : ""}
        </p>
      </div>
    );
  }

  const save = async () => {
    if (!value || unchanged || !actingCaregiverName) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await updateBirthDate({
        secretLink,
        actingCaregiverName,
        birthDate: value,
      });
      setMessage(t("birthDateSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "min-w-0 w-full"
          : "mb-4 bg-surface border border-border rounded-2xl p-4 card-shadow min-w-0 w-full overflow-hidden"
      }
    >
      <label
        htmlFor={compact ? "insights-birth-date" : "settings-birth-date"}
        className="label-field"
      >
        {t("birthDate")}
      </label>
      <div className="flex flex-col gap-2 min-w-0 w-full">
        <input
          id={compact ? "insights-birth-date" : "settings-birth-date"}
          type="date"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage(null);
            setError(null);
          }}
          className="input-field w-full min-w-0 max-w-full box-border"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || unchanged || !value || !actingCaregiverName}
          className="w-full min-w-0 px-4 py-3 rounded-xl bg-terracotta text-white text-sm font-semibold disabled:opacity-50 touch-manipulation min-h-[44px]"
        >
          {t("birthDateSave")}
        </button>
      </div>
      {message && (
        <p className="text-xs text-accent-diaper mt-2 break-words">{message}</p>
      )}
      {error && (
        <p className="text-xs text-[#9b3b3b] mt-2 break-words">{error}</p>
      )}
    </div>
  );
}
