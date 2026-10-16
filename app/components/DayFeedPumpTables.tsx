"use client";

import type { ReactNode } from "react";

import { formatMinutesCompact, formatTime } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { ActivityEntry } from "./ActivityEntryCard";
import { FeedIntervalList } from "./FeedIntervalList";

const DASH = "—";

interface DayFeedPumpTablesProps {
  entries: ActivityEntry[] | undefined;
}

function resolveBottleMilk(
  entry: Extract<ActivityEntry, { entryType: "feed" }>
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

function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain touch-pan-x">
      <table className="w-max min-w-full border-collapse text-left text-[11px] sm:text-xs">
        {children}
      </table>
    </div>
  );
}

const headCell =
  "sticky top-0 bg-surface px-2 py-1.5 font-semibold text-muted whitespace-nowrap border-b border-border";
const bodyCell =
  "px-2 py-1.5 whitespace-nowrap border-b border-border/70 text-foreground align-top";
const notesCell = `${bodyCell} max-w-[9rem] truncate`;

export function DayFeedPumpTables({ entries }: DayFeedPumpTablesProps) {
  const { t } = useLanguage();

  if (entries === undefined) {
    return <p className="text-sm text-muted mb-4">{t("loading")}</p>;
  }

  const feeds = entries
    .filter(
      (entry): entry is Extract<ActivityEntry, { entryType: "feed" }> =>
        entry.entryType === "feed"
    )
    .sort((a, b) => a.time - b.time);
  const pumps = entries
    .filter(
      (entry): entry is Extract<ActivityEntry, { entryType: "pump" }> =>
        entry.entryType === "pump"
    )
    .sort((a, b) => a.time - b.time);

  return (
    <div className="space-y-3 mb-4 min-w-0">
      <section className="bg-surface border border-border rounded-2xl p-3 sm:p-4 card-shadow min-w-0">
        <p className="text-sm font-semibold text-foreground mb-2">
          {t("feedsTableTitle")}
          {feeds.length > 0 ? ` · ${feeds.length}` : ""}
        </p>
        {feeds.length === 0 ? (
          <p className="text-sm text-muted text-center py-3">
            {t("noFeedsThisDay")}
          </p>
        ) : (
          <>
            <FeedIntervalList feeds={feeds} order="oldest" showSummary />
            <div className="mt-3 border-t border-border pt-3">
          <ScrollTable>
            <thead>
              <tr>
                <th className={`${headCell} sticky left-0 z-10`}>{t("colTime")}</th>
                <th className={headCell}>{t("colFeedType")}</th>
                <th className={headCell}>{t("colAmount")}</th>
                <th className={headCell}>{t("colMilk")}</th>
                <th className={headCell}>{t("colDuration")}</th>
                <th className={headCell}>{t("colInterval")}</th>
                <th className={headCell}>{t("colNotes")}</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((entry) => {
                const minutes = entry.durationMinutes ?? entry.duration;
                const milk = resolveBottleMilk(entry);
                const typeLabel =
                  entry.type === "breast"
                    ? entry.side
                      ? `${t("breast")} · ${entry.side === "left" ? t("left") : t("right")}`
                      : t("breast")
                    : t("bottle");
                const milkLabel =
                  milk === "formula"
                    ? t("formula")
                    : milk === "breastmilk"
                      ? t("breastMilk")
                      : DASH;
                return (
                  <tr key={entry._id}>
                    <td className={`${bodyCell} sticky left-0 z-10 bg-surface font-medium`}>
                      {formatTime(entry.time)}
                    </td>
                    <td className={bodyCell}>{typeLabel}</td>
                    <td className={bodyCell}>
                      {entry.amount != null ? `${entry.amount} ml` : DASH}
                    </td>
                    <td className={bodyCell}>{milkLabel}</td>
                    <td className={bodyCell}>
                      {minutes
                        ? t("feedDurationMinutes", { min: minutes })
                        : DASH}
                    </td>
                    <td className={bodyCell}>
                      {entry.intervalMinutes != null
                        ? formatMinutesCompact(entry.intervalMinutes)
                        : DASH}
                    </td>
                    <td className={notesCell} title={entry.notes ?? undefined}>
                      {entry.notes?.trim() ? entry.notes : DASH}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScrollTable>
            </div>
          </>
        )}
      </section>

      <section className="bg-surface border border-border rounded-2xl p-3 sm:p-4 card-shadow min-w-0">
        <p className="text-sm font-semibold text-foreground mb-2">
          {t("pumpsTableTitle")}
          {pumps.length > 0 ? ` · ${pumps.length}` : ""}
        </p>
        {pumps.length === 0 ? (
          <p className="text-sm text-muted text-center py-3">
            {t("noPumpsThisDay")}
          </p>
        ) : (
          <ScrollTable>
            <thead>
              <tr>
                <th className={`${headCell} sticky left-0 z-10`}>{t("colTime")}</th>
                <th className={headCell}>{t("colAmount")}</th>
                <th className={headCell}>{t("colSide")}</th>
                <th className={headCell}>{t("colNotes")}</th>
              </tr>
            </thead>
            <tbody>
              {pumps.map((entry) => {
                const sideLabel =
                  entry.side === "left"
                    ? t("left")
                    : entry.side === "right"
                      ? t("right")
                      : entry.side === "both"
                        ? t("both")
                        : DASH;
                return (
                  <tr key={entry._id}>
                    <td className={`${bodyCell} sticky left-0 z-10 bg-surface font-medium`}>
                      {formatTime(entry.time)}
                    </td>
                    <td className={bodyCell}>{entry.amount} ml</td>
                    <td className={bodyCell}>{sideLabel}</td>
                    <td className={notesCell} title={entry.notes ?? undefined}>
                      {entry.notes?.trim() ? entry.notes : DASH}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScrollTable>
        )}
      </section>
    </div>
  );
}
