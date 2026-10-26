"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import type { AgeBandId } from "@/app/lib/babyAge";
import {
  getDailyTipIndex,
  getTipAt,
  getTipsForContext,
  resolveAgeBand,
  type TipAudience,
} from "@/app/lib/wellnessTips";
import { cn } from "@/app/lib/utils";

const AGE_BAND_LABEL_KEYS: Record<AgeBandId, TranslationKey> = {
  newborn: "tipAgeBandNewborn",
  weeks_0_4: "tipAgeBandWeeks04",
  weeks_4_8: "tipAgeBandWeeks48",
  weeks_8_12: "tipAgeBandWeeks812",
  months_3_6: "tipAgeBandMonths36",
  months_6_9: "tipAgeBandMonths69",
  months_9_12: "tipAgeBandMonths912",
  months_12_plus: "tipAgeBandMonths12Plus",
};

function audienceStyles(audience: TipAudience) {
  if (audience === "baby") {
    return {
      badge: "bg-primary-light text-primary",
      accent: "border-l-primary",
    };
  }
  return {
    badge: "bg-terracotta-light text-terracotta",
    accent: "border-l-terracotta",
  };
}

interface WellnessTipCardProps {
  birthDate?: string;
  onOpenMilestones?: () => void;
  onOpenSettings?: () => void;
}

export function WellnessTipCard({
  birthDate,
  onOpenMilestones,
  onOpenSettings,
}: WellnessTipCardProps) {
  const { t, language } = useLanguage();
  const tips = useMemo(() => getTipsForContext(birthDate), [birthDate]);
  const ageBand = useMemo(() => resolveAgeBand(birthDate), [birthDate]);
  const dailyIndex = useMemo(
    () => getDailyTipIndex(tips.length),
    [tips.length]
  );
  const [offset, setOffset] = useState(0);

  const tip = getTipAt(tips, dailyIndex + offset);
  const styles = audienceStyles(tip.audience);
  const text = language === "zh" ? tip.zh : tip.en;
  const audienceLabel =
    tip.audience === "baby" ? t("tipForBaby") : t("tipForYou");
  const bandLabel = ageBand ? t(AGE_BAND_LABEL_KEYS[ageBand]) : null;

  return (
    <div className="px-4 pt-1 pb-2 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <div className="min-w-0">
          <p className="section-label mb-0 truncate">{t("todaysTip")}</p>
          {bandLabel && (
            <p className="text-[11px] text-muted mt-0.5 truncate">
              {t("tipForAge", { band: bandLabel })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="shrink-0 text-xs font-semibold text-terracotta px-2 py-1.5 -mr-1 rounded-lg active:bg-terracotta-light touch-manipulation"
        >
          {t("nextTip")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOffset((o) => o + 1)}
        className={cn(
          "w-full text-left bg-surface border border-border rounded-2xl p-4 card-shadow",
          "border-l-[3px] active:scale-[0.995] transition-transform",
          styles.accent
        )}
        aria-label={`${t("todaysTip")}: ${audienceLabel}. ${t("nextTip")}`}
      >
        <span
          className={cn(
            "inline-block text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md mb-2.5",
            styles.badge
          )}
        >
          {audienceLabel}
        </span>
        <p className="text-sm leading-relaxed text-foreground">{text}</p>
        <p className="text-[10px] text-muted mt-3 leading-snug">
          {ageBand
            ? t("wellnessTipAgeDisclaimer")
            : t("wellnessTipDisclaimer")}
        </p>
      </button>

      {!birthDate && onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-2 w-full text-left text-xs text-terracotta font-medium px-1 py-1.5 rounded-lg active:bg-terracotta-light touch-manipulation"
        >
          {t("tipSetBirthDate")}
        </button>
      )}

      {birthDate && onOpenMilestones && (
        <button
          type="button"
          onClick={onOpenMilestones}
          className="mt-2 w-full text-left text-xs text-muted font-medium px-1 py-1.5 rounded-lg active:bg-primary-light touch-manipulation"
        >
          {t("tipViewMilestones")}
        </button>
      )}

      <p className="sr-only">
        {offset + 1} / {tips.length}
      </p>
    </div>
  );
}
