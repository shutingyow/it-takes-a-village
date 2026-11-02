"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeInputValue(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combine local YYYY-MM-DD + HH:mm into epoch ms. */
export function combineLocalDateTime(date: string, time: string): number {
  const ms = new Date(`${date}T${time}:00`).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function withSameClock(baseMs: number, date: string): number {
  return combineLocalDateTime(date, toTimeInputValue(baseMs));
}

interface EntryWhenFieldsProps {
  startAt: number;
  endAt: number;
  onStartChange: (next: number) => void;
  onEndChange: (next: number) => void;
  /** Hide end time (e.g. solids / single-point logs). */
  showEnd?: boolean;
}

/**
 * Date defaults to today; caregivers mostly only tweak start/end clock times.
 */
export function EntryWhenFields({
  startAt,
  endAt,
  onStartChange,
  onEndChange,
  showEnd = true,
}: EntryWhenFieldsProps) {
  const { t } = useLanguage();
  const dateValue = toDateInputValue(startAt);
  const startTime = toTimeInputValue(startAt);
  const endTime = toTimeInputValue(endAt);

  const handleDateChange = (nextDate: string) => {
    if (!nextDate) return;
    onStartChange(withSameClock(startAt, nextDate));
    onEndChange(withSameClock(endAt, nextDate));
  };

  return (
    <div className="space-y-3 min-w-0 w-full max-w-full">
      <div className="min-w-0">
        <label className="label-field">{t("entryDate")}</label>
        <input
          type="date"
          value={dateValue}
          onChange={(e) => handleDateChange(e.target.value)}
          className="input-field"
        />
      </div>

      <div
        className={
          showEnd ? "grid grid-cols-2 gap-2 min-w-0" : "min-w-0"
        }
      >
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="label-field mb-0">{t("feedStartTime")}</label>
            <button
              type="button"
              onClick={() => {
                const now = Date.now();
                onStartChange(
                  combineLocalDateTime(toDateInputValue(startAt), toTimeInputValue(now))
                );
              }}
              className="text-xs font-semibold text-primary px-2 py-1 rounded-full bg-primary-light shrink-0"
            >
              {t("useNow")}
            </button>
          </div>
          <input
            type="time"
            value={startTime}
            onChange={(e) => {
              if (!e.target.value) return;
              onStartChange(combineLocalDateTime(dateValue, e.target.value));
            }}
            className="input-field"
          />
        </div>

        {showEnd && (
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="label-field mb-0">{t("feedEndTime")}</label>
              <button
                type="button"
                onClick={() => {
                  const now = Date.now();
                  onEndChange(
                    combineLocalDateTime(toDateInputValue(endAt), toTimeInputValue(now))
                  );
                }}
                className="text-xs font-semibold text-primary px-2 py-1 rounded-full bg-primary-light shrink-0"
              >
                {t("useNow")}
              </button>
            </div>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                if (!e.target.value) return;
                onEndChange(combineLocalDateTime(dateValue, e.target.value));
              }}
              className="input-field"
            />
          </div>
        )}
      </div>
    </div>
  );
}
