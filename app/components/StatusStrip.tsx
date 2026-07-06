"use client";

import { formatTimeAgo, formatDuration } from "../lib/utils";
import { useEffect, useState } from "react";

interface StatusStripProps {
  lastFeed?: {
    type: "breast" | "bottle";
    amount?: number;
    side?: "left" | "right";
    timestamp: number;
    caregiverName: string;
  } | null;
  lastDiaper?: {
    type: "wet" | "dirty" | "both";
    timestamp: number;
    caregiverName: string;
  } | null;
  lastPump?: {
    amount: number;
    timestamp: number;
    caregiverName: string;
  } | null;
  activeSleep?: {
    startTime: number;
    caregiverName: string;
  } | null;
  lastCompletedSleep?: {
    startTime: number;
    endTime: number;
    caregiverName: string;
  } | null;
}

export function StatusStrip({
  lastFeed,
  lastDiaper,
  lastPump,
  activeSleep,
  lastCompletedSleep,
}: StatusStripProps) {
  const [now, setNow] = useState(Date.now());

  // Update every minute for live timers
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const isAwake = !activeSleep;
  const awakeTime = isAwake && lastCompletedSleep 
    ? now - lastCompletedSleep.endTime 
    : 0;

  return (
    <div className="bg-white border-b">
      <div className="px-4 py-3 bg-green-50 border-b border-green-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-green-700 uppercase">
            🟢 Live Status
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Sleep/Awake Status */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              {activeSleep ? "💤 Currently: SLEEPING" : "☀️ Currently: AWAKE"}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {activeSleep ? (
              <>For: {formatDuration(activeSleep.startTime)}</>
            ) : awakeTime > 0 ? (
              <>For: {formatDuration(now - awakeTime)}</>
            ) : (
              <>Status: Unknown</>
            )}
          </div>
        </div>

        {/* Last Feed */}
        {lastFeed && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                🍼 Last Feed: {formatTimeAgo(lastFeed.timestamp)}
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {lastFeed.type === "breast" ? (
                <>
                  Breast{lastFeed.side ? ` (${lastFeed.side})` : ""}
                </>
              ) : (
                <>Bottle • {lastFeed.amount}ml</>
              )}{" "}
              • by {lastFeed.caregiverName}
            </div>
          </div>
        )}

        {/* Last Diaper */}
        {lastDiaper && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                💩 Last Diaper: {formatTimeAgo(lastDiaper.timestamp)}
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {lastDiaper.type === "wet"
                ? "Wet"
                : lastDiaper.type === "dirty"
                ? "Dirty"
                : "Wet + Dirty"}{" "}
              • by {lastDiaper.caregiverName}
            </div>
          </div>
        )}

        {/* Last Pump */}
        {lastPump && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                🤱 Last Pump: {formatTimeAgo(lastPump.timestamp)}
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {lastPump.amount}ml • by {lastPump.caregiverName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
