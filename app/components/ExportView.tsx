"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRef, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatDateTime } from "@/app/lib/utils";

interface ExportViewProps {
  trackerId: Id<"trackers">;
  babyName?: string;
  onBack: () => void;
}

function rowsToCsv(
  rows: Array<{
    category: string;
    timestamp: number;
    summary: string;
    caregiverName: string;
    notes?: string;
  }>
): string {
  const header = "Date,Time,Category,Summary,Caregiver,Notes";
  const lines = rows.map((r) => {
    const date = new Date(r.timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      escape(dateStr),
      escape(timeStr),
      escape(r.category),
      escape(r.summary),
      escape(r.caregiverName),
      escape(r.notes ?? ""),
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

export function ExportView({ trackerId, babyName, onBack }: ExportViewProps) {
  const { t } = useLanguage();
  const [days, setDays] = useState<7 | 30>(7);
  const [now] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const exportData = useQuery(api.export.getData, { trackerId, days, now });

  const handleCopy = async () => {
    if (!exportData) return;
    const csv = rowsToCsv(exportData.rows);
    await navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!exportData) return;
    const csv = rowsToCsv(exportData.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `care-log-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-sm font-semibold text-primary flex items-center gap-1 print:hidden"
      >
        {t("backToMore")}
      </button>

      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 print:hidden">
        {t("exportData")}
      </p>

      <div className="flex gap-2 mb-4 print:hidden">
        <button
          type="button"
          onClick={() => setDays(7)}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
            days === 7 ? "bg-primary text-white" : "bg-[#f3ede7] text-muted"
          }`}
        >
          {t("exportLast7")}
        </button>
        <button
          type="button"
          onClick={() => setDays(30)}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
            days === 30 ? "bg-primary text-white" : "bg-[#f3ede7] text-muted"
          }`}
        >
          {t("exportLast30")}
        </button>
      </div>

      <div ref={printRef} className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <h2 className="text-lg font-bold text-foreground mb-1">
          {t("exportSummary")}
          {babyName ? ` — ${babyName}` : ""}
        </h2>
        <p className="text-xs text-muted mb-4">
          {t("exportRange", { days: String(days) })} ·{" "}
          {t("exportGenerated")}: {formatDateTime(now)}
        </p>

        {!exportData ? (
          <p className="text-sm text-muted">{t("loading")}</p>
        ) : exportData.rows.length === 0 ? (
          <p className="text-sm text-muted">{t("noDataYet")}</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto print:max-h-none">
            {exportData.rows.map((row, i) => (
              <div
                key={`${row.timestamp}-${row.category}-${i}`}
                className="flex gap-2 text-sm border-b border-border/50 pb-2 last:border-0"
              >
                <span className="text-muted shrink-0 w-28 text-xs">
                  {formatDateTime(row.timestamp)}
                </span>
                <span className="font-medium capitalize shrink-0 w-14">
                  {row.category}
                </span>
                <span className="flex-1">{row.summary}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 print:hidden">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!exportData?.rows.length}
          className="btn-primary"
        >
          {copied ? t("csvCopied") : t("copyCsv")}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!exportData?.rows.length}
          className="w-full py-3 rounded-xl border border-border bg-surface font-semibold text-sm"
        >
          {t("downloadCsv")}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!exportData?.rows.length}
          className="w-full py-3 rounded-xl border border-border bg-surface font-semibold text-sm text-muted"
        >
          {t("printSummary")}
        </button>
      </div>
    </div>
  );
}
