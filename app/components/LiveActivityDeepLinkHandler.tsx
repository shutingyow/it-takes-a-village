"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { getLastVisitedTracker } from "@/app/lib/trackerStorage";
import {
  parseLogDeepLink,
  type LogDeepLinkPath,
} from "@/app/lib/liveActivityDeepLink";
import { NATIVE_OAUTH_CALLBACK_SCHEME } from "@/app/lib/oauthSignIn";

/**
 * When a Live Activity / Dynamic Island is tapped, ActivityKit opens
 * `ittakesavillage://log/{feed|pump|sleep}`. Route to the last-visited
 * tracker and open the matching log modal via `?log=`.
 */
export function LiveActivityDeepLinkHandler() {
  const router = useRouter();
  const handledLaunch = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;

    const openLog = (path: LogDeepLinkPath) => {
      const last = getLastVisitedTracker();
      if (!last?.secretLink) {
        console.warn(
          "Live Activity deep link: no last-visited tracker; open a village first"
        );
        return;
      }
      router.push(`/tracker/${last.secretLink}?log=${path}`);
    };

    const onUrl = (url: string) => {
      if (cancelled) return;
      // OAuthDeepLinkHandler owns auth callbacks.
      if (url.startsWith(NATIVE_OAUTH_CALLBACK_SCHEME)) return;
      const path = parseLogDeepLink(url);
      if (!path) return;
      openLog(path);
    };

    void App.addListener("appUrlOpen", ({ url }) => {
      onUrl(url);
    }).then((listener) => {
      if (cancelled) {
        void listener.remove();
        return;
      }
      handle = listener;
    });

    // Cold start: URL that launched the app may not re-fire as appUrlOpen.
    if (!handledLaunch.current) {
      handledLaunch.current = true;
      void App.getLaunchUrl()
        .then((result) => {
          if (cancelled || !result?.url) return;
          onUrl(result.url);
        })
        .catch(() => {
          // Plugin may be unavailable in odd shells.
        });
    }

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [router]);

  return null;
}
