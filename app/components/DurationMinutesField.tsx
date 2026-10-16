"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

const MAX_DURATION_MINUTES = 24 * 60;

interface DurationMinutesFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number | null;
  onChange: (next: number | null) => void;
}

export function DurationMinutesField({
  id,
  label,
  hint,
  value,
  onChange,
}: DurationMinutesFieldProps) {
  const { t } = useLanguage();

  const setFromDigits = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") {
      onChange(null);
      return;
    }
    const parsed = Number.parseInt(digits, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      onChange(null);
      return;
    }
    onChange(Math.min(MAX_DURATION_MINUTES, parsed));
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <label htmlFor={id} className="label-field mb-0">
          {label}
        </label>
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 px-2 text-xs font-semibold text-terracotta touch-manipulation"
          >
            {t("clearDuration")}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 min-w-0">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="—"
          value={value ?? ""}
          onChange={(e) => setFromDigits(e.target.value)}
          className="input-field w-28 shrink-0 text-center text-lg font-semibold tabular-nums"
          aria-label={`${label} (${t("durationMinutesUnit")})`}
        />
        <span className="text-sm text-muted">{t("durationMinutesUnit")}</span>
      </div>
      <p className="text-xs text-muted mt-1.5">{hint}</p>
    </div>
  );
}
