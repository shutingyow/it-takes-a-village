"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

type Sex = "female" | "male" | "unspecified";

interface BabySexFieldProps {
  secretLink: string;
  actingCaregiverName: string;
  sex?: Sex;
  canEdit?: boolean;
}

export function BabySexField({
  secretLink,
  actingCaregiverName,
  sex,
  canEdit = false,
}: BabySexFieldProps) {
  const { t } = useLanguage();
  const updateSex = useMutation(api.trackers.updateSex);
  const [value, setValue] = useState<Sex>(sex ?? "unspecified");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(sex ?? "unspecified");
  }, [sex]);

  if (!canEdit) {
    if (!sex || sex === "unspecified") return null;
    return (
      <div className="mb-4 bg-surface border border-border rounded-2xl p-4 card-shadow">
        <p className="label-field mb-1">{t("babySex")}</p>
        <p className="text-sm text-foreground">
          {sex === "female" ? t("sexFemale") : t("sexMale")}
        </p>
      </div>
    );
  }

  const save = async () => {
    if (!actingCaregiverName) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateSex({
        secretLink,
        actingCaregiverName,
        sex: value,
      });
      setMessage(t("babySexSaved"));
    } catch {
      setMessage(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 bg-surface border border-border rounded-2xl p-4 card-shadow">
      <p className="label-field mb-2">{t("babySex")}</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {(
          [
            ["female", t("sexFemale")],
            ["male", t("sexMale")],
            ["unspecified", t("sexUnspecified")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setValue(id)}
            className={`rounded-xl border text-sm font-semibold py-2.5 ${
              value === id
                ? "border-primary bg-primary-light text-foreground"
                : "border-border bg-background text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || value === (sex ?? "unspecified")}
        className="w-full px-4 py-3 rounded-xl bg-terracotta text-white text-sm font-semibold disabled:opacity-50"
      >
        {t("babySexSave")}
      </button>
      {message && (
        <p className="text-xs text-accent-diaper mt-2">{message}</p>
      )}
    </div>
  );
}
