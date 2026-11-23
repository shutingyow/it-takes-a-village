"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  APP_STORE_BANNER_DISMISS_KEY,
  APP_STORE_URL,
} from "@/app/lib/appStore";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

/**
 * Soft funnel from the web app toward the iPhone build (reminders / Live Activities).
 * Hidden inside the native shell.
 */
export function GetAppBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    try {
      if (localStorage.getItem(APP_STORE_BANNER_DISMISS_KEY) === "1") return;
    } catch {
      // ignore
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(APP_STORE_BANNER_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const openStore = async () => {
    if (Capacitor.isNativePlatform()) return;
    window.open(APP_STORE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-border bg-primary-light/50 px-3 py-3"
          : "rounded-2xl border border-border bg-primary-light/50 px-4 py-4"
      }
    >
      <p className="text-sm font-semibold text-foreground">
        {t("getAppTitle")}
      </p>
      <p className="text-xs text-muted mt-1 leading-snug">{t("getAppHint")}</p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => void openStore()}
          className="flex-1 rounded-xl bg-primary text-white text-sm font-semibold py-2.5"
        >
          {t("getAppCta")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="px-3 text-xs font-semibold text-muted"
        >
          {t("getAppDismiss")}
        </button>
      </div>
    </div>
  );
}
