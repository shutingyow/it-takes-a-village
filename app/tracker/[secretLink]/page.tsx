"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CaregiverLockScreen } from "@/app/components/CaregiverLockScreen";
import { LockedCaregiverBadge } from "@/app/components/LockedCaregiverBadge";
import { HomeTab } from "@/app/components/tabs/HomeTab";
import { InsightsTab } from "@/app/components/tabs/InsightsTab";
import {
  ProfileTab,
  type ProfileView,
} from "@/app/components/tabs/ProfileTab";
import { SettingsTab } from "@/app/components/tabs/SettingsTab";
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
import { SleepModal } from "@/app/components/modals/SleepModal";
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
import { FeedTimerBanner } from "@/app/components/FeedTimerBanner";
import { SleepTimerBanner } from "@/app/components/SleepTimerBanner";
import { useSyncActiveFeedSession } from "@/app/lib/useSyncActiveFeedSession";
import { useAppShell } from "@/app/lib/appShell";

type LogType = "feed" | "diaper" | "pump" | "activity" | "nap" | "moment";

export default function TrackerPage({
  params,
}: {
  params: Promise<{ secretLink: string }>;
}) {
  const { secretLink } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const appShell = useAppShell();
  const { isAuthenticated } = useConvexAuth();
  const [activeTab, setActiveTab] = useState<TrackerTab>("home");
  const [profileOpenView, setProfileOpenView] = useState<ProfileView | null>(
    null
  );
  const mainRef = useRef<HTMLElement>(null);
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
  useSyncActiveFeedSession(secretLink, lockedCaregiver);
  const tracker = useQuery(api.trackers.getBySecret, { secretLink });
  const myVillages = useQuery(
    api.trackers.listMine,
    isAuthenticated ? {} : "skip"
  );
  const lastFeed = useQuery(
    api.feedEntries.getLast,
    tracker && lockedCaregiver
      ? { secretLink, actingCaregiverName: lockedCaregiver }
      : "skip"
  );
  const lastDiaper = useQuery(
    api.diaperEntries.getLast,
    tracker && lockedCaregiver
      ? { secretLink, actingCaregiverName: lockedCaregiver }
      : "skip"
  );
  const activeAlerts = useQuery(
    api.supplyAlerts.getActive,
    tracker && lockedCaregiver
      ? { secretLink, actingCaregiverName: lockedCaregiver }
      : "skip"
  );

  useEffect(() => {
    void ensureMigrated({ secretLink });
  }, [secretLink, ensureMigrated]);

  useEffect(() => {
    // Don't pin a foreign village as "last visited" for signed-in parents who
    // already own a village — that recreates the Who-are-you loop after launch.
    // Caregivers (signed-in or not) with no owned villages should keep the pin
    // so home can show “Open {baby}” like the admin path.
    if (!tracker) return;
    if (
      isAuthenticated &&
      !tracker.viewerIsOwner &&
      tracker.ownerUserId !== undefined &&
      myVillages !== undefined &&
      myVillages.length > 0
    ) {
      return;
    }
    // Wait until we know whether they own villages before deciding.
    if (
      isAuthenticated &&
      !tracker.viewerIsOwner &&
      tracker.ownerUserId !== undefined &&
      myVillages === undefined
    ) {
      return;
    }
    saveLastVisitedTracker(secretLink, tracker.babyName);
  }, [secretLink, tracker, isAuthenticated, myVillages]);

  useEffect(() => {
    setHydrated(false);
  }, [secretLink]);

  useEffect(() => {
    // Still waiting for Convex — keep loading spinner.
    if (tracker === undefined) return;
    // Missing / invalid secret: mark hydrated so "not found" can render.
    // Depend on `tracker` itself — `tracker?._id` stays undefined for both
    // undefined and null, so the effect would never re-run on "not found".
    if (tracker === null) {
      setLockedCaregiver(null);
      setNeedsPick(false);
      setHydrated(true);
      return;
    }
    const saved = getLockedCaregiver(secretLink);
    const selectable = tracker.viewerIsOwner
      ? tracker.caregivers
      : tracker.caregivers.filter((c) => c.role !== "admin");
    const validNames = selectable.map((c) => c.name);
    // Owner with a single name: skip the pick screen.
    if (
      tracker.viewerIsOwner &&
      selectable.length === 1 &&
      selectable[0]
    ) {
      const only = selectable[0].name;
      setLockedCaregiver(only);
      saveLockedCaregiver(secretLink, only);
      setNeedsPick(false);
      setHydrated(true);
      return;
    }
    if (saved && validNames.includes(saved)) {
      setLockedCaregiver(saved);
      setNeedsPick(false);
    } else {
      if (saved) clearLockedCaregiver(secretLink);
      setLockedCaregiver(null);
      setNeedsPick(true);
    }
    setHydrated(true);
  }, [secretLink, tracker]);

  useEffect(() => {
    if (activeTab !== "profile") setProfileOpenView(null);
  }, [activeTab]);

  // Always land at the top when switching tabs (shared scroll container).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

  // Signed in on someone else's link → go to your village (or home if several).
  // Caregivers with no owned villages stay on the shared link.
  useEffect(() => {
    if (!isAuthenticated || !tracker || tracker.viewerIsOwner) return;
    if (tracker.ownerUserId === undefined) return; // claimable — stay
    if (myVillages === undefined) return; // still loading
    if (myVillages.length === 0) return;
    const mine =
      myVillages.find((v) => v.secretLink === secretLink) ?? myVillages[0]!;
    if (mine.secretLink === secretLink) return;
    router.replace(`/tracker/${mine.secretLink}`);
  }, [isAuthenticated, tracker, myVillages, secretLink, router]);

  const handleViewAllHistory = () => {
    setProfileOpenView("history");
    setActiveTab("profile");
  };

  const handleOpenMilestones = () => {
    setProfileOpenView("milestones");
    setActiveTab("profile");
  };

  const handleOpenSettings = () => {
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
    const ownedVillagesLoading = isAuthenticated && myVillages === undefined;
    const ownedVillages =
      myVillages
        ?.filter((v) => v.secretLink !== secretLink)
        .map((v) => ({
          secretLink: v.secretLink,
          babyName: v.babyName,
        })) ?? [];

    return (
      <div className="min-h-screen flex flex-col bg-background safe-top">
        <CaregiverLockScreen
          caregivers={tracker.caregivers}
          viewerIsOwner={tracker.viewerIsOwner}
          canClaim={canClaim}
          claiming={claiming}
          claimError={claimError}
          onClaim={() => void handleClaimVillage()}
          onConfirm={handleConfirmCaregiver}
          ownedVillages={ownedVillages}
          ownedVillagesLoading={ownedVillagesLoading}
          onOpenOwnedVillage={(link) => router.replace(`/tracker/${link}`)}
        />
      </div>
    );
  }

  return (
    <div className="relative h-dvh max-h-dvh flex flex-col tracker-shell app-shell overflow-hidden safe-top bg-background">
      {/* Brand line only in browser tabs — native/PWA already has the app name */}
      {!appShell && (
        <header className="px-4 pt-1 pb-0.5 shrink-0">
          <p className="text-[11px] font-medium text-muted/80 tracking-tight truncate">
            {t("appName")}
          </p>
        </header>
      )}

      {claimBanner}

      {activeTab !== "home" && (
        <header className="px-4 pt-1.5 pb-2 shrink-0">
          <h1 className="text-[1.5rem] font-bold text-foreground tracking-tight truncate leading-tight">
            {activeTab === "today" && t("tabToday")}
            {activeTab === "weekly" && t("tabWeekly")}
            {activeTab === "profile" && t("tabProfile")}
            {activeTab === "settings" && t("tabSettings")}
          </h1>
        </header>
      )}

      <LockedCaregiverBadge
        caregiver={lockedInfo}
        onOpenSettings={handleOpenSettings}
      />

      {activeAlerts && activeAlerts.length > 0 && (
        <SupplyAlertsBanner
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          alerts={activeAlerts}
        />
      )}

      <main
        ref={mainRef}
        className="flex-1 min-h-0 min-w-0 overflow-x-clip overflow-y-auto overscroll-y-contain pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
      >
        {activeTab === "home" && (
          <HomeTab
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            babyName={tracker.babyName}
            birthDate={tracker.birthDate}
            photoStorageId={tracker.photoStorageId}
            timezone={tracker.timezone}
            lastFeed={lastFeed}
            lastDiaper={lastDiaper}
            pumpScheduleEnabled={tracker.pumpSchedule?.enabled}
            onViewAllHistory={handleViewAllHistory}
            onOpenMilestones={handleOpenMilestones}
            onOpenSettings={handleOpenSettings}
            onQuickLog={handleQuickLog}
          />
        )}
        <ReminderScheduler
          selectedCaregiver={lockedCaregiver}
          secretLink={secretLink}
          feedIntervalHours={tracker.feedIntervalHours}
          notifyBeforeMinutes={tracker.notifyBeforeMinutes}
          feedRemindersEnabled={tracker.feedRemindersEnabled}
          wakeWindowMinutes={tracker.wakeWindowMinutes}
          napRemindersEnabled={tracker.napRemindersEnabled}
          pumpSchedule={tracker.pumpSchedule}
        />
        {activeTab === "today" && (
          <InsightsTab
            babyName={tracker.babyName}
            birthDate={tracker.birthDate}
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            timezone={tracker.timezone}
            canEditBirthDate={tracker.viewerIsOwner}
            range="daily"
          />
        )}
        {activeTab === "weekly" && (
          <InsightsTab
            babyName={tracker.babyName}
            birthDate={tracker.birthDate}
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            timezone={tracker.timezone}
            canEditBirthDate={tracker.viewerIsOwner}
            range="weekly"
          />
        )}
        {activeTab === "profile" && (
          <ProfileTab
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            openView={profileOpenView}
            birthDate={tracker.birthDate}
            sex={tracker.sex}
            viewerIsOwner={tracker.viewerIsOwner}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            secretLink={secretLink}
            selectedCaregiver={lockedCaregiver}
            caregivers={tracker.caregivers}
            babyName={tracker.babyName}
            timezone={tracker.timezone}
            feedIntervalHours={tracker.feedIntervalHours}
            nightFeedIntervalEnabled={tracker.nightFeedIntervalEnabled}
            nightFeedIntervalHours={tracker.nightFeedIntervalHours}
            nightFeedWindowStart={tracker.nightFeedWindowStart}
            nightFeedWindowEnd={tracker.nightFeedWindowEnd}
            notifyBeforeMinutes={tracker.notifyBeforeMinutes}
            feedRemindersEnabled={tracker.feedRemindersEnabled}
            wakeWindowMinutes={tracker.wakeWindowMinutes}
            napRemindersEnabled={tracker.napRemindersEnabled}
            pumpSchedule={tracker.pumpSchedule}
            viewerIsOwner={tracker.viewerIsOwner}
            onScrollToTop={() =>
              mainRef.current?.scrollTo({ top: 0, behavior: "auto" })
            }
          />
        )}
      </main>

      <TrackerBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogPress={() => setShowLogSheet(true)}
      />

      <FeedTimerBanner
        secretLink={secretLink}
        hidden={activeLogModal === "feed"}
        onOpen={() => {
          setShowLogSheet(false);
          setActiveLogModal("feed");
        }}
      />
      {lockedCaregiver && (
        <SleepTimerBanner
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          hidden={activeLogModal === "nap"}
          onOpen={() => {
            setShowLogSheet(false);
            setActiveLogModal("nap");
          }}
        />
      )}

      {showLogSheet && (
        <LogSheet
          onSelect={handleLogSelect}
          onClose={() => setShowLogSheet(false)}
          showPump={!!tracker.pumpSchedule?.enabled}
        />
      )}

      {activeLogModal === "feed" && (
        <FeedModal
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          birthDate={tracker.birthDate}
          onClose={() => setActiveLogModal(null)}
        />
      )}
      {activeLogModal === "diaper" && (
        <DiaperModal
          secretLink={secretLink}
          selectedCaregiver={lockedCaregiver}
          onClose={() => setActiveLogModal(null)}
        />
      )}
      {activeLogModal === "pump" && (
        <PumpModal
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
        <SleepModal
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
