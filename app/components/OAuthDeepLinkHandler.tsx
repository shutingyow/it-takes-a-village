"use client";

import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { NATIVE_OAUTH_REDIRECT } from "../lib/oauthSignIn";

/**
 * Completes OAuth when iOS opens ittakesavillage://auth/callback?code=…
 * after Apple/Google sign-in in the system browser sheet.
 */
export function OAuthDeepLinkHandler() {
  const { signIn } = useAuthActions();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void App.addListener("appUrlOpen", async ({ url }) => {
      if (cancelled) return;
      if (!url.startsWith(NATIVE_OAUTH_REDIRECT.split("?")[0])) return;

      let code: string | null = null;
      try {
        code = new URL(url).searchParams.get("code");
      } catch {
        const match = /[?&]code=([^&]+)/.exec(url);
        code = match?.[1] ? decodeURIComponent(match[1]) : null;
      }

      try {
        await Browser.close();
      } catch {
        // Browser may already be dismissed.
      }

      if (!code) return;
      try {
        // Provider omitted — Convex Auth exchanges the OAuth `code` like React Native.
        const exchange = signIn as (
          provider: string | undefined,
          params?: { code: string }
        ) => Promise<{ signingIn: boolean }>;
        await exchange(undefined, { code });
      } catch (err) {
        console.error("OAuth deep-link sign-in failed:", err);
      }
    }).then((listener) => {
      if (cancelled) {
        void listener.remove();
        return;
      }
      handle = listener;
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [signIn]);

  return null;
}
