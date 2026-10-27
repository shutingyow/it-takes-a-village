"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ExportView } from "../ExportView";
import { ReminderSettingsView } from "../ReminderSettingsView";
import { SupplyAlertModal } from "../modals/SupplyAlertModal";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { useTheme, type ThemePreference } from "@/app/lib/theme";
import { cn } from "@/app/lib/utils";
import type { TranslationKey } from "@/app/lib/i18n/en";
import {
  IconChevronRight,
  IconExport,
  IconReminders,
  IconUsers,
  IconWarning,
} from "../icons";
import type { CaregiverInfo } from "@/app/lib/trackerStorage";
import { signInWithOAuth } from "@/app/lib/oauthSignIn";
import { BirthDateField } from "../BirthDateField";
import Link from "next/link";

export type SettingsView =
  | "menu"
  | "export"
  | "reminders"
  | "caregivers";

interface SettingsTabProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  caregivers: CaregiverInfo[];
  babyName?: string;
  birthDate?: string;
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
  openView?: SettingsView | null;
  /** SSO owner of this village — gates admin settings. */
  viewerIsOwner?: boolean;
}

export function SettingsTab({
  trackerId,
  secretLink,
  selectedCaregiver,
  caregivers,
  babyName,
  birthDate,
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
  viewerIsOwner = false,
}: SettingsTabProps) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const [view, setView] = useState<SettingsView>("menu");
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [newCaregiverName, setNewCaregiverName] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const activeAlerts = useQuery(api.supplyAlerts.getActive, { trackerId });
  const addCaregiver = useMutation(api.trackers.addCaregiver);
  const removeCaregiver = useMutation(api.trackers.removeCaregiver);

  const isAdmin = viewerIsOwner;
  const adminCount = caregivers.filter((c) => c.role === "admin").length;

  const handleSignIn = async (provider: "apple" | "google") => {
    setAuthBusy(true);
    try {
      await signInWithOAuth(signIn, provider);
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (openView) setView(openView);
  }, [openView]);

  if (view === "export") {
    return (
      <ExportView
        trackerId={trackerId}
        babyName={babyName}
        onBack={() => setView("menu")}
      />
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
          className="mb-3 text-sm font-semibold text-terracotta flex items-center gap-1"
        >
          {t("backToSettings")}
        </button>
        <p className="section-label">{t("manageCaregivers")}</p>

        {adminError && (
          <div className="mb-3 rounded-xl border border-[#e8b4b4] bg-[#fdf0f0] px-3 py-2 text-sm text-[#9b3b3b]">
            {adminError}
          </div>
        )}
        {adminMessage && (
          <div className="mb-3 rounded-xl border border-accent-diaper/30 bg-accent-diaper-light px-3 py-2 text-sm text-accent-diaper">
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
                <span className="font-medium text-foreground">
                  {caregiver.name}
                </span>
                {caregiver.role === "admin" && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-accent-diaper/20 text-accent-diaper px-2 py-0.5 rounded-full">
                    {t("admin")}
                  </span>
                )}
              </div>
              {!(caregiver.role === "admin" && adminCount <= 1) && (
                <button
                  type="button"
                  onClick={async () => {
                    setAdminError(null);
                    setAdminMessage(null);
                    try {
                      await removeCaregiver({
                        secretLink,
                        actingCaregiverName: selectedCaregiver,
                        name: caregiver.name,
                      });
                      setAdminMessage(t("caregiverRemoved"));
                    } catch (err) {
                      setAdminError(
                        err instanceof Error
                          ? err.message
                          : "Failed to remove caregiver"
                      );
                    }
                  }}
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
            onClick={async () => {
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
                setAdminError(
                  err instanceof Error ? err.message : "Failed to add caregiver"
                );
              }
            }}
            disabled={!newCaregiverName.trim()}
            className="shrink-0 px-4 py-2 rounded-xl bg-accent-diaper text-white font-semibold text-sm disabled:opacity-50"
          >
            {t("add")}
          </button>
        </div>
      </div>
    );
  }

  const adminItems: {
    id: SettingsView | "supply";
    icon: React.ReactNode;
    label: string;
    description: string;
    adminOnly?: boolean;
  }[] = [
    {
      id: "reminders",
      icon: <IconReminders size={20} className="text-terracotta" />,
      label: t("reminderSettings"),
      description: t("reminderSettingsDesc"),
    },
    {
      id: "export",
      icon: <IconExport size={20} className="text-terracotta" />,
      label: t("exportData"),
      description: t("exportDesc"),
    },
    {
      id: "supply",
      icon: <IconWarning size={20} className="text-warning" />,
      label: t("supplyAlerts"),
      description: t("supplyAlertsDesc"),
    },
    {
      id: "caregivers",
      icon: <IconUsers size={20} className="text-terracotta" />,
      label: t("manageCaregivers"),
      description: t("manageCaregiversDesc"),
      adminOnly: true,
    },
  ];

  return (
    <div className="p-4">
      <p className="section-label">{t("settingsHub")}</p>
      <p className="text-sm text-muted mb-4 -mt-2">{t("settingsHubDesc")}</p>

      <div className="mb-4 bg-surface border border-border rounded-2xl p-4 card-shadow">
        <p className="text-sm font-semibold text-foreground mb-1">
          {t("accountSection")}
        </p>
        {isAuthenticated ? (
          <>
            <p className="text-xs text-muted mb-3">{t("accountSignedIn")}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full py-3.5 px-4 rounded-xl border border-border bg-background text-sm font-semibold text-foreground touch-manipulation min-h-[44px]"
            >
              {t("signOut")}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted mb-3">{t("accountSignedOut")}</p>
            <div className="space-y-2">
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleSignIn("apple")}
                className="w-full py-3.5 px-4 rounded-xl bg-foreground text-background text-sm font-semibold touch-manipulation min-h-[44px] disabled:opacity-50"
              >
                {t("signInWithApple")}
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleSignIn("google")}
                className="w-full py-3.5 px-4 rounded-xl border border-border bg-background text-sm font-semibold text-foreground touch-manipulation min-h-[44px] disabled:opacity-50"
              >
                {t("signInWithGoogle")}
              </button>
              <Link
                href="/"
                className="block text-center text-xs font-semibold text-primary pt-1"
              >
                {t("signInForAdmin")}
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="mb-4 bg-surface border border-border rounded-2xl p-4 card-shadow">
        <p className="text-sm font-semibold text-foreground mb-1">
          {t("language")}
        </p>
        <p className="text-xs text-muted mb-3">{t("languageDesc")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              language === "en"
                ? "bg-terracotta text-white"
                : "bg-beige-light text-muted hover:text-foreground"
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
                ? "bg-terracotta text-white"
                : "bg-beige-light text-muted hover:text-foreground"
            )}
          >
            {t("chinese")}
          </button>
        </div>
      </div>

      <div className="mb-4 bg-surface border border-border rounded-2xl p-4 card-shadow">
        <p className="text-sm font-semibold text-foreground mb-1">
          {t("appearance")}
        </p>
        <p className="text-xs text-muted mb-3">{t("appearanceDesc")}</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "light" as const, labelKey: "themeLight" as const },
              { id: "dark" as const, labelKey: "themeDark" as const },
              { id: "system" as const, labelKey: "themeSystem" as const },
            ] satisfies Array<{ id: ThemePreference; labelKey: TranslationKey }>
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={cn(
                "py-2.5 rounded-xl text-sm font-semibold transition-colors touch-manipulation min-h-[44px]",
                theme === opt.id
                  ? "bg-terracotta text-white"
                  : "bg-beige-light text-muted hover:text-foreground"
              )}
              aria-pressed={theme === opt.id}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <BirthDateField
        secretLink={secretLink}
        actingCaregiverName={selectedCaregiver}
        birthDate={birthDate}
        canEdit={isAdmin}
      />
      {!isAdmin && !birthDate && (
        <p className="mb-4 text-xs text-muted break-words">
          {t("birthDateAdminOnly")}
        </p>
      )}

      <div className="space-y-2">
        {adminItems
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
              className="w-full bg-surface hover:bg-beige-light/50 border border-border text-foreground font-medium py-4 px-4 rounded-2xl transition-colors text-left card-shadow active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-beige-light flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {item.label}
                    {item.adminOnly && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-accent-diaper">
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
