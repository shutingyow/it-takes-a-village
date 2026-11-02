"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { isNativePlatform } from "@/app/lib/deviceNotifications";

/** Native Capacitor app or installed PWA (standalone). */
export function detectAppShell(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativePlatform()) return true;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * Paint beige under the status bar; keep system time/battery visible.
 * Safe to call repeatedly — no-ops on web.
 */
export async function configureNativeChrome(
  resolvedTheme: "light" | "dark" = "light"
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const bg = resolvedTheme === "dark" ? "#1c1a18" : "#faf8f5";
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: bg });
    await StatusBar.setStyle({
      style: resolvedTheme === "dark" ? Style.Light : Style.Dark,
    });
  } catch {
    // Plugin missing or unsupported — ignore.
  }
}

export function useAppShell(): boolean {
  const [appShell, setAppShell] = useState(false);

  useEffect(() => {
    setAppShell(detectAppShell());
    void configureNativeChrome("light");
  }, []);

  return appShell;
}
