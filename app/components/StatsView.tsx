"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  cn,
  formatSleepTotal,
  formatTime,
  getDateKeyInZone,
  shiftDateKey,
} from "@/app/lib/utils";
import {
  formatAgeOnDate,
  formatInsightDate,
  formatInsightRange,
  formatWeekAgeOnly,
} from "@/app/lib/babyAge";
import { ExportView } from "./ExportView";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { BirthDateField } from "./BirthDateField";
import { TodayTimetable } from "./TodayTimetable";

interface StatsViewProps {
  babyName?: string;
  birthDate?: string;
  secretLink: string;
  selectedCaregiver: string;
  timezone?: string;
  /** Birth date edits are admin-only. */
  canEditBirthDate?: boolean;
  onBack?: () => void;
  title?: string;
}

type ChartMetric = "feeds" | "milk" | "diapers" | "pumps";
type RangeMode = "daily" | "weekly";

const METRIC_COLOURS: Record<"feeds" | "diapers" | "pumps", string> = {
  feeds: "#c4846a",
  diapers: "#8fa68f",
  pumps: "#a89b8a",
};

function AverageLine({
  averageValue,
  maxValue,
}: {
  averageValue: number;
  maxValue: number;
}) {
  if (!(averageValue > 0) || !(maxValue > 0)) return null;
  const bottomPct = Math.min(100, (averageValue / maxValue) * 100);
  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none border-t border-dashed border-foreground/35"
      style={{ bottom: `${bottomPct}%` }}
      aria-hidden
    />
  );
}

function BarChart({
  data,
  maxValue,
  colour,
  formatValue,
  averageValue,
}: {
  data: Array<{ label: string; value: number }>;
  maxValue: number;
  colour: string;
  formatValue?: (value: number) => string;
  averageValue?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between gap-1">
        {data.map((d) => {
          const label =
            d.value > 0
              ? formatValue
                ? formatValue(d.value)
                : String(d.value)
              : "";
          return (
            <span
              key={`v-${d.label}`}
              className="flex-1 text-[10px] font-medium text-muted text-center tabular-nums min-h-[14px]"
            >
              {label}
            </span>
          );
        })}
      </div>
      <div className="relative h-20 flex items-end justify-between gap-1">
        {averageValue != null && (
          <AverageLine averageValue={averageValue} maxValue={maxValue} />
        )}
        {data.map((d) => {
          const pct = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
          return (
            <div
              key={d.label}
              className="flex-1 h-full flex items-end justify-center"
            >
              <div
                className="w-full max-w-[28px] rounded-t-lg transition-all"
                style={{
                  height: `${Math.max(pct, d.value > 0 ? 8 : 0)}%`,
                  backgroundColor: colour,
                  opacity: d.value > 0 ? 1 : 0.15,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1">
        {data.map((d) => (
          <span
            key={`l-${d.label}`}
            className="flex-1 text-[9px] text-muted truncate text-center"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StackedBarChart({
  data,
  maxValue,
  bottomColour,
  topColour,
  formatValue,
  averageValue,
}: {
  data: Array<{
    label: string;
    bottom: number;
    top: number;
    total: number;
  }>;
  maxValue: number;
  bottomColour: string;
  topColour: string;
  formatValue?: (value: number) => string;
  averageValue?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between gap-1">
        {data.map((d) => {
          const valueLabel =
            d.total > 0
              ? formatValue
                ? formatValue(d.total)
                : String(d.total)
              : "";
          return (
            <span
              key={`v-${d.label}`}
              className="flex-1 text-[10px] font-medium text-muted text-center tabular-nums min-h-[14px]"
            >
              {valueLabel}
            </span>
          );
        })}
      </div>
      <div className="relative h-20 flex items-end justify-between gap-1">
        {averageValue != null && (
          <AverageLine averageValue={averageValue} maxValue={maxValue} />
        )}
        {data.map((d) => {
          const pct = maxValue > 0 ? (d.total / maxValue) * 100 : 0;
          const parts = d.bottom + d.top;
          const bottomShare = parts > 0 ? (d.bottom / parts) * 100 : 0;
          return (
            <div
              key={d.label}
              className="flex-1 h-full flex items-end justify-center"
            >
              <div
                className="w-full max-w-[28px] rounded-t-lg overflow-hidden transition-all flex flex-col-reverse"
                style={{
                  height: `${Math.max(pct, d.total > 0 ? 8 : 0)}%`,
                  opacity: d.total > 0 ? 1 : 0.15,
                  backgroundColor: d.total === 0 ? bottomColour : undefined,
                }}
              >
                {d.total > 0 && (
                  <>
                    <div
                      className="w-full"
                      style={{
                        height: `${bottomShare}%`,
                        backgroundColor: bottomColour,
                        minHeight: d.bottom > 0 ? 2 : 0,
                      }}
                    />
                    <div
                      className="w-full"
                      style={{
                        height: `${100 - bottomShare}%`,
                        backgroundColor: topColour,
                        minHeight: d.top > 0 ? 2 : 0,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1">
        {data.map((d) => (
          <span
            key={`l-${d.label}`}
            className="flex-1 text-[9px] text-muted truncate text-center"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartLegend({
  items,
}: {
  items: Array<{ colour?: string; dashed?: boolean; label: string }>;
}) {
  return (
    <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-[11px] text-muted"
        >
          {item.dashed ? (
            <span
              className="w-3 h-0 border-t border-dashed border-foreground/45 shrink-0"
              aria-hidden
            />
          ) : (
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: item.colour }}
            />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** Headline number only; tap to reveal breakdown. */
function ExpandableSummary({
  title,
  value,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  /** Main number shown when there is data. */
  value: string | null;
  empty?: boolean;
  emptyLabel: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = !empty && children != null && value != null;

  if (empty || value == null) {
    return (
      <div className="bg-surface border border-border rounded-2xl px-3 py-3 card-shadow mb-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl card-shadow mb-2 overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-3 py-3 text-left touch-manipulation min-h-[48px]",
          hasDetail && "active:bg-beige-light/40"
        )}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-lg font-semibold text-foreground tabular-nums leading-none">
            {value}
          </span>
          {hasDetail && (
            <span
              className={cn(
                "text-muted text-xs transition-transform",
                open && "rotate-90"
              )}
              aria-hidden
            >
              ›
            </span>
          )}
        </span>
      </button>
      {hasDetail && open && (
        <div className="px-3 pb-3 pt-0 border-t border-border/60 space-y-1.5">
          <div className="pt-2">{children}</div>
        </div>
      )}
    </div>
  );
}

export function StatsView({
  babyName,
  birthDate,
  secretLink,
  selectedCaregiver,
  canEditBirthDate = false,
  timezone,
  onBack,
  title,
}: StatsViewProps) {
  const { t, language } = useLanguage();
  const [now] = useState(Date.now());
  const [showExport, setShowExport] = useState(false);
  const [metric, setMetric] = useState<ChartMetric>("feeds");
  const [rangeMode, setRangeMode] = useState<RangeMode>("daily");
  const todayKey = useMemo(
    () => getDateKeyInZone(now, timezone),
    [now, timezone]
  );
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  /** Last day of the rolling 7-day weekly window; defaults to today. */
  const [selectedWeekEndKey, setSelectedWeekEndKey] = useState(todayKey);

  const weeklySummary = useQuery(
    api.stats.getWeeklySummary,
    rangeMode === "weekly"
      ? {
          secretLink,
          actingCaregiverName: selectedCaregiver,
          now,
          endDateKey: selectedWeekEndKey,
        }
      : "skip"
  );
  const dailyStats = useQuery(
    api.stats.getDailyStats,
    rangeMode === "daily"
      ? {
          secretLink,
          actingCaregiverName: selectedCaregiver,
          dateKey: selectedDateKey,
          now,
        }
      : "skip"
  );

  if (showExport) {
    return (
      <ExportView
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        babyName={babyName}
        onBack={() => setShowExport(false)}
      />
    );
  }

  const segments: Array<{ id: ChartMetric; labelKey: TranslationKey }> = [
    { id: "feeds", labelKey: "feeds" },
    { id: "milk", labelKey: "milkMl" },
    { id: "diapers", labelKey: "diapers" },
    { id: "pumps", labelKey: "pumps" },
  ];

  const canGoNextDay = selectedDateKey < todayKey;
  const canGoNextWeek = selectedWeekEndKey < todayKey;

  const getCountValue = (day: {
    feedCount: number;
    diaperCount: number;
    pumpCount: number;
  }) => {
    if (metric === "feeds") return day.feedCount;
    if (metric === "diapers") return day.diaperCount;
    if (metric === "pumps") return day.pumpCount;
    return 0;
  };

  const day = dailyStats?.day;
  const days = weeklySummary?.days;

  /** Complete days only — exclude today so a partial day doesn’t skew the average. */
  const daysForAverage =
    days?.filter((d) => d.date < todayKey) ?? [];
  const totalCount =
    rangeMode === "daily"
      ? day
        ? getCountValue(day)
        : 0
      : (days?.reduce((sum, d) => sum + getCountValue(d), 0) ?? 0);
  const totalCountForAvg =
    rangeMode === "weekly"
      ? daysForAverage.reduce((sum, d) => sum + getCountValue(d), 0)
      : totalCount;
  const avgCountPerDay =
    rangeMode === "weekly" && daysForAverage.length > 0
      ? Math.round((totalCountForAvg / daysForAverage.length) * 10) / 10
      : totalCount;
  const countMax = Math.max(
    ...(days?.map((d) => getCountValue(d)) ?? [0]),
    1
  );

  const totalWet =
    rangeMode === "daily"
      ? (day?.wetCount ?? 0)
      : (days?.reduce((sum, d) => sum + d.wetCount, 0) ?? 0);
  const totalDirty =
    rangeMode === "daily"
      ? (day?.dirtyCount ?? 0)
      : (days?.reduce((sum, d) => sum + d.dirtyCount, 0) ?? 0);

  const totalFormulaMl =
    rangeMode === "daily"
      ? (day?.formulaMl ?? 0)
      : (days?.reduce((sum, d) => sum + d.formulaMl, 0) ?? 0);
  const totalBreastmilkMl =
    rangeMode === "daily"
      ? (day?.breastmilkMl ?? 0)
      : (days?.reduce((sum, d) => sum + d.breastmilkMl, 0) ?? 0);
  const totalMilkMl = totalFormulaMl + totalBreastmilkMl;
  const totalMilkMlForAvg =
    rangeMode === "weekly"
      ? daysForAverage.reduce(
          (sum, d) => sum + d.formulaMl + d.breastmilkMl,
          0
        )
      : totalMilkMl;
  const avgMilkMlPerDay =
    rangeMode === "weekly" && daysForAverage.length > 0
      ? Math.round(totalMilkMlForAvg / daysForAverage.length)
      : totalMilkMl;
  const milkMax = Math.max(
    ...(days?.map((d) => d.formulaMl + d.breastmilkMl) ?? [0]),
    1
  );

  const chartTitleKey: TranslationKey =
    metric === "feeds"
      ? "feedsPerDay"
      : metric === "milk"
        ? "mlFedPerDay"
        : metric === "diapers"
          ? "diapersPerDay"
          : "pumpsPerDay";

  const loading =
    rangeMode === "daily" ? dailyStats === undefined : weeklySummary === undefined;

  const hasCountData =
    rangeMode === "daily"
      ? day != null && getCountValue(day) > 0
      : days != null && !days.every((d) => getCountValue(d) === 0);
  const hasMilkData =
    rangeMode === "daily"
      ? day != null && day.formulaMl + day.breastmilkMl > 0
      : days != null &&
        !days.every((d) => d.formulaMl + d.breastmilkMl === 0);

  const fullDate = formatInsightDate(selectedDateKey, language);
  const dayAge = birthDate
    ? formatAgeOnDate(birthDate, selectedDateKey, language)
    : null;
  const dailyAgeLine = dayAge
    ? `${fullDate} · ${dayAge}`
    : birthDate
      ? `${fullDate} · ${t("ageNotBornYet")}`
      : fullDate;
  const weekStartKey = shiftDateKey(selectedWeekEndKey, -6);
  const weeklyRangeLine = formatInsightRange(
    weekStartKey,
    selectedWeekEndKey,
    language
  );
  const weeklyAgeOnly = formatWeekAgeOnly(
    birthDate,
    weekStartKey,
    selectedWeekEndKey,
    language
  );
  const weekEndAge = birthDate
    ? formatAgeOnDate(birthDate, selectedWeekEndKey, language)
    : null;

  const totalPumpMl =
    rangeMode === "daily"
      ? (day?.pumpTotalMl ?? 0)
      : (days?.reduce((sum, d) => sum + d.pumpTotalMl, 0) ?? 0);
  const totalPumpMlForAvg =
    rangeMode === "weekly"
      ? daysForAverage.reduce((sum, d) => sum + d.pumpTotalMl, 0)
      : totalPumpMl;
  const avgPumpMlPerDay =
    rangeMode === "weekly" && daysForAverage.length > 0
      ? Math.round(totalPumpMlForAvg / daysForAverage.length)
      : totalPumpMl;

  const wetOnly = day ? day.wetCount - day.bothCount : 0;
  const dirtyOnly = day ? day.dirtyCount - day.bothCount : 0;

  return (
    <div className="p-3 sm:p-4 min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 text-sm font-semibold text-terracotta flex items-center gap-1"
        >
          {t("backToMore")}
        </button>
      )}

      <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
        <p className="section-label mb-0 truncate">{title ?? t("stats")}</p>
        <button
          type="button"
          onClick={() => setShowExport(true)}
          className="shrink-0 text-xs font-semibold text-terracotta"
        >
          {t("exportData")} →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {(
          [
            { id: "daily" as const, labelKey: "rangeDaily" as const },
            { id: "weekly" as const, labelKey: "rangeWeekly" as const },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setRangeMode(opt.id)}
            className={cn(
              "py-2.5 rounded-xl text-xs font-semibold transition-colors touch-manipulation min-h-[44px]",
              rangeMode === opt.id
                ? "bg-terracotta text-white"
                : "bg-beige-light text-muted hover:text-foreground"
            )}
            aria-pressed={rangeMode === opt.id}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      {rangeMode === "daily" && (
        <div className="flex items-center justify-between mb-4 bg-surface border border-border rounded-2xl px-1.5 sm:px-2 py-2 card-shadow min-w-0">
          <button
            type="button"
            onClick={() => setSelectedDateKey((k) => shiftDateKey(k, -1))}
            className="px-3 py-2 text-sm font-semibold text-terracotta rounded-xl hover:bg-beige-light min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label={t("previousDay")}
          >
            ‹
          </button>
          <div className="text-center min-w-0 flex-1 px-1">
            <p className="text-sm font-semibold text-foreground break-words leading-snug">
              {dailyAgeLine}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!canGoNextDay) return;
              setSelectedDateKey((k) => {
                const next = shiftDateKey(k, 1);
                return next > todayKey ? todayKey : next;
              });
            }}
            disabled={!canGoNextDay}
            className={cn(
              "px-3 py-2 text-sm font-semibold rounded-xl min-h-[44px] min-w-[44px] touch-manipulation",
              canGoNextDay
                ? "text-terracotta hover:bg-beige-light"
                : "text-muted/40 cursor-not-allowed"
            )}
            aria-label={t("nextDay")}
          >
            ›
          </button>
        </div>
      )}

      {rangeMode === "weekly" && (
        <div className="flex items-center justify-between mb-4 bg-surface border border-border rounded-2xl px-1.5 sm:px-2 py-2 card-shadow min-w-0">
          <button
            type="button"
            onClick={() =>
              setSelectedWeekEndKey((k) => shiftDateKey(k, -7))
            }
            className="px-3 py-2 text-sm font-semibold text-terracotta rounded-xl hover:bg-beige-light min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label={t("previousWeek")}
          >
            ‹
          </button>
          <div className="text-center min-w-0 flex-1 px-1">
            <p className="text-sm font-semibold text-foreground break-words leading-snug">
              {weeklyRangeLine}
            </p>
            {weeklyAgeOnly ? (
              <p className="text-xs text-muted mt-1 break-words leading-snug">
                {weeklyAgeOnly}
              </p>
            ) : birthDate && !weekEndAge ? (
              <p className="text-[11px] text-muted mt-1 break-words">
                {t("ageNotBornYet")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!canGoNextWeek) return;
              setSelectedWeekEndKey((k) => {
                const next = shiftDateKey(k, 7);
                return next > todayKey ? todayKey : next;
              });
            }}
            disabled={!canGoNextWeek}
            className={cn(
              "px-3 py-2 text-sm font-semibold rounded-xl min-h-[44px] min-w-[44px] touch-manipulation",
              canGoNextWeek
                ? "text-terracotta hover:bg-beige-light"
                : "text-muted/40 cursor-not-allowed"
            )}
            aria-label={t("nextWeek")}
          >
            ›
          </button>
        </div>
      )}

      {!birthDate && canEditBirthDate && secretLink && selectedCaregiver && (
        <div className="mb-4 min-w-0 w-full overflow-hidden">
          <div className="bg-surface border border-border rounded-2xl p-3 card-shadow min-w-0 w-full overflow-hidden">
            <BirthDateField
              secretLink={secretLink}
              actingCaregiverName={selectedCaregiver}
              birthDate={birthDate}
              canEdit
              compact
            />
          </div>
        </div>
      )}

      {rangeMode === "daily" && (
        <TodayTimetable
          dateKey={selectedDateKey}
          className="px-0 pb-4"
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
          timezone={timezone}
        />
      )}

      {loading ? (
        <p className="text-sm text-muted">{t("loading")}</p>
      ) : rangeMode === "daily" && day ? (
        <div className="space-y-0">
          <p className="section-label">{t("todaysSummary")}</p>
          <ExpandableSummary
            title={t("feeds")}
            empty={day.feedCount === 0}
            emptyLabel={t("noDataYet")}
            value={String(day.feedCount)}
          >
            <StatLine
              label={t("statsBreastfeeding")}
              value={String(day.breastCount)}
            />
            <StatLine
              label={t("statsBottle")}
              value={String(day.bottleCount)}
            />
          </ExpandableSummary>

          <ExpandableSummary
            title={t("milkMl")}
            empty={
              day.formulaMl + day.breastmilkMl + day.breastDurationMinutes === 0
            }
            emptyLabel={t("noDataYet")}
            value={`${day.formulaMl + day.breastmilkMl} ml`}
          >
            <StatLine
              label={t("statsBreastMilkMl")}
              value={day.breastmilkMl > 0 ? `${day.breastmilkMl} ml` : "—"}
            />
            <StatLine
              label={t("statsFormulaMl")}
              value={day.formulaMl > 0 ? `${day.formulaMl} ml` : "—"}
            />
            <StatLine
              label={t("statsBreastMinutes")}
              value={
                day.breastDurationMinutes > 0
                  ? t("statsMinutesValue", {
                      minutes: String(day.breastDurationMinutes),
                    })
                  : "—"
              }
            />
          </ExpandableSummary>

          {day.solidsCount > 0 && (
            <ExpandableSummary
              title={t("solidsDayTotal")}
              emptyLabel={t("noDataYet")}
              value={
                day.solidsGrams > 0
                  ? t("solidsMealsGrams", {
                      count: day.solidsCount,
                      grams: day.solidsGrams,
                    })
                  : t("solidsMealsOnly", { count: day.solidsCount })
              }
            />
          )}

          <ExpandableSummary
            title={t("diapers")}
            empty={day.diaperCount === 0}
            emptyLabel={t("noDataYet")}
            value={String(day.diaperCount)}
          >
            <StatLine label={t("wet")} value={String(wetOnly)} />
            <StatLine label={t("dirty")} value={String(dirtyOnly)} />
            <StatLine label={t("both")} value={String(day.bothCount)} />
          </ExpandableSummary>

          <ExpandableSummary
            title={t("pumps")}
            empty={day.pumpCount === 0}
            emptyLabel={t("noDataYet")}
            value={`${day.pumpTotalMl} ml`}
          >
            {day.pumpSessions.map((session) => (
              <div
                key={`${session.timestamp}-${session.amount}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-xs text-muted">
                  {formatTime(session.timestamp)}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {session.amount} ml
                </span>
              </div>
            ))}
          </ExpandableSummary>

          <ExpandableSummary
            title={t("sleep")}
            empty={day.sleepMinutes === 0}
            emptyLabel={t("noDataYet")}
            value={formatSleepTotal(day.sleepMinutes)}
          >
            <p className="text-xs text-muted pb-1">
              {[
                day.nightSleepMinutes > 0
                  ? `${t("statsSleepBedtime")} ${formatSleepTotal(day.nightSleepMinutes)}`
                  : null,
                day.napSleepMinutes > 0
                  ? `${t("statsSleepNaps")} ${formatSleepTotal(day.napSleepMinutes)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {day.sleepSessions.map((session) => (
              <div
                key={`${session.type}-${session.startTime}-${session.minutes}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-xs text-muted min-w-0 truncate">
                  <span className="text-foreground/80 font-medium">
                    {session.type === "night"
                      ? t("statsSleepBedtime")
                      : t("nap")}
                  </span>
                  {" · "}
                  {formatTime(session.startTime)}
                  {session.endTime
                    ? `–${formatTime(session.endTime)}`
                    : ` ${t("sleepActive")}`}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {formatSleepTotal(session.minutes)}
                </span>
              </div>
            ))}
          </ExpandableSummary>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1 mb-4">
            {segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setMetric(seg.id)}
                className={cn(
                  "py-2 px-0.5 rounded-xl text-[10px] sm:text-xs font-semibold transition-colors touch-manipulation min-h-[40px] truncate",
                  metric === seg.id
                    ? "bg-terracotta text-white"
                    : "bg-beige-light text-muted hover:text-foreground"
                )}
                aria-pressed={metric === seg.id}
              >
                {t(seg.labelKey)}
              </button>
            ))}
          </div>

          {metric === "milk" ? (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("formulaMl")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {totalFormulaMl > 0 ? `${totalFormulaMl} ml` : "—"}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("breastmilkMl")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {totalBreastmilkMl > 0 ? `${totalBreastmilkMl} ml` : "—"}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow col-span-2">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("avgMlPerDay")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {avgMilkMlPerDay > 0 ? `${avgMilkMlPerDay} ml` : "—"}
                </p>
              </div>
            </div>
          ) : metric === "pumps" ? (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("pumpSessionsWeek")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {totalCount > 0 ? totalCount : "—"}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("pumpsPerDay")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {avgCountPerDay > 0 ? avgCountPerDay : "—"}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("pumpVolumeWeek")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {totalPumpMl > 0 ? `${totalPumpMl} ml` : "—"}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t("avgPumpMlPerDay")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {avgPumpMlPerDay > 0 ? `${avgPumpMlPerDay} ml` : "—"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t(metric === "feeds" ? "feeds" : "diapers")}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {totalCount > 0 ? totalCount : "—"}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-3 card-shadow">
                <p className="text-[10px] font-semibold uppercase text-muted mb-1">
                  {t(chartTitleKey)}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {avgCountPerDay > 0 ? avgCountPerDay : "—"}
                </p>
              </div>
            </div>
          )}

          {days && (
            <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                {t(chartTitleKey)}
              </p>

              {metric === "milk" ? (
                !hasMilkData ? (
                  <p className="text-sm text-muted text-center py-4">
                    {t("noDataYet")}
                  </p>
                ) : (
                  <>
                    <StackedBarChart
                      data={days.map((d) => ({
                        label: d.label,
                        bottom: d.formulaMl,
                        top: d.breastmilkMl,
                        total: d.formulaMl + d.breastmilkMl,
                      }))}
                      maxValue={milkMax}
                      bottomColour="#c4846a"
                      topColour="#8fa4b8"
                      formatValue={(v) => `${v}`}
                      averageValue={avgMilkMlPerDay}
                    />
                    <ChartLegend
                      items={[
                        {
                          colour: "#c4846a",
                          label: `${t("formula")}: ${totalFormulaMl} ml`,
                        },
                        {
                          colour: "#8fa4b8",
                          label: `${t("breastmilk")}: ${totalBreastmilkMl} ml`,
                        },
                        {
                          dashed: true,
                          label: `${t("chartAverage")}: ${avgMilkMlPerDay} ml`,
                        },
                      ]}
                    />
                  </>
                )
              ) : !hasCountData ? (
                <p className="text-sm text-muted text-center py-4">
                  {t("noDataYet")}
                </p>
              ) : metric === "diapers" ? (
                <>
                  <StackedBarChart
                    data={days.map((d) => ({
                      label: d.label,
                      bottom: d.wetCount,
                      top: d.dirtyCount,
                      total: d.diaperCount,
                    }))}
                    maxValue={countMax}
                    bottomColour="#8fa68f"
                    topColour="#c9a84c"
                    averageValue={avgCountPerDay}
                  />
                  <ChartLegend
                    items={[
                      { colour: "#8fa68f", label: `${t("wet")}: ${totalWet}` },
                      {
                        colour: "#c9a84c",
                        label: `${t("dirty")}: ${totalDirty}`,
                      },
                      {
                        dashed: true,
                        label: `${t("chartAverage")}: ${avgCountPerDay}`,
                      },
                    ]}
                  />
                </>
              ) : (
                <>
                  <BarChart
                    data={days.map((d) => ({
                      label: d.label,
                      value: getCountValue(d),
                    }))}
                    maxValue={countMax}
                    colour={METRIC_COLOURS[metric]}
                    averageValue={avgCountPerDay}
                  />
                  <ChartLegend
                    items={[
                      {
                        dashed: true,
                        label: `${t("chartAverage")}: ${avgCountPerDay}`,
                      },
                    ]}
                  />
                </>
              )}
            </div>
          )}

        </>
      )}
    </div>
  );
}
