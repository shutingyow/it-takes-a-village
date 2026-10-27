"use client";

import { formatMinutesCompact } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconFeed } from "./icons";
import type { ActivityEntry } from "./ActivityEntryCard";
import { SwipeableRow } from "./SwipeableRow";

export type FeedActivityEntry = Extract<ActivityEntry, { entryType: "feed" }>;

interface FeedIntervalListProps {
  feeds: FeedActivityEntry[];
  /** Oldest-first matches Insights Daily. Newest-first matches History. */
  order?: "oldest" | "newest";
  showSummary?: boolean;
  onEdit?: (entry: FeedActivityEntry) => void;
  onDelete?: (entry: FeedActivityEntry) => void;
}

function feedMinutes(entry: FeedActivityEntry): number | null {
  const minutes = entry.durationMinutes ?? entry.duration;
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(minutes);
}

function resolveBottleMilk(
  entry: FeedActivityEntry
): "formula" | "breastmilk" | null {
  if (entry.type !== "bottle") return null;
  if (entry.bottleMilk === "formula" || entry.bottleMilk === "breastmilk") {
    return entry.bottleMilk;
  }
  const notes = entry.notes?.toLowerCase() ?? "";
  if (notes.includes("breastmilk") || notes.includes("breast milk")) {
    return "breastmilk";
  }
  if (notes.includes("formula")) return "formula";
  return null;
}

function IntervalBar({ minutes }: { minutes: number }) {
  const { t } = useLanguage();
  const label = formatMinutesCompact(minutes);

  return (
    <div
      className="flex items-center gap-2 py-1.5 min-w-0"
      role="separator"
      aria-label={t("feedIntervalAria", { time: label })}
    >
      <span className="h-px flex-1 min-w-3 bg-border" />
      <span className="text-[11px] font-medium text-terracotta tabular-nums shrink-0">
        ↕ {label}
      </span>
      <span className="h-px flex-1 min-w-3 bg-border" />
    </div>
  );
}

export function FeedIntervalList({
  feeds,
  order = "oldest",
  showSummary = false,
  onEdit,
  onDelete,
}: FeedIntervalListProps) {
  const { t, language } = useLanguage();

  const ordered = [...feeds].sort((a, b) =>
    order === "newest" ? b.time - a.time : a.time - b.time
  );

  if (ordered.length === 0) return null;

  const formatClock = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString(language === "zh" ? "zh-CN" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const breastCount = ordered.filter((entry) => entry.type === "breast").length;
  const bottleCount = ordered.filter((entry) => entry.type === "bottle").length;
  const solidsCount = ordered.filter((entry) => entry.type === "solids").length;
  const totalMl = ordered.reduce(
    (sum, entry) =>
      entry.type === "bottle" ? sum + (entry.amount ?? 0) : sum,
    0
  );
  const totalGrams = ordered.reduce(
    (sum, entry) =>
      entry.type === "solids" ? sum + (entry.amountGrams ?? 0) : sum,
    0
  );
  const totalMinutes = ordered.reduce(
    (sum, entry) => sum + (feedMinutes(entry) ?? 0),
    0
  );
  const summaryExtras = [
    totalMl > 0 ? t("amountMlCompact", { amount: totalMl }) : null,
    totalGrams > 0 ? t("amountGramsCompact", { amount: totalGrams }) : null,
    totalMinutes > 0 ? formatMinutesCompact(totalMinutes) : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      {showSummary && (
        <p className="text-xs text-muted mb-2 leading-snug break-words">
          {solidsCount > 0
            ? t("feedListCountsWithSolids", {
                count: ordered.length,
                breast: breastCount,
                bottle: bottleCount,
                solids: solidsCount,
              })
            : t("feedListCounts", {
                count: ordered.length,
                breast: breastCount,
                bottle: bottleCount,
              })}
          {summaryExtras.length > 0 ? ` · ${summaryExtras.join(" · ")}` : ""}
        </p>
      )}
      <ul className="min-w-0">
        {ordered.map((entry, index) => {
          const minutes = feedMinutes(entry);
          const neighbor =
            order === "newest" ? ordered[index + 1] : ordered[index - 1];
          const gap =
            neighbor == null
              ? null
              : Math.max(0, Math.round(Math.abs(entry.time - neighbor.time) / 60000));
          const showBarBefore = order === "oldest" && gap != null;
          const showBarAfter = order === "newest" && gap != null;

          const startLabel = formatClock(entry.time);
          const timeLabel =
            minutes == null
              ? startLabel
              : `${startLabel} – ${formatClock(entry.time + minutes * 60_000)}`;

          const milk = resolveBottleMilk(entry);
          const kind =
            entry.type === "breast"
              ? entry.side
                ? `${t("breast")} · ${entry.side === "left" ? t("left") : t("right")}`
                : t("breast")
              : entry.type === "solids"
                ? entry.foodName?.trim()
                  ? `${t("solids")} · ${entry.foodName.trim()}`
                  : t("solids")
                : milk === "formula"
                  ? `${t("bottle")} · ${t("formula")}`
                  : milk === "breastmilk"
                    ? `${t("bottle")} · ${t("breastMilk")}`
                    : t("bottle");

          const row = (
            <div className="flex items-start gap-2.5 min-w-0 py-1.5 px-0.5">
              <div
                className={
                  entry.type === "solids"
                    ? "w-8 h-8 rounded-full bg-accent-solids-light/50 text-accent-solids flex items-center justify-center shrink-0 mt-0.5"
                    : "w-8 h-8 rounded-full bg-accent-feed-light text-accent-feed flex items-center justify-center shrink-0 mt-0.5"
                }
              >
                <IconFeed size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-snug break-words">
                  {timeLabel}
                </p>
                <p className="text-xs text-muted mt-0.5 truncate">{kind}</p>
                {(onEdit || onDelete) && (
                  <p className="text-[10px] text-muted/80 mt-1 sm:hidden">
                    {t("swipeHint")}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right leading-tight pt-0.5">
                {minutes != null && (
                  <p className="text-sm font-medium text-foreground tabular-nums">
                    {formatMinutesCompact(minutes)}
                  </p>
                )}
                {entry.type === "solids" && entry.amountGrams != null && (
                  <p className="text-xs text-muted tabular-nums mt-0.5">
                    {t("amountGramsCompact", { amount: entry.amountGrams })}
                  </p>
                )}
                {entry.type === "bottle" && entry.amount != null && (
                  <p className="text-xs text-muted tabular-nums mt-0.5">
                    {t("amountMlCompact", { amount: entry.amount })}
                  </p>
                )}
              </div>
            </div>
          );

          return (
            <li key={entry._id} className="min-w-0">
              {showBarBefore && gap != null && <IntervalBar minutes={gap} />}
              {onEdit || onDelete ? (
                <SwipeableRow
                  editLabel={t("edit")}
                  deleteLabel={t("delete")}
                  contentClassName="bg-[var(--surface)]"
                  onEdit={onEdit ? () => onEdit(entry) : undefined}
                  onDelete={onDelete ? () => onDelete(entry) : undefined}
                >
                  {row}
                </SwipeableRow>
              ) : (
                row
              )}
              {showBarAfter && gap != null && <IntervalBar minutes={gap} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
