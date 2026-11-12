"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  getActiveFeedTimer,
  isFeedTimerRecording,
} from "@/app/lib/feedTimer";

/**
 * Keeps Convex `activeFeedSession` in sync with this device's feed timer so
 * other caregivers' lock-screen timers / banners show "Feed ongoing".
 */
export function useSyncActiveFeedSession(
  secretLink: string,
  actingCaregiverName: string | null | undefined
) {
  const setActive = useMutation(api.feedSessions.setActive);
  const clearActive = useMutation(api.feedSessions.clearActive);
  const wasRecording = useRef(false);

  useEffect(() => {
    if (!actingCaregiverName) return;

    const sync = () => {
      const recording = isFeedTimerRecording(secretLink);
      const timer = getActiveFeedTimer(secretLink);
      if (recording && timer?.feedStartedAt != null) {
        wasRecording.current = true;
        void setActive({
          secretLink,
          actingCaregiverName,
          startedAt: timer.feedStartedAt,
          status: timer.status === "paused" ? "paused" : "running",
        });
        return;
      }
      if (wasRecording.current) {
        wasRecording.current = false;
        void clearActive({ secretLink, actingCaregiverName });
      }
    };

    sync();
    window.addEventListener("feedTimerChanged", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("feedTimerChanged", sync);
      window.removeEventListener("focus", sync);
    };
  }, [secretLink, actingCaregiverName, setActive, clearActive]);
}
