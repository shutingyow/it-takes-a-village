"use client";

import { useLanguage } from "../lib/i18n/LanguageProvider";
import type { CaregiverInfo } from "../lib/trackerStorage";
import { IconSettings } from "./icons";

interface LockedCaregiverBadgeProps {
  caregiver: CaregiverInfo;
  onOpenSettings: () => void;
}

export function LockedCaregiverBadge({
  caregiver,
  onOpenSettings,
}: LockedCaregiverBadgeProps) {
  const { t } = useLanguage();
  const initial = caregiver.name.trim().charAt(0).toUpperCase() || "?";

  return (
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
          onClick={onOpenSettings}
          aria-label={t("tabSettings")}
          className="shrink-0 flex items-center justify-center text-foreground w-10 h-10 rounded-xl active:opacity-80 touch-manipulation"
        >
          <IconSettings size={20} />
        </button>
      </div>
    </div>
  );
}
