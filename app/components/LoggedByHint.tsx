"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

/** Small muted authorship line for entry detail/edit sheets. */
export function LoggedByHint({ name }: { name?: string | null }) {
  const { t } = useLanguage();
  const trimmed = name?.trim();
  if (!trimmed) return null;

  return (
    <p className="text-[11px] text-muted/90">
      {t("loggedBy", { name: trimmed })}
    </p>
  );
}
