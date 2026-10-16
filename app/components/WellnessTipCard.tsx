"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  WELLNESS_TIPS,
  getDailyTipIndex,
  getTipAt,
  type TipAudience,
} from "@/app/lib/wellnessTips";
import { cn } from "@/app/lib/utils";

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

export function WellnessTipCard() {
  const { t, language } = useLanguage();
  const dailyIndex = useMemo(() => getDailyTipIndex(), []);
  const [offset, setOffset] = useState(0);

  const tip = getTipAt(dailyIndex + offset);
  const styles = audienceStyles(tip.audience);
  const text = language === "zh" ? tip.zh : tip.en;
  const audienceLabel =
    tip.audience === "baby" ? t("tipForBaby") : t("tipForYou");

  return (
    <div className="px-4 pt-1 pb-2 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <p className="section-label mb-0 truncate">{t("todaysTip")}</p>
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
          {t("wellnessTipDisclaimer")}
        </p>
      </button>

      <p className="sr-only">
        {offset + 1} / {WELLNESS_TIPS.length}
      </p>
    </div>
  );
}
