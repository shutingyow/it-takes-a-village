"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

export function toDatetimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(value: string): number {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

interface EntryTimeFieldProps {
  value: number;
  onChange: (timestamp: number) => void;
  label?: string;
}

export function EntryTimeField({ value, onChange, label }: EntryTimeFieldProps) {
  const { t } = useLanguage();

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-clip">
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <label className="label-field mb-0 min-w-0 truncate">
          {label ?? t("entryTime")}
        </label>
        <button
          type="button"
          onClick={() => onChange(Date.now())}
          className="text-xs font-semibold text-primary px-2.5 py-1 rounded-full bg-primary-light shrink-0"
        >
          {t("useNow")}
        </button>
      </div>
      <input
        type="datetime-local"
        value={toDatetimeLocalValue(value)}
        onChange={(e) => onChange(fromDatetimeLocalValue(e.target.value))}
        className="input-field input-datetime min-w-0 max-w-full"
      />
      <p className="text-xs text-muted mt-1.5 break-words">{t("entryTimeHint")}</p>
    </div>
  );
}
