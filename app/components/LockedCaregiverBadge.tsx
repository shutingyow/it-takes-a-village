"use client";

import { useState } from "react";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import type { CaregiverInfo } from "../lib/trackerStorage";

interface LockedCaregiverBadgeProps {
  caregiver: CaregiverInfo;
  onSwitch: () => void;
}

export function LockedCaregiverBadge({
  caregiver,
  onSwitch,
}: LockedCaregiverBadgeProps) {
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);
  const initial = caregiver.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <div className="px-4 pt-0.5 pb-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0 rounded-xl bg-surface/90 border border-border/80 px-2.5 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-7 h-7 rounded-full bg-primary-light text-primary flex items-center justify-center text-xs font-bold shrink-0"
              aria-hidden
            >
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wide uppercase text-muted">
                {t("loggedInAs")}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">
                  {caregiver.name}
                </span>
                {caregiver.role === "admin" && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-secondary/15 text-secondary px-1.5 py-0.5 rounded-full shrink-0">
                    {t("admin")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className={cn(
              "shrink-0 text-xs font-semibold text-terracotta",
              "px-3 py-2 rounded-xl bg-terracotta-light",
              "active:opacity-80 touch-manipulation min-h-[40px]"
            )}
          >
            {t("notYouSwitch")}
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface rounded-2xl p-6 max-w-xs w-full card-shadow border border-border"
          >
            <h2 className="text-lg font-bold text-foreground mb-2">
              {t("switchConfirmTitle")}
            </h2>
            <p className="text-sm text-muted mb-5">{t("switchConfirmMessage")}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border font-medium text-muted hover:bg-[#faf6f2]"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onSwitch();
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold"
              >
                {t("switchConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
