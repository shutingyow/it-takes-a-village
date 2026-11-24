"use client";

import { useEffect } from "react";

/**
 * Cold-start gate. The native splash stays up until a screen reports that
 * auth + redirect are decided (see NativeAppShell). Module state survives
 * client-side navigations, so this fires once per launch.
 */
let ready = false;
const waiters = new Set<() => void>();

export function markAppReady(): void {
  if (ready) return;
  ready = true;
  waiters.forEach((fn) => fn());
  waiters.clear();
}

/** Resolves when a screen is ready, or after `timeoutMs` as a failsafe. */
export function whenAppReady(timeoutMs: number): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      waiters.delete(done);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    waiters.add(done);
  });
}

/** Call from a screen once it renders its final UI (not a loading gate). */
export function useMarkAppReady(isReady: boolean): void {
  useEffect(() => {
    if (isReady) markAppReady();
  }, [isReady]);
}
