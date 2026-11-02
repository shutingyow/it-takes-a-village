"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { cn } from "@/app/lib/utils";

type LanguageToggleProps = {
  variant?: "compact" | "full";
  className?: string;
};

export function LanguageToggle({
  variant = "compact",
  className,
}: LanguageToggleProps) {
  const { language, setLanguage, t } = useLanguage();

  if (variant === "full") {
    return (
      <div className={className}>
        <p className="text-sm font-semibold text-foreground mb-1">
          {t("language")}
        </p>
        <p className="text-xs text-muted mb-3">{t("languageDesc")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              language === "en"
                ? "bg-primary text-white"
                : "bg-beige-light text-muted hover:text-foreground"
            )}
            aria-pressed={language === "en"}
          >
            {t("english")}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("zh")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              language === "zh"
                ? "bg-primary text-white"
                : "bg-beige-light text-muted hover:text-foreground"
            )}
            aria-pressed={language === "zh"}
          >
            {t("chinese")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-surface p-1 text-sm font-semibold shadow-sm",
        className
      )}
      role="group"
      aria-label={t("language")}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={cn(
          "rounded-full px-3.5 py-2 min-h-11 transition-colors touch-manipulation",
          language === "en"
            ? "bg-primary text-white"
            : "text-muted hover:text-foreground"
        )}
        aria-pressed={language === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("zh")}
        className={cn(
          "rounded-full px-3.5 py-2 min-h-11 transition-colors touch-manipulation",
          language === "zh"
            ? "bg-primary text-white"
            : "text-muted hover:text-foreground"
        )}
        aria-pressed={language === "zh"}
      >
        中文
      </button>
    </div>
  );
}
