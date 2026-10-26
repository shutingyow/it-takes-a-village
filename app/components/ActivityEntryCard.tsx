"use client";

import {
  formatDuration,
  formatGrowthLine,
  formatMinutesCompact,
} from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { ActivityIcon } from "./icons";
import type { ActivityType } from "./icons";
import { cn } from "@/app/lib/utils";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { NotePhoto } from "./NotePhoto";
import { Id } from "@/convex/_generated/dataModel";
import { activityKindKey, momentPresetKey } from "@/app/lib/logKinds";
import { SwipeableRow } from "./SwipeableRow";

type TFunction = (
  key: TranslationKey,
  values?: Record<string, string | number>
) => string;

export type ActivityEntry = FunctionReturnType<
  typeof api.history.getActivity
>[number] | FunctionReturnType<
  typeof api.history.getActivityForDay
>[number];

const iconBg: Record<string, string> = {
  feed: "bg-beige-light text-accent-feed",
  sleep: "bg-accent-sleep text-white",
  nap: "bg-accent-sleep text-white",
  diaper: "bg-accent-diaper text-white",
  pump: "bg-beige-light text-muted",
  health: "bg-beige-light text-accent-health",
  growth: "bg-primary-light text-primary",
  activity: "bg-primary-light text-primary",
  moment: "bg-terracotta-light text-terracotta",
};

interface ActivityEntryCardProps {
  entry: ActivityEntry;
  timeLabel?: string;
  isLast?: boolean;
  onEdit?: (entry: ActivityEntry) => void;
  onDelete?: (entry: ActivityEntry) => void;
}

function getPhotoIds(entry: ActivityEntry): Id<"_storage">[] | undefined {
  if (
    entry.entryType === "feed" ||
    entry.entryType === "sleep" ||
    entry.entryType === "diaper" ||
    entry.entryType === "pump"
  ) {
    return entry.photoIds;
  }
  return undefined;
}

export function ActivityEntryCard({
  entry,
  timeLabel,
  isLast = false,
  onEdit,
  onDelete,
}: ActivityEntryCardProps) {
  const { t } = useLanguage();

  const entryType = iconTypeFor(entry);
  const title = getTitle(entry, t);
  const subtitle = getSubtitle(entry, t);
  const notes = entryNotes(entry);
  const photoIds = getPhotoIds(entry);
  const showActions = Boolean(onEdit || onDelete);

  const body = (
    <div className="relative flex gap-3 pl-1">
      {!isLast && <div className="timeline-line" />}
      <div
        className={cn(
          "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          iconBg[entryType]
        )}
      >
        <ActivityIcon type={entryType} size={14} />
      </div>
      <div className="flex-1 min-w-0 pb-5 pt-0.5 pr-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {title}
          </p>
          {timeLabel && (
            <span className="text-xs text-muted shrink-0 pt-0.5">
              {timeLabel}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        )}
        {notes && (
          <p className="text-xs text-muted mt-0.5 line-clamp-2 break-words">
            {notes}
          </p>
        )}
        {photoIds && photoIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {photoIds.map((id) => (
              <NotePhoto key={id} storageId={id} size="sm" />
            ))}
          </div>
        )}
        {showActions && (
          <p className="text-[10px] text-muted/80 mt-2 sm:hidden">
            {t("swipeHint")}
          </p>
        )}
        {showActions && (
          <div className="hidden sm:flex items-center gap-3 mt-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="text-xs font-semibold text-primary"
              >
                {t("edit")}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(entry)}
                className="text-xs font-semibold text-[#c45c5c]"
              >
                {t("delete")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!showActions) return body;

  return (
    <SwipeableRow
      editLabel={t("edit")}
      deleteLabel={t("delete")}
      onEdit={onEdit ? () => onEdit(entry) : undefined}
      onDelete={onDelete ? () => onDelete(entry) : undefined}
    >
      {body}
    </SwipeableRow>
  );
}

function resolveBottleMilk(
  entry: ActivityEntry
): "formula" | "breastmilk" | null {
  if (entry.entryType !== "feed" || entry.type !== "bottle") return null;
  if (entry.bottleMilk === "formula" || entry.bottleMilk === "breastmilk") {
    return entry.bottleMilk;
  }
  const notes = entry.notes?.toLowerCase() ?? "";
  if (notes.includes("breastmilk") || notes.includes("breast milk")) {
    return "breastmilk";
  }
  if (notes.includes("formula")) {
    return "formula";
  }
  return null;
}

function iconTypeFor(entry: ActivityEntry): ActivityType {
  switch (entry.entryType) {
    case "feed":
    case "sleep":
    case "nap":
    case "diaper":
    case "pump":
    case "health":
    case "growth":
    case "activity":
    case "moment":
      return entry.entryType;
  }
}

function entryNotes(entry: ActivityEntry): string | null {
  if (
    entry.entryType === "activity" ||
    entry.entryType === "moment" ||
    entry.entryType === "nap"
  ) {
    const notes = entry.notes?.trim();
    return notes ? notes : null;
  }
  return null;
}

function getTitle(entry: ActivityEntry, t: TFunction): string {
  if (entry.entryType === "feed") {
    if (entry.type === "breast") {
      const feedType = t("breastFeed");
      if (entry.side) {
        const side =
          entry.side === "left"
            ? `${t("left")} side`
            : `${t("right")} side`;
        return `${feedType} · ${side}`;
      }
      return feedType;
    }
    const milk = resolveBottleMilk(entry);
    if (milk === "formula") {
      return `${t("bottle")} · ${t("formula")}`;
    }
    if (milk === "breastmilk") {
      return `${t("bottle")} · ${t("breastMilk")}`;
    }
    return t("bottleFeed");
  }
  if (entry.entryType === "sleep") {
    return entry.endTime ? t("sleepSession") : t("napStarted");
  }
  if (entry.entryType === "nap") {
    return entry.endTime ? t("filterNap") : t("napStarted");
  }
  if (entry.entryType === "activity") {
    return t(activityKindKey[entry.kind]);
  }
  if (entry.entryType === "moment") {
    const custom = entry.text?.trim();
    if (custom) return custom;
    if (entry.preset) return t(momentPresetKey[entry.preset]);
    return t("momentTitle");
  }
  if (entry.entryType === "diaper") {
    const typeLabel =
      entry.type === "wet"
        ? t("wet")
        : entry.type === "dirty"
          ? t("dirty")
          : t("wetDirty");
    return `${t("diaperChange")} · ${typeLabel}`;
  }
  if (entry.entryType === "pump") {
    return `${t("pump")} · ${entry.amount}ml`;
  }
  if (entry.entryType === "health") {
    if (entry.type === "temperature") {
      return `${t("temperature")} · ${entry.temperature?.toFixed(1)}°C`;
    }
    if (entry.type === "medication") {
      return `${t("medication")} · ${entry.medicationName}`;
    }
    return `${t("weight")} · ${entry.weight?.toFixed(1)} kg`;
  }
  if (entry.entryType === "growth") {
    const line = formatGrowthLine(entry);
    return line ? `${t("growth")} · ${line}` : t("growth");
  }
  return t("health");
}

function appendLoggedBy(
  parts: string[],
  caregiverName: string | undefined,
  t: TFunction
): string | null {
  const name = caregiverName?.trim();
  if (name) parts.push(t("loggedBy", { name }));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function getSubtitle(entry: ActivityEntry, t: TFunction): string | null {
  if (entry.entryType === "feed") {
    const parts: string[] = [];
    const minutes = entry.durationMinutes ?? entry.duration;
    if (minutes) {
      parts.push(t("feedDurationMinutes", { min: minutes }));
    }
    if (entry.intervalMinutes != null) {
      parts.push(
        t("feedIntervalSinceLast", {
          time: formatMinutesCompact(entry.intervalMinutes),
        })
      );
    }
    if (entry.amount) parts.push(`${entry.amount} ml`);
    if (entry.type === "bottle" && entry.bottleTemperature === "room") {
      parts.push(t("bottleTempRoom"));
    } else if (entry.type === "bottle" && entry.bottleTemperature === "warm40") {
      parts.push(t("bottleTempWarm40"));
    }
    return appendLoggedBy(parts, entry.caregiverName, t);
  }
  if (entry.entryType === "sleep") {
    if (entry.endTime) {
      return formatDuration(entry.startTime, entry.endTime);
    }
    return t("currentlySleeping");
  }
  if (entry.entryType === "nap") {
    const parts: string[] = [];
    const minutes =
      entry.durationMinutes ??
      (entry.endTime
        ? Math.max(1, Math.round((entry.endTime - entry.startTime) / 60000))
        : null);
    if (minutes) {
      parts.push(t("feedDurationMinutes", { min: minutes }));
    } else if (!entry.endTime) {
      parts.push(t("nappingNow"));
    }
    return appendLoggedBy(parts, entry.caregiverName, t);
  }
  if (entry.entryType === "activity") {
    const parts: string[] = [];
    if (entry.durationMinutes) {
      parts.push(t("feedDurationMinutes", { min: entry.durationMinutes }));
    }
    return appendLoggedBy(parts, entry.caregiverName, t);
  }
  if (entry.entryType === "moment") {
    return appendLoggedBy([], entry.caregiverName, t);
  }
  if (entry.entryType === "diaper") {
    const parts: string[] = [];
    if (entry.type === "wet") parts.push(t("wetOnly"));
    else if (entry.type === "dirty") parts.push(t("dirty"));
    else parts.push(t("wetDirty"));
    return appendLoggedBy(parts, entry.caregiverName, t);
  }
  if (entry.entryType === "pump") {
    const parts: string[] = [];
    if (entry.side) parts.push(`${entry.side} side`);
    return appendLoggedBy(parts, entry.caregiverName, t);
  }
  if (entry.entryType === "health" && entry.type === "medication" && entry.dosage) {
    return appendLoggedBy([entry.dosage], entry.caregiverName, t);
  }
  if (entry.entryType === "health" || entry.entryType === "growth") {
    return appendLoggedBy([], entry.caregiverName, t);
  }
  return null;
}
