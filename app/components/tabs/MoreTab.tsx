"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { HistoryTab } from "./HistoryTab";
import { HealthTab } from "./HealthTab";
import { SupplyAlertModal } from "../modals/SupplyAlertModal";
import { ReminderSettingsView } from "../ReminderSettingsView";
import { StatsView } from "../StatsView";
import { ExportView } from "../ExportView";
import { GrowthView } from "../GrowthView";
import { MilestonesView } from "../MilestonesView";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  IconChevronRight,
  IconExport,
  IconGrowth,
  IconHealth,
  IconHistory,
  IconMilestone,
  IconReminders,
  IconStats,
  IconUsers,
  IconWarning,
} from "../icons";
import {
  isAdminCaregiver,
  type CaregiverInfo,
} from "@/app/lib/trackerStorage";

type MoreView =
  | "menu"
  | "history"
  | "health"
  | "caregivers"
  | "reminders"
  | "stats"
  | "export"
  | "growth"
  | "milestones";

export type { MoreView };

interface MoreTabProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  caregivers: CaregiverInfo[];
  babyName?: string;
  feedIntervalHours?: number;
  nightFeedIntervalEnabled?: boolean;
  nightFeedIntervalHours?: number;
  nightFeedWindowStart?: string;
  nightFeedWindowEnd?: string;
  notifyBeforeMinutes?: number;
  wakeWindowMinutes?: number;
  medicationReminders?: Array<{
    name: string;
    intervalHours: number;
    lastLoggedAt?: number;
  }>;
  pumpSchedule?: {
    enabled: boolean;
    times: string[];
    amountMl?: number;
    timezone?: string;
    mode?: "fixed" | "interval";
    intervalHours?: number;
  };
  openView?: MoreView | null;
}

export function MoreTab({
  trackerId,
  secretLink,
  selectedCaregiver,
  caregivers,
  babyName,
  feedIntervalHours,
  nightFeedIntervalEnabled,
  nightFeedIntervalHours,
  nightFeedWindowStart,
  nightFeedWindowEnd,
  notifyBeforeMinutes,
  wakeWindowMinutes,
  medicationReminders,
  pumpSchedule,
  openView,
}: MoreTabProps) {
  const { t, language, setLanguage } = useLanguage();
  const [view, setView] = useState<MoreView>("menu");
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [newCaregiverName, setNewCaregiverName] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const activeAlerts = useQuery(api.supplyAlerts.getActive, { trackerId });
  const addCaregiver = useMutation(api.trackers.addCaregiver);
  const removeCaregiver = useMutation(api.trackers.removeCaregiver);

  const isAdmin = isAdminCaregiver(caregivers, selectedCaregiver);
  const adminCount = caregivers.filter((c) => c.role === "admin").length;

  useEffect(() => {
    if (openView) {
      setView(openView);
    }
  }, [openView]);

  const menuItems: {
    id: MoreView | "supply";
    icon: React.ReactNode;
    label: string;
    description: string;
    adminOnly?: boolean;
  }[] = [
    {
      id: "stats",
      icon: <IconStats size={20} className="text-primary" />,
      label: t("stats"),
      description: t("statsDesc"),
    },
    {
      id: "export",
      icon: <IconExport size={20} className="text-primary" />,
      label: t("exportData"),
      description: t("exportDesc"),
    },
    {
      id: "growth",
      icon: <IconGrowth size={20} className="text-primary" />,
      label: t("growth"),
      description: t("growthDesc"),
    },
    {
      id: "milestones",
      icon: <IconMilestone size={20} className="text-primary" />,
      label: t("milestones"),
      description: t("milestonesDesc"),
    },
    {
      id: "history",
      icon: <IconHistory size={20} className="text-primary" />,
      label: t("history"),
      description: t("historyDesc"),
    },
    {
      id: "health",
      icon: <IconHealth size={20} className="text-secondary" />,
      label: t("health"),
      description: t("healthDesc"),
    },
    {
      id: "supply",
      icon: <IconWarning size={20} className="text-warning" />,
      label: t("supplyAlerts"),
      description: t("supplyAlertsDesc"),
    },
    {
      id: "reminders",
      icon: <IconReminders size={20} />,
      label: t("reminderSettings"),
      description: t("reminderSettingsDesc"),
    },
    {
      id: "caregivers",
      icon: <IconUsers size={20} className="text-primary" />,
      label: t("manageCaregivers"),
      description: t("manageCaregiversDesc"),
      adminOnly: true,
    },
  ];

  const handleAddCaregiver = async () => {
    setAdminError(null);
    setAdminMessage(null);
    try {
      await addCaregiver({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        name: newCaregiverName,
      });
      setNewCaregiverName("");
      setAdminMessage(t("caregiverAdded"));
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to add caregiver");
    }
  };

  const handleRemoveCaregiver = async (name: string) => {
    setAdminError(null);
    setAdminMessage(null);
    try {
      await removeCaregiver({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        name,
      });
      setAdminMessage(t("caregiverRemoved"));
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to remove caregiver");
    }
  };

  if (view === "history") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setView("menu")}
          className="mx-4 mt-3 mb-1 text-sm font-semibold text-primary flex items-center gap-1"
        >
          {t("backToMore")}
        </button>
        <HistoryTab
          trackerId={trackerId}
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
        />
      </div>
    );
  }

  if (view === "health") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setView("menu")}
          className="mx-4 mt-3 mb-1 text-sm font-semibold text-primary flex items-center gap-1"
        >
          {t("backToMore")}
        </button>
        <HealthTab trackerId={trackerId} selectedCaregiver={selectedCaregiver} />
      </div>
    );
  }

  if (view === "stats") {
    return (
      <StatsView
        trackerId={trackerId}
        babyName={babyName}
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "export") {
    return (
      <ExportView
        trackerId={trackerId}
        babyName={babyName}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "growth") {
    return (
      <GrowthView
        trackerId={trackerId}
        selectedCaregiver={selectedCaregiver}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "milestones") {
    return (
      <MilestonesView trackerId={trackerId} onBack={() => setView("menu")} />
    );
  }

  if (view === "reminders") {
    return (
      <ReminderSettingsView
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        babyName={babyName}
        feedIntervalHours={feedIntervalHours}
        nightFeedIntervalEnabled={nightFeedIntervalEnabled}
        nightFeedIntervalHours={nightFeedIntervalHours}
        nightFeedWindowStart={nightFeedWindowStart}
        nightFeedWindowEnd={nightFeedWindowEnd}
        notifyBeforeMinutes={notifyBeforeMinutes}
        wakeWindowMinutes={wakeWindowMinutes}
        medicationReminders={medicationReminders}
        pumpSchedule={pumpSchedule}
        onBack={() => setView("menu")}
      />
    );
  }

  if (view === "caregivers" && isAdmin) {
    return (
      <div className="p-4">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="mb-3 text-sm font-semibold text-primary flex items-center gap-1"
        >
          {t("backToMore")}
        </button>
        <p className="section-label">{t("manageCaregivers")}</p>

        {adminError && (
          <div className="mb-3 rounded-xl border border-[#e8b4b4] bg-[#fdf0f0] px-3 py-2 text-sm text-[#9b3b3b]">
            {adminError}
          </div>
        )}
        {adminMessage && (
          <div className="mb-3 rounded-xl border border-secondary/30 bg-secondary-light px-3 py-2 text-sm text-secondary">
            {adminMessage}
          </div>
        )}

        <div className="space-y-2 mb-4">
          {caregivers.map((caregiver) => (
            <div
              key={caregiver.name}
              className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{caregiver.name}</span>
                {caregiver.role === "admin" && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">
                    {t("admin")}
                  </span>
                )}
              </div>
              {!(
                caregiver.role === "admin" && adminCount <= 1
              ) && (
                <button
                  type="button"
                  onClick={() => handleRemoveCaregiver(caregiver.name)}
                  className="text-xs font-medium text-[#9b3b3b] hover:underline"
                >
                  {t("remove")}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newCaregiverName}
            onChange={(e) => setNewCaregiverName(e.target.value)}
            placeholder={t("newCaregiverName")}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={handleAddCaregiver}
            disabled={!newCaregiverName.trim()}
            className="shrink-0 px-4 py-2 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
          >
            {t("add")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="section-label">{t("more")}</p>

      {/* Language toggle */}
      <div className="mb-4 bg-surface border border-border rounded-xl p-4 card-shadow">
        <p className="text-sm font-semibold text-foreground mb-1">{t("language")}</p>
        <p className="text-xs text-muted mb-3">{t("languageDesc")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              language === "en"
                ? "bg-primary text-white"
                : "bg-[#f3f1ee] text-muted hover:text-foreground"
            )}
          >
            {t("english")}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("zh")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              language === "zh"
                ? "bg-primary text-white"
                : "bg-[#f3f1ee] text-muted hover:text-foreground"
            )}
          >
            {t("chinese")}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {menuItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "supply") {
                  setShowSupplyModal(true);
                } else {
                  setView(item.id);
                }
              }}
              className={cn(
                "w-full bg-surface hover:bg-background border border-border text-foreground font-medium py-4 px-4 rounded-xl transition-colors text-left card-shadow active:scale-[0.99]"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {item.label}
                    {item.adminOnly && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-secondary">
                        {t("admin")}
                      </span>
                    )}
                    {item.id === "supply" &&
                      activeAlerts &&
                      activeAlerts.length > 0 && (
                        <span className="text-[10px] font-bold bg-warning text-[#7a5f10] px-2 py-0.5 rounded-full">
                          {activeAlerts.length}
                        </span>
                      )}
                  </div>
                  <div className="text-sm text-muted">{item.description}</div>
                </div>
                <IconChevronRight size={18} className="text-muted shrink-0" />
              </div>
            </button>
          ))}
      </div>

      {showSupplyModal && (
        <SupplyAlertModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setShowSupplyModal(false)}
        />
      )}
    </div>
  );
}
