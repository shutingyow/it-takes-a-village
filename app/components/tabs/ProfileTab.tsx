"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { NotesTab } from "./NotesTab";
import { UpcomingTab } from "./UpcomingTab";
import { HistoryTab } from "./HistoryTab";
import { HealthTab } from "./HealthTab";
import { GrowthView } from "../GrowthView";
import { MilestonesView } from "../MilestonesView";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { cn } from "@/app/lib/utils";
import {
  IconChevronRight,
  IconGrowth,
  IconHealth,
  IconHistory,
  IconMilestone,
  IconNotes,
  IconCalendar,
} from "../icons";

export type ProfileView =
  | "menu"
  | "notes"
  | "upcoming"
  | "history"
  | "health"
  | "growth"
  | "milestones";

interface ProfileTabProps {
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  openView?: ProfileView | null;
}

export function ProfileTab({
  trackerId,
  secretLink,
  selectedCaregiver,
  openView,
}: ProfileTabProps) {
  const { t } = useLanguage();
  const [view, setView] = useState<ProfileView>("menu");

  useEffect(() => {
    if (openView) setView(openView);
  }, [openView]);

  const menuItems: {
    id: ProfileView;
    icon: React.ReactNode;
    label: string;
    description: string;
  }[] = [
    {
      id: "notes",
      icon: <IconNotes size={20} className="text-terracotta" />,
      label: t("tabNotes"),
      description: t("notesDesc"),
    },
    {
      id: "upcoming",
      icon: <IconCalendar size={20} className="text-terracotta" />,
      label: t("tabUpcoming"),
      description: t("upcomingDesc"),
    },
    {
      id: "health",
      icon: <IconHealth size={20} className="text-accent-diaper" />,
      label: t("health"),
      description: t("healthDesc"),
    },
    {
      id: "history",
      icon: <IconHistory size={20} className="text-muted" />,
      label: t("history"),
      description: t("historyDesc"),
    },
    {
      id: "growth",
      icon: <IconGrowth size={20} className="text-muted" />,
      label: t("growth"),
      description: t("growthDesc"),
    },
    {
      id: "milestones",
      icon: <IconMilestone size={20} className="text-muted" />,
      label: t("milestones"),
      description: t("milestonesDesc"),
    },
  ];

  if (view === "notes") {
    return (
      <SubView backLabel={t("backToProfile")} onBack={() => setView("menu")}>
        <NotesTab trackerId={trackerId} selectedCaregiver={selectedCaregiver} />
      </SubView>
    );
  }

  if (view === "upcoming") {
    return (
      <SubView backLabel={t("backToProfile")} onBack={() => setView("menu")}>
        <UpcomingTab trackerId={trackerId} selectedCaregiver={selectedCaregiver} />
      </SubView>
    );
  }

  if (view === "history") {
    return (
      <SubView backLabel={t("backToProfile")} onBack={() => setView("menu")}>
        <HistoryTab
          trackerId={trackerId}
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
        />
      </SubView>
    );
  }

  if (view === "health") {
    return (
      <SubView backLabel={t("backToProfile")} onBack={() => setView("menu")}>
        <HealthTab trackerId={trackerId} selectedCaregiver={selectedCaregiver} />
      </SubView>
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

  return (
    <div className="p-4">
      <p className="section-label">{t("profileHub")}</p>
      <p className="text-sm text-muted mb-4 -mt-2">{t("profileHubDesc")}</p>
      <div className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={cn(
              "w-full bg-surface hover:bg-beige-light/50 border border-border text-foreground font-medium py-4 px-4 rounded-2xl transition-colors text-left card-shadow active:scale-[0.99]"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-beige-light flex items-center justify-center shrink-0">
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{item.label}</div>
                <div className="text-sm text-muted">{item.description}</div>
              </div>
              <IconChevronRight size={18} className="text-muted shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SubView({
  children,
  onBack,
  backLabel,
}: {
  children: React.ReactNode;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mx-4 mt-3 mb-1 text-sm font-semibold text-terracotta flex items-center gap-1"
      >
        {backLabel}
      </button>
      {children}
    </div>
  );
}
