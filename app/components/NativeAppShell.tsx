"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { configureNativeChrome } from "@/app/lib/appShell";

const LIVE_ORIGIN = "https://takesavillage.co";

function isAllowedHttpUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname;
    if (
      host === "takesavillage.co" ||
      host === "www.takesavillage.co" ||
      host === "it-takes-a-village.vercel.app"
    ) {
      return true;
    }
    // Convex HTTP/WS are not top-level navigations; keep OAuth off the WebView.
    // Same-origin navigations inside the WebView are fine.
    if (host === window.location.hostname) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Native-only polish for App Review:
 * - Offline overlay when the device loses connectivity
 * - Block unexpected external http(s) navigations (OAuth still uses Browser)
 * - Hide splash once the shell is ready
 */
export function NativeAppShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let removeNetwork: (() => void) | undefined;
    let removeKeyboardShow: (() => void) | undefined;
    let removeKeyboardHide: (() => void) | undefined;

    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return;
      if (
        el.tagName !== "INPUT" &&
        el.tagName !== "TEXTAREA" &&
        !el.isContentEditable
      ) {
        return;
      }
      // Delay so keyboard + WebView resize settle first.
      window.setTimeout(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 80);
    };

    void (async () => {
      await configureNativeChrome("light");

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        if (!cancelled) {
          await SplashScreen.hide({ fadeOutDuration: 280 });
        }
      } catch {
        // ignore
      }

      try {
        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        if (!cancelled) {
          setOffline(!status.connected);
        }
        const handle = await Network.addListener(
          "networkStatusChange",
          (next) => {
            setOffline(!next.connected);
          }
        );
        removeNetwork = () => {
          void handle.remove();
        };
      } catch {
        // Plugin missing — rely on bundled errorPath only.
      }

      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        await Keyboard.setScroll({ isDisabled: false });
        const showHandle = await Keyboard.addListener(
          "keyboardWillShow",
          (info) => {
            document.documentElement.style.setProperty(
              "--keyboard-inset",
              `${Math.max(0, info.keyboardHeight)}px`
            );
            scrollFocusedIntoView();
          }
        );
        const hideHandle = await Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.style.setProperty("--keyboard-inset", "0px");
        });
        removeKeyboardShow = () => {
          void showHandle.remove();
        };
        removeKeyboardHide = () => {
          void hideHandle.remove();
        };
      } catch {
        // Plugin missing — focus scroll still helps on web/PWA.
      }
    })();

    const onFocusIn = () => scrollFocusedIntoView();
    document.addEventListener("focusin", onFocusIn);

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("/")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (href.startsWith("ittakesavillage:")) return;
      if (!/^https?:/i.test(href) && !href.startsWith("//")) return;
      const absolute = new URL(href, window.location.href).toString();
      if (isAllowedHttpUrl(absolute)) return;
      // Unexpected external page — stay in-app.
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", onClickCapture, true);

    return () => {
      cancelled = true;
      removeNetwork?.();
      removeKeyboardShow?.();
      removeKeyboardHide?.();
      document.documentElement.style.setProperty("--keyboard-inset", "0px");
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  const retry = () => {
    try {
      window.location.replace(LIVE_ORIGIN + window.location.pathname);
    } catch {
      window.location.reload();
    }
  };

  return (
    <>
      {children}
      {offline && Capacitor.isNativePlatform() ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6 safe-top"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="offline-title"
          aria-describedby="offline-desc"
        >
          <div className="w-full max-w-sm text-center">
            <div
              className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary-light text-primary text-xl font-semibold"
              aria-hidden
            >
              ···
            </div>
            <h1
              id="offline-title"
              className="text-xl font-bold tracking-tight text-foreground mb-2"
            >
              {t("offlineTitle")}
            </h1>
            <p id="offline-desc" className="text-sm text-muted mb-6 leading-snug">
              {t("offlineBody")}
            </p>
            <button type="button" onClick={retry} className="btn-primary w-full">
              {t("offlineRetry")}
            </button>
            <p className="mt-3 text-xs text-muted">{t("offlineHint")}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
