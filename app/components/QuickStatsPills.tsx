"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { Id } from "@/convex/_generated/dataModel";
import { formatTimeAgo } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { cn } from "@/app/lib/utils";

interface QuickStatsPillsProps {
  trackerId: Id<"trackers">;
  lastFeed?: Doc<"feedEntries"> | null;
  lastDiaper?: Doc<"diaperEntries"> | null;
}

/** Compact last-activity chips. Next feed/pump live in DueSoonCard heroes. */
export function QuickStatsPills({
  lastFeed,
  lastDiaper,
}: QuickStatsPillsProps) {
  const { t } = useLanguage();

  const pills = [
    {
      label: t("lastFed"),
      value: lastFeed ? formatTimeAgo(lastFeed.timestamp) : "—",
    },
    {
      label: t("diaper"),
      value: lastDiaper ? formatTimeAgo(lastDiaper.timestamp) : "—",
    },
  ];

  return (
    <div className="px-3 sm:px-4 pb-5 min-w-0">
      <p className="section-label">{t("atAGlance")}</p>
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 -mx-0.5 px-0.5 max-w-full touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pills.map((pill) => (
          <div
            key={pill.label}
            className={cn(
              "shrink-0 rounded-2xl px-3 sm:px-4 py-3 min-w-[6.5rem] sm:min-w-[118px] min-h-[3.75rem]",
              "bg-beige-light text-foreground"
            )}
          >
            <p className="text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase mb-1 truncate text-muted">
              {pill.label}
            </p>
            <p className="text-sm sm:text-[15px] font-bold leading-snug">
              {pill.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
