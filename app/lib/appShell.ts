"use client";

import { useEffect, useState } from "react";
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

export function useAppShell(): boolean {
  const [appShell, setAppShell] = useState(false);

  useEffect(() => {
    setAppShell(detectAppShell());
  }, []);

  return appShell;
}
