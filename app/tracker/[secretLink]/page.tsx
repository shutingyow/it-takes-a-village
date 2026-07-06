"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { use, useState } from "react";
import { CaregiverSelector } from "@/app/components/CaregiverSelector";
import { StatusStrip } from "@/app/components/StatusStrip";
import { HomeTab } from "@/app/components/tabs/HomeTab";
import { LogTab } from "@/app/components/tabs/LogTab";
import { HealthTab } from "@/app/components/tabs/HealthTab";
import { NotesTab } from "@/app/components/tabs/NotesTab";
import { UpcomingTab } from "@/app/components/tabs/UpcomingTab";
import { HistoryTab } from "@/app/components/tabs/HistoryTab";
import { SupplyAlertsBanner } from "@/app/components/SupplyAlertsBanner";

type Tab = "home" | "log" | "health" | "notes" | "upcoming" | "history";

export default function TrackerPage({
  params,
}: {
  params: Promise<{ secretLink: string }>;
}) {
  const { secretLink } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedCaregiver, setSelectedCaregiver] = useState("");

  const tracker = useQuery(api.trackers.getBySecret, { secretLink });
  const lastFeed = useQuery(
    api.feedEntries.getLast,
    tracker ? { trackerId: tracker._id } : "skip"
  );
  const lastDiaper = useQuery(
    api.diaperEntries.getLast,
    tracker ? { trackerId: tracker._id } : "skip"
  );
  const lastPump = useQuery(
    api.pumpEntries.getLast,
    tracker ? { trackerId: tracker._id } : "skip"
  );
  const activeSleep = useQuery(
    api.sleepEntries.getActive,
    tracker ? { trackerId: tracker._id } : "skip"
  );
  const lastCompletedSleep = useQuery(
    api.sleepEntries.getLast,
    tracker ? { trackerId: tracker._id } : "skip"
  );
  const activeAlerts = useQuery(
    api.supplyAlerts.getActive,
    tracker ? { trackerId: tracker._id } : "skip"
  );

  if (tracker === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (tracker === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Tracker Not Found
          </h1>
          <p className="text-gray-600">This tracker link is invalid.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "home", label: "Home", emoji: "🏠" },
    { id: "log", label: "Log", emoji: "📝" },
    { id: "health", label: "Health", emoji: "🏥" },
    { id: "notes", label: "Notes", emoji: "📋" },
    { id: "upcoming", label: "Upcoming", emoji: "📅" },
    { id: "history", label: "History", emoji: "🕐" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-blue-500 text-white">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold">👶 Baby Tracker</h1>
        </div>
      </div>

      {/* Caregiver Selector */}
      <CaregiverSelector
        caregivers={tracker.caregiverNames}
        value={selectedCaregiver}
        onChange={setSelectedCaregiver}
      />

      {/* Supply Alerts */}
      {activeAlerts && (
        <SupplyAlertsBanner
          trackerId={tracker._id}
          selectedCaregiver={selectedCaregiver}
          alerts={activeAlerts}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "home" && (
          <div>
            <StatusStrip
              lastFeed={lastFeed ?? undefined}
              lastDiaper={lastDiaper ?? undefined}
              lastPump={lastPump ?? undefined}
              activeSleep={activeSleep ?? undefined}
              lastCompletedSleep={
                lastCompletedSleep?.endTime
                  ? {
                      startTime: lastCompletedSleep.startTime,
                      endTime: lastCompletedSleep.endTime,
                      caregiverName: lastCompletedSleep.caregiverName,
                    }
                  : undefined
              }
            />
            <HomeTab
              trackerId={tracker._id}
              selectedCaregiver={selectedCaregiver}
            />
          </div>
        )}
        {activeTab === "log" && (
          <LogTab trackerId={tracker._id} selectedCaregiver={selectedCaregiver} />
        )}
        {activeTab === "health" && (
          <HealthTab trackerId={tracker._id} selectedCaregiver={selectedCaregiver} />
        )}
        {activeTab === "notes" && (
          <NotesTab trackerId={tracker._id} selectedCaregiver={selectedCaregiver} />
        )}
        {activeTab === "upcoming" && (
          <UpcomingTab trackerId={tracker._id} selectedCaregiver={selectedCaregiver} />
        )}
        {activeTab === "history" && <HistoryTab trackerId={tracker._id} />}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-center ${
              activeTab === tab.id
                ? "bg-blue-50 text-blue-600 border-t-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            <div className="text-lg">{tab.emoji}</div>
            <div className="text-xs mt-1">{tab.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
