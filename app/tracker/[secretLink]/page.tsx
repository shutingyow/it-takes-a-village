"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { use, useEffect, useState } from "react";
import { CaregiverLockScreen } from "@/app/components/CaregiverLockScreen";
import { LockedCaregiverBadge } from "@/app/components/LockedCaregiverBadge";
import { HomeTab } from "@/app/components/tabs/HomeTab";
import { InsightsTab } from "@/app/components/tabs/InsightsTab";
import {
  ProfileTab,
  type ProfileView,
} from "@/app/components/tabs/ProfileTab";
import {
  SettingsTab,
  type SettingsView,
} from "@/app/components/tabs/SettingsTab";
import { SupplyAlertsBanner } from "@/app/components/SupplyAlertsBanner";
import { LogSheet } from "@/app/components/LogSheet";
import {
  TrackerBottomNav,
  type TrackerTab,
} from "@/app/components/TrackerBottomNav";
import { FeedModal } from "@/app/components/modals/FeedModal";
import { DiaperModal } from "@/app/components/modals/DiaperModal";
import { PumpModal } from "@/app/components/modals/PumpModal";
import { ActivityModal } from "@/app/components/modals/ActivityModal";
import { NapModal } from "@/app/components/modals/NapModal";
import { MomentModal } from "@/app/components/modals/MomentModal";
import { IconLink } from "@/app/components/icons";
import {
  clearLockedCaregiver,
  getLockedCaregiver,
  setLockedCaregiver as saveLockedCaregiver,
  type CaregiverInfo,
} from "@/app/lib/trackerStorage";
import { saveLastVisitedTracker } from "@/app/lib/trackerStorage";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { ReminderScheduler } from "@/app/components/ReminderScheduler";
import { useAppShell } from "@/app/lib/appShell";
import { cn } from "@/app/lib/utils";

type LogType = "feed" | "diaper" | "pump" | "activity" | "nap" | "moment";

export default function TrackerPage({
  params,
}: {
  params: Promise<{ secretLink: string }>;
}) {
  const { secretLink } = use(params);
  const { t } = useLanguage();
  const appShell = useAppShell();
  const { isAuthenticated } = useConvexAuth();
  const [activeTab, setActiveTab] = useState<TrackerTab>("today");
  const [profileOpenView, setProfileOpenView] = useState<ProfileView | null>(
    null
  );
  const [settingsOpenView, setSettingsOpenView] =
    useState<SettingsView | null>(null);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [activeLogModal, setActiveLogModal] = useState<LogType | null>(null);
  const [lockedCaregiver, setLockedCaregiver] = useState<string | null>(null);
  const [needsPick, setNeedsPick] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const ensureMigrated = useMutation(api.trackers.ensureMigrated);
  const claimTracker = useMutation(api.trackers.claim);
  const tracker = useQuery(api.trackers.getBySecret, { secretLink });
  const lastFeed = useQuery(
    api.feedEntries.getLast,
    tracker ? { trackerId: tracker._id } : "skip"
  );
  const lastDiaper = useQuery(
    api.diaperEntries.getLast,
    tracker ? { trackerId: tracker._id } : "skip"
  );
  const activeAlerts = useQuery(
    api.supplyAlerts.getActive,
    tracker ? { trackerId: tracker._id } : "skip"
  );

  useEffect(() => {
    void ensureMigrated({ secretLink });
  }, [secretLink, ensureMigrated]);

  useEffect(() => {
    if (tracker) {
      saveLastVisitedTracker(secretLink, tracker.babyName);
    }
  }, [secretLink, tracker?.babyName, tracker?._id]);

  useEffect(() => {
    if (!tracker) return;
    const saved = getLockedCaregiver(secretLink);
    const validNames = tracker.caregivers.map((c) => c.name);
    if (saved && validNames.includes(saved)) {
      setLockedCaregiver(saved);
      setNeedsPick(false);
    } else {
      setLockedCaregiver(null);
      setNeedsPick(true);
    }
    setHydrated(true);
  }, [secretLink, tracker?._id, tracker?.caregivers]);

  useEffect(() => {
    if (activeTab !== "profile") setProfileOpenView(null);
    if (activeTab !== "settings") setSettingsOpenView(null);
  }, [activeTab]);

  const handleViewAllHistory = () => {
    setProfileOpenView("history");
    setActiveTab("profile");
  };

  const handleOpenReminders = () => {
    setSettingsOpenView("reminders");
    setActiveTab("settings");
  };

  const handleQuickLog = (type: LogType) => {
    setActiveLogModal(type);
  };

  const handleConfirmCaregiver = (name: string) => {
    setLockedCaregiver(name);
    saveLockedCaregiver(secretLink, name);
    setNeedsPick(false);
  };

  const handleSwitchCaregiver = () => {
    clearLockedCaregiver(secretLink);
    setLockedCaregiver(null);
    setNeedsPick(true);
  };

  const handleClaimVillage = async () => {
    setClaiming(true);
    setClaimError(null);
    setClaimMessage(null);
    try {
      await claimTracker({ secretLink });
      setClaimMessage(t("claimVillageDone"));
    } catch (err) {
      setClaimError(
        err instanceof Error ? err.message : "Failed to add village"
      );
    } finally {
      setClaiming(false);
    }
  };

  const canClaim =
    isAuthenticated && tracker != null && tracker.ownerUserId === undefined;

  const handleLogSelect = (type: LogType) => {
    setShowLogSheet(false);
    setActiveLogModal(type);
  };

  const handleTabChange = (tab: TrackerTab) => {
    if (tab === "log") {
      setShowLogSheet(true);
      return;
    }
    setActiveTab(tab);
  };

  const lockedInfo: CaregiverInfo | undefined = tracker?.caregivers.find(
    (c) => c.name === lockedCaregiver
  );

  if (tracker === undefined || !hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-diaper border-t-transparent animate-spin" />
          <p className="text-muted text-sm">{t("loadingTracker")}</p>
        </div>
      </div>
    );
  }

  if (tracker === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center bg-surface rounded-2xl p-8 card-shadow max-w-sm border border-border">
          <div className="w-12 h-12 rounded-xl bg-beige-light flex items-center justify-center mx-auto mb-4 text-accent-diaper">
            <IconLink size={24} />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {t("trackerNotFound")}
          </h1>
          <p className="text-muted text-sm">{t("invalidLink")}</p>
        </div>
      </div>
    );
  }

  const claimBanner =
    canClaim && !claimMessage ? (
      <div className="mx-4 mt-2 mb-1 rounded-xl border border-border bg-surface px-4 py-3 space-y-2 card-shadow shrink-0">
        <p className="text-sm text-foreground">{t("claimVillageHint")}</p>
        {claimError && (
          <p className="text-sm text-red-600" role="alert">
            {claimError}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleClaimVillage()}
          disabled={claiming}
          className="btn-primary w-full"
        >
          {claiming ? t("claimingVillage") : t("claimVillage")}
        </button>
      </div>
    ) : claimMessage ? (
      <div className="mx-4 mt-2 mb-1 rounded-xl border border-border bg-primary-light/40 px-4 py-2 shrink-0">
        <p className="text-sm text-foreground font-medium">{claimMessage}</p>
      </div>
    ) : null;

  if (needsPick || !lockedCaregiver || !lockedInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-background safe-top">
        {claimBanner}
        <CaregiverLockScreen
          caregivers={tracker.caregivers}
          onConfirm={handleConfirmCaregiver}
        />
      </div>
    );
  }

  return (
    <div className="relative h-dvh max-h-dvh flex flex-col tracker-shell app-shell overflow-hidden safe-top">
      {/* Brand line only in browser tabs — native/PWA already has the app name */}
      {!appShell && (
        <header className="px-4 pt-1 pb-0.5 shrink-0">
          <p className="text-[11px] font-medium text-muted/80 tracking-tight truncate">
            {t("appName")}
          </p>
        </header>
      )}

      {claimBanner}

      {activeTab !== "today" && (
        <header className="px-4 pt-1.5 pb-2 shrink-0">
          <h1 className="text-[1.5rem] font-bold text-foreground tracking-tight truncate leading-tight">
            {activeTab === "insights" && t("tabInsights")}
            {activeTab === "profile" && t("tabProfile")}
            {activeTab === "settings" && t("tabSettings")}
          </h1>
        </header>
      )}

      <LockedCaregiverBadge
        caregiver={lockedInfo}
        onSwitch={handleSwitchCaregiver}
      />

      {activeAlerts && activeAlerts.length > 0 && (
        <SupplyAlertsBanner
          trackerId={tracker._id}
          selectedCaregiver={lockedCaregiver}
          alerts={activeAlerts}
        />
      )}

      <main className="flex-1 min-h-0 min-w-0 overflow-x-clip overflow-y-auto overscroll-y-contain pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]">
        {activeTab === "today" && (
          <HomeTab
            trackerId={tracker._id}
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            babyName={tracker.babyName}
            birthDate={tracker.birthDate}
            photoStorageId={tracker.photoStorageId}
            lastFeed={lastFeed}
            lastDiaper={lastDiaper}
            pumpScheduleEnabled={tracker.pumpSchedule?.enabled}
            onViewAllHistory={handleViewAllHistory}
            onQuickLog={handleQuickLog}
            onOpenReminders={handleOpenReminders}
          />
        )}
        <ReminderScheduler
          trackerId={tracker._id}
          secretLink={secretLink}
          feedIntervalHours={tracker.feedIntervalHours}
          notifyBeforeMinutes={tracker.notifyBeforeMinutes}
          wakeWindowMinutes={tracker.wakeWindowMinutes}
          pumpSchedule={tracker.pumpSchedule}
        />
        {activeTab === "insights" && (
          <InsightsTab
            trackerId={tracker._id}
            babyName={tracker.babyName}
            birthDate={tracker.birthDate}
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
          />
        )}
        {activeTab === "profile" && (
          <ProfileTab
            trackerId={tracker._id}
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            openView={profileOpenView}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            trackerId={tracker._id}
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            caregivers={tracker.caregivers}
            babyName={tracker.babyName}
            birthDate={tracker.birthDate}
            feedIntervalHours={tracker.feedIntervalHours}
            notifyBeforeMinutes={tracker.notifyBeforeMinutes}
            wakeWindowMinutes={tracker.wakeWindowMinutes}
            medicationReminders={tracker.medicationReminders}
            pumpSchedule={tracker.pumpSchedule}
            openView={settingsOpenView}
          />
        )}
      </main>

      <TrackerBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogPress={() => setShowLogSheet(true)}
      />

      {showLogSheet && (
        <LogSheet onSelect={handleLogSelect} onClose={() => setShowLogSheet(false)} />
      )}

      {activeLogModal === "feed" && (
        <FeedModal
          trackerId={tracker._id}
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          onClose={() => setActiveLogModal(null)}
        />
      )}
      {activeLogModal === "diaper" && (
        <DiaperModal
          trackerId={tracker._id}
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          onClose={() => setActiveLogModal(null)}
        />
      )}
      {activeLogModal === "pump" && (
        <PumpModal
          trackerId={tracker._id}
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          onClose={() => setActiveLogModal(null)}
        />
      )}
      {activeLogModal === "activity" && (
        <ActivityModal
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          onClose={() => setActiveLogModal(null)}
        />
      )}
      {activeLogModal === "nap" && (
        <NapModal
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          onClose={() => setActiveLogModal(null)}
        />
      )}
      {activeLogModal === "moment" && (
        <MomentModal
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          onClose={() => setActiveLogModal(null)}
        />
      )}
    </div>
  );
}
