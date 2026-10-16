"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { cn } from "@/app/lib/utils";

export type ActivityFilterType =
  | "all"
  | "feed"
  | "diaper"
  | "pump"
  | "activity"
  | "nap"
  | "moment"
  | "health"
  | "growth";

const FILTERS: Array<{ id: ActivityFilterType; labelKey: TranslationKey }> = [
  { id: "all", labelKey: "filterAll" },
  { id: "feed", labelKey: "feed" },
  { id: "diaper", labelKey: "diaper" },
  { id: "pump", labelKey: "pump" },
  { id: "activity", labelKey: "filterActivity" },
  { id: "nap", labelKey: "filterNap" },
  { id: "moment", labelKey: "filterMoments" },
  { id: "health", labelKey: "health" },
  { id: "growth", labelKey: "growth" },
];

/** Recent activity hides Health and Growth chips. History and Insights keep them. */
export const RECENT_ACTIVITY_FILTERS: ActivityFilterType[] = [
  "all",
  "feed",
  "diaper",
  "pump",
  "activity",
  "nap",
  "moment",
];

interface ActivityTypeFilterProps {
  value: ActivityFilterType;
  onChange: (value: ActivityFilterType) => void;
  className?: string;
  types?: readonly ActivityFilterType[];
}

export function ActivityTypeFilter({
  value,
  onChange,
  className,
  types,
}: ActivityTypeFilterProps) {
  const { t } = useLanguage();
  const filters = types
    ? FILTERS.filter((filter) => types.includes(filter.id))
    : FILTERS;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto overscroll-x-contain pb-1 -mx-0.5 px-0.5 max-w-full touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      role="tablist"
      aria-label={t("filterByActivity")}
    >
      {filters.map((filter) => {
        const selected = value === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(filter.id)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors touch-manipulation min-h-[36px]",
              selected
                ? "bg-terracotta text-white"
                : "bg-beige-light text-muted hover:text-foreground"
            )}
          >
            {t(filter.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

export function matchesActivityFilter(
  entryType: string,
  filter: ActivityFilterType
): boolean {
  if (filter === "all") return true;
  return entryType === filter;
}
