"use client";

import { useState } from "react";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import type { CaregiverInfo } from "../lib/trackerStorage";
import { IconUser } from "./icons";

interface CaregiverLockScreenProps {
  caregivers: CaregiverInfo[];
  onConfirm: (name: string) => void;
}

export function CaregiverLockScreen({
  caregivers,
  onConfirm,
}: CaregiverLockScreenProps) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-sm w-full min-w-0 bg-surface rounded-2xl card-shadow p-5 sm:p-8 border border-border my-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary-light flex items-center justify-center mx-auto mb-4 text-primary">
            <IconUser size={28} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            {t("whoAreYou")}
          </h1>
          <p className="text-sm text-muted">{t("pickCaregiver")}</p>
        </div>

        <div className="space-y-2 mb-6">
          {caregivers.map((caregiver) => (
            <button
              key={caregiver.name}
              type="button"
              onClick={() => setSelected(caregiver.name)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-3.5 rounded-xl border text-left transition-all min-w-0",
                selected === caregiver.name
                  ? "border-primary bg-primary-light"
                  : "border-border bg-surface hover:bg-background"
              )}
            >
              <span className="font-medium text-foreground truncate min-w-0">
                {caregiver.name}
              </span>
              {caregiver.role === "admin" && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-secondary/15 text-secondary px-2 py-0.5 rounded-full shrink-0">
                  {t("admin")}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!selected}
          onClick={() => onConfirm(selected)}
          className="btn-primary disabled:opacity-50"
        >
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}
