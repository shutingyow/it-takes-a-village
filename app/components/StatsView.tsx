"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
  formatWeekAgeLine,
} from "@/app/lib/babyAge";
import { ExportView } from "./ExportView";
import { BirthDateField } from "./BirthDateField";
import { TodayTimetable } from "./TodayTimetable";

interface StatsViewProps {
  trackerId: Id<"trackers">;
  babyName?: string;
  birthDate?: string;
  secretLink?: string;
  selectedCaregiver?: string;
  onBack?: () => void;
  title?: string;
}

type RangeMode = "daily" | "weekly";

function weekdayShortFromKey(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: "short" });
}

function dayNumFromKey(dateKey: string): string {
  const day = dateKey.split("-")[2];
  return day ? String(Number(day)) : "";
}

function WeekFeedBars({
  days,
  todayKey,
  locale,
  legend,
  onSelectDay,
  viewDayAria,
}: {
  days: Array<{ date: string; feedCount: number }>;
  todayKey: string;
  locale: string;
  legend: string;
  onSelectDay: (dateKey: string) => void;
  viewDayAria: (dayLabel: string) => string;
}) {
  const maxValue = Math.max(...days.map((d) => d.feedCount), 1);

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 card-shadow">
      <p className="text-sm font-semibold text-foreground mb-3">{legend}</p>
      <div className="flex items-end justify-between gap-1 h-36">
        {days.map((d) => {
          const pct = maxValue > 0 ? (d.feedCount / maxValue) * 100 : 0;
          const dayLabel = weekdayShortFromKey(d.date, locale);
          const isToday = d.date === todayKey;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDay(d.date)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 min-w-0 min-h-[44px] touch-manipulation rounded-xl py-1 transition-colors",
                "hover:bg-beige-light/80 active:bg-beige-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta"
              )}
              aria-label={viewDayAria(dayLabel)}
            >
              <span className="text-[10px] font-medium text-muted tabular-nums h-3.5">
                {d.feedCount > 0 ? d.feedCount : ""}
              </span>
              <div className="w-full flex items-end justify-center h-24">
                <div
                  className="w-full max-w-[28px] rounded-t-lg transition-all bg-terracotta"
                  style={{
                    height: `${Math.max(pct, d.feedCount > 0 ? 8 : 0)}%`,
                    opacity: d.feedCount > 0 ? 1 : 0.15,
                  }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] truncate w-full text-center font-medium",
                  isToday ? "text-terracotta" : "text-muted"
                )}
              >
                {dayLabel}
              </span>
              <span className="text-[9px] text-muted/70 tabular-nums leading-none">
                {dayNumFromKey(d.date)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-3 card-shadow mb-3">
      <p className="text-sm font-semibold text-foreground mb-2">{title}</p>
      {children}
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

export function StatsView({
  trackerId,
  babyName,
  birthDate,
  secretLink,
  selectedCaregiver,
  onBack,
  title,
}: StatsViewProps) {
  const { t, language } = useLanguage();
  const [now] = useState(Date.now());
  const [showExport, setShowExport] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>("daily");
  const todayKey = useMemo(() => getDateKeyInZone(now), [now]);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  /** Last day of the rolling 7-day weekly window; defaults to today. */
  const [selectedWeekEndKey, setSelectedWeekEndKey] = useState(todayKey);
  const locale = language === "zh" ? "zh-CN" : "en-US";

  const weeklySummary = useQuery(
    api.stats.getWeeklySummary,
    rangeMode === "weekly"
      ? { trackerId, now, endDateKey: selectedWeekEndKey }
      : "skip"
  );
  const dailyStats = useQuery(
    api.stats.getDailyStats,
    rangeMode === "daily"
      ? { trackerId, dateKey: selectedDateKey, now }
      : "skip"
  );

  if (showExport) {
    return (
      <ExportView
        trackerId={trackerId}
        babyName={babyName}
        onBack={() => setShowExport(false)}
      />
    );
  }

  const canGoNextDay = selectedDateKey < todayKey;
  const canGoNextWeek = selectedWeekEndKey < todayKey;

  const day = dailyStats?.day;
  const days = weeklySummary?.days;

  const weekFeedTotal = days?.reduce((sum, d) => sum + d.feedCount, 0) ?? 0;
  const weekDiaperTotal = days?.reduce((sum, d) => sum + d.diaperCount, 0) ?? 0;
  const weekSleepMinutes = days?.reduce((sum, d) => sum + d.sleepMinutes, 0) ?? 0;
  const hasWeekFeedData = days != null && !days.every((d) => d.feedCount === 0);

  const loading =
    rangeMode === "daily" ? dailyStats === undefined : weeklySummary === undefined;

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
  const weeklyAgeLine = formatWeekAgeLine(
    birthDate,
    weekStartKey,
    selectedWeekEndKey,
    language
  );
  const weekEndAge = birthDate
    ? formatAgeOnDate(birthDate, selectedWeekEndKey, language)
    : null;

  const wetOnly = day ? day.wetCount - day.bothCount : 0;
  const dirtyOnly = day ? day.dirtyCount - day.bothCount : 0;

  const openDayReport = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setRangeMode("daily");
  };

  const weekTotalsParts: string[] = [];
  if (weekFeedTotal > 0) {
    weekTotalsParts.push(
      t("scheduleCountFeeds", { count: String(weekFeedTotal) })
    );
  }
  if (weekDiaperTotal > 0) {
    weekTotalsParts.push(
      t("scheduleCountDiapers", { count: String(weekDiaperTotal) })
    );
  }
  if (weekSleepMinutes > 0) {
    weekTotalsParts.push(
      t("scheduleCountSleep", { time: formatSleepTotal(weekSleepMinutes) })
    );
  }

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
              {weeklyAgeLine}
            </p>
            {birthDate && !weekEndAge && (
              <p className="text-[11px] text-muted mt-1 break-words">
                {t("ageNotBornYet")}
              </p>
            )}
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

      {!birthDate && (
        <div className="mb-4 min-w-0">
          <p className="text-xs text-muted mb-2 break-words">
            {t("setBirthDatePrompt")}
          </p>
          {secretLink && selectedCaregiver && (
            <div className="bg-surface border border-border rounded-2xl p-3 card-shadow min-w-0">
              <BirthDateField
                secretLink={secretLink}
                actingCaregiverName={selectedCaregiver}
                birthDate={birthDate}
                compact
              />
            </div>
          )}
        </div>
      )}

      {rangeMode === "daily" && (
        <TodayTimetable
          trackerId={trackerId}
          mode="day"
          dateKey={selectedDateKey}
          hideRangeToggle
          className="px-0 pb-4"
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
        />
      )}

      {loading ? (
        <p className="text-sm text-muted">{t("loading")}</p>
      ) : rangeMode === "daily" && day ? (
        <div className="space-y-0">
          <p className="section-label">{t("todaysSummary")}</p>
          <SummaryCard title={t("feeds")}>
            {day.feedCount === 0 ? (
              <p className="text-sm text-muted">{t("noDataYet")}</p>
            ) : (
              <>
                <StatLine
                  label={t("statsTotalFeeds")}
                  value={String(day.feedCount)}
                />
                <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                  <StatLine
                    label={t("statsBreastfeeding")}
                    value={String(day.breastCount)}
                  />
                  <StatLine
                    label={t("statsBottle")}
                    value={String(day.bottleCount)}
                  />
                </div>
              </>
            )}
          </SummaryCard>

          <SummaryCard title={t("milkMl")}>
            {day.formulaMl + day.breastmilkMl + day.breastDurationMinutes ===
            0 ? (
              <p className="text-sm text-muted">{t("noDataYet")}</p>
            ) : (
              <>
                <StatLine
                  label={t("statsTotalMilkMl")}
                  value={`${day.formulaMl + day.breastmilkMl} ml`}
                />
                <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                  <StatLine
                    label={t("statsBreastMilkMl")}
                    value={
                      day.breastmilkMl > 0 ? `${day.breastmilkMl} ml` : "—"
                    }
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
                </div>
              </>
            )}
          </SummaryCard>

          <SummaryCard title={t("diapers")}>
            {day.diaperCount === 0 ? (
              <p className="text-sm text-muted">{t("noDataYet")}</p>
            ) : (
              <>
                <StatLine
                  label={t("statsTotalDiapers")}
                  value={String(day.diaperCount)}
                />
                <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                  <StatLine label={t("wet")} value={String(wetOnly)} />
                  <StatLine label={t("dirty")} value={String(dirtyOnly)} />
                  <StatLine label={t("both")} value={String(day.bothCount)} />
                </div>
              </>
            )}
          </SummaryCard>

          <SummaryCard title={t("pumps")}>
            {day.pumpCount === 0 ? (
              <p className="text-sm text-muted">{t("noDataYet")}</p>
            ) : (
              <>
                <StatLine
                  label={t("statsPumpTotalMl")}
                  value={`${day.pumpTotalMl} ml`}
                />
                <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
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
                </div>
              </>
            )}
          </SummaryCard>
        </div>
      ) : rangeMode === "weekly" && days ? (
        <div className="space-y-3">
          {weekTotalsParts.length > 0 && (
            <p className="text-[12px] text-muted leading-snug px-0.5">
              <span className="font-medium text-foreground/80">
                {t("scheduleWeekTotals")}
              </span>
              {": "}
              {weekTotalsParts.join(" · ")}
            </p>
          )}

          {!hasWeekFeedData ? (
            <div className="bg-surface border border-border rounded-2xl p-4 card-shadow">
              <p className="text-sm font-semibold text-foreground mb-2">
                {t("feedsPerDay")}
              </p>
              <p className="text-sm text-muted text-center py-6">
                {t("noDataYet")}
              </p>
            </div>
          ) : (
            <WeekFeedBars
              days={days.map((d) => ({
                date: d.date,
                feedCount: d.feedCount,
              }))}
              todayKey={todayKey}
              locale={locale}
              legend={t("feedsPerDay")}
              onSelectDay={openDayReport}
              viewDayAria={(dayLabel) =>
                t("viewDayReport", { day: dayLabel })
              }
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
