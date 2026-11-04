"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useRef, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatDateTime } from "@/app/lib/utils";

interface ExportViewProps {
  trackerId: Id<"trackers">;
  babyName?: string;
  onBack: () => void;
}

type ExportRow = {
  occurredAtUtc: string;
  occurredLocalIso: string;
  loggedAtUtc: string;
  loggedLocalIso: string;
  timezone: string;
  category: string;
  subcategory: string;
  amount?: number;
  unit?: string;
  durationMinutes?: number;
  milkType?: string;
  side?: string;
  stoolType?: string;
  stoolColour?: string;
  stoolTexture?: string;
  measurementSource?: string;
  expressedDate?: string;
  caregiverName: string;
  notes?: string;
  summary: string;
};

function escapeCsv(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function cell(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return '""';
  return escapeCsv(String(value));
}

/** Comment lines (# …) keep metadata out of the header row for CSV parsers. */
function metaComment(key: string, value: string | number | undefined): string {
  return `# ${key}=${value === undefined || value === "" ? "" : String(value)}`;
}

function rowsToCsv(
  meta: {
    babyName?: string;
    birthDate?: string;
    sex?: string;
    timezone: string;
    stashAvailableMl: number;
    exportedAtUtc: string;
    rangeDays: number;
  },
  rows: ExportRow[]
): string {
  const metaLines = [
    metaComment("baby_name", meta.babyName),
    metaComment("birth_date", meta.birthDate),
    metaComment("sex", meta.sex),
    metaComment("timezone", meta.timezone),
    metaComment("exported_at_utc", meta.exportedAtUtc),
    metaComment("range_days", meta.rangeDays),
    metaComment("stash_available_ml", meta.stashAvailableMl),
  ];

  const header = [
    "occurred_at_utc",
    "occurred_local_iso",
    "logged_at_utc",
    "logged_local_iso",
    "timezone",
    "category",
    "subcategory",
    "amount",
    "unit",
    "duration_minutes",
    "milk_type",
    "side",
    "stool_type",
    "stool_colour",
    "stool_texture",
    "measurement_source",
    "expressed_date",
    "caregiver",
    "notes",
  ].join(",");

  const lines = rows.map((r) =>
    [
      cell(r.occurredAtUtc),
      cell(r.occurredLocalIso),
      cell(r.loggedAtUtc),
      cell(r.loggedLocalIso),
      cell(r.timezone),
      cell(r.category),
      cell(r.subcategory),
      cell(r.amount),
      cell(r.unit),
      cell(r.durationMinutes),
      cell(r.milkType),
      cell(r.side),
      cell(r.stoolType),
      cell(r.stoolColour),
      cell(r.stoolTexture),
      cell(r.measurementSource),
      cell(r.expressedDate),
      cell(r.caregiverName),
      cell(r.notes),
    ].join(",")
  );

  return [...metaLines, header, ...lines].join("\n");
}

function downloadCsvWeb(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function shareCsvNative(csv: string, fileName: string) {
  const written = await Filesystem.writeFile({
    path: fileName,
    data: csv,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({
    title: fileName,
    files: [written.uri],
    dialogTitle: fileName,
  });
}

export function ExportView({ trackerId, babyName, onBack }: ExportViewProps) {
  const { t } = useLanguage();
  const [days, setDays] = useState<7 | 30>(7);
  const [now] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const isNative = Capacitor.isNativePlatform();

  const exportData = useQuery(api.export.getData, { trackerId, days, now });

  const buildCsv = () => {
    if (!exportData) return null;
    return rowsToCsv(
      {
        babyName: exportData.babyName ?? babyName,
        birthDate: exportData.birthDate,
        sex: exportData.sex,
        timezone: exportData.timezone,
        stashAvailableMl: exportData.stashAvailableMl,
        exportedAtUtc: exportData.exportedAtUtc,
        rangeDays: exportData.rangeDays,
      },
      exportData.rows
    );
  };

  const handleCopy = async () => {
    const csv = buildCsv();
    if (!csv) return;
    await navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    const csv = buildCsv();
    if (!csv || exportBusy) return;
    const fileName = `care-log-${days}d.csv`;
    setExportError(false);

    if (!isNative) {
      downloadCsvWeb(csv, fileName);
      return;
    }

    setExportBusy(true);
    try {
      await shareCsvNative(csv, fileName);
    } catch {
      setExportError(true);
    } finally {
      setExportBusy(false);
    }
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

      <div
        ref={printRef}
        className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4"
      >
        <h2 className="text-lg font-bold text-foreground mb-1">
          {t("exportSummary")}
          {babyName ? ` — ${babyName}` : ""}
        </h2>
        <p className="text-xs text-muted mb-4">
          {t("exportRange", { days: String(days) })} ·{" "}
          {t("exportGenerated")}: {formatDateTime(now)}
          {exportData && (
            <>
              {" · "}
              {exportData.timezone}
              {" · "}
              {t("stashAvailableMl", {
                ml: String(exportData.stashAvailableMl),
              })}
            </>
          )}
        </p>

        {!exportData ? (
          <p className="text-sm text-muted">{t("loading")}</p>
        ) : exportData.rows.length === 0 ? (
          <p className="text-sm text-muted">{t("noDataYet")}</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto print:max-h-none">
            {exportData.rows.map((row, i) => (
              <div
                key={`${row.occurredAtUtc}-${row.category}-${i}`}
                className="flex gap-2 text-sm border-b border-border/50 pb-2 last:border-0"
              >
                <span className="text-muted shrink-0 w-28 text-xs">
                  {row.occurredLocalIso.replace("T", " ")}
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
          onClick={() => void handleCopy()}
          disabled={!exportData?.rows.length}
          className="w-full py-3.5 px-6 rounded-xl font-medium text-sm bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? t("csvCopied") : t("copyCsv")}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!exportData?.rows.length || exportBusy}
          className="w-full py-3.5 px-6 rounded-xl font-medium text-sm border border-border bg-surface text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exportBusy
            ? t("loading")
            : isNative
              ? t("shareCsv")
              : t("downloadCsv")}
        </button>
        {exportError && (
          <p className="text-xs text-center text-red-600">{t("exportFailed")}</p>
        )}
        <button
          type="button"
          onClick={handlePrint}
          disabled={!exportData?.rows.length}
          className="w-full py-3.5 px-6 rounded-xl font-medium text-sm border border-border bg-surface text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("printSummary")}
        </button>
      </div>
    </div>
  );
}
