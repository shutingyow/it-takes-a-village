"use client";

import { useEffect, useMemo, useState } from "react";
import { NATIVE_OAUTH_CALLBACK_SCHEME } from "@/app/lib/oauthSignIn";

/**
 * HTTPS landing after Google/Apple OAuth in the Capacitor Browser sheet.
 * Convex redirects here (not straight to ittakesavillage://) because SFSafari
 * often stalls on a blank convex.site page when the final hop is a custom scheme.
 * This page then opens the app via the registered URL scheme.
 */
export default function NativeOAuthReturnPage() {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusText = useMemo(() => {
    if (error) return error;
    if (deepLink) return "Opening the app…";
    return "Finishing sign-in…";
  }, [deepLink, error]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setError(
        "Sign-in did not return a code. Close this sheet and try again in the app."
      );
      return;
    }

    const target = `${NATIVE_OAUTH_CALLBACK_SCHEME}?code=${encodeURIComponent(code)}`;
    setDeepLink(target);

    // Prefer assigning location so iOS hands off to the app and dismisses the sheet.
    window.location.href = target;

    const t = window.setTimeout(() => {
      // Fallback if the first hop was ignored.
      window.location.replace(target);
    }, 400);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6 py-16 font-sans">
      <h1 className="text-lg font-semibold text-foreground">Sign-in</h1>
      <p className="text-sm text-muted">{statusText}</p>
      {deepLink && (
        <a
          href={deepLink}
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-white"
        >
          Tap here if the app doesn’t open
        </a>
      )}
    </main>
  );
}
