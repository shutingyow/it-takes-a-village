"use client";

import { cn } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  IconInsights,
  IconLogPlus,
  IconProfile,
  IconSettings,
  IconToday,
} from "./icons";

export type TrackerTab =
  | "today"
  | "insights"
  | "log"
  | "profile"
  | "settings";

interface TrackerBottomNavProps {
  activeTab: TrackerTab;
  onTabChange: (tab: TrackerTab) => void;
  onLogPress: () => void;
}

export function TrackerBottomNav({
  activeTab,
  onTabChange,
  onLogPress,
}: TrackerBottomNavProps) {
  const { t } = useLanguage();

  const sideTabs: {
    id: Exclude<TrackerTab, "log">;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "today",
      label: t("tabToday"),
      icon: <IconToday size={22} />,
    },
    {
      id: "insights",
      label: t("tabInsights"), // "Reports"
      icon: <IconInsights size={22} />,
    },
    {
      id: "profile",
      label: t("tabProfile"),
      icon: <IconProfile size={22} />,
    },
    {
      id: "settings",
      label: t("tabSettings"),
      icon: <IconSettings size={22} />,
    },
  ];

  const leftTabs = sideTabs.slice(0, 2);
  const rightTabs = sideTabs.slice(2);

  return (
    <nav
      className="app-tab-bar absolute bottom-0 inset-x-0 z-40 w-full min-w-0"
      aria-label="Main"
    >
      <div className="flex items-end w-full min-w-0 px-1 pt-1.5 pb-1 safe-bottom">
        {leftTabs.map((tab) => (
          <NavItem
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}

        <button
          type="button"
          onClick={onLogPress}
          className="flex flex-col items-center shrink-0 -mt-5 px-1.5 touch-manipulation"
          aria-label={t("tabLog")}
        >
          <span className="w-14 h-14 rounded-full bg-terracotta text-white flex items-center justify-center shadow-lg ring-[3px] ring-terracotta/30 active:scale-95 transition-transform">
            <IconLogPlus size={26} />
          </span>
          <span className="text-[10px] font-semibold text-terracotta mt-1 truncate max-w-[3.75rem]">
            {t("tabLog")}
          </span>
        </button>

        {rightTabs.map((tab) => (
          <NavItem
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 px-0.5 min-h-[48px] transition-colors touch-manipulation",
        active ? "text-terracotta" : "text-muted"
      )}
    >
      {icon}
      <span
        className={cn(
          "text-[10px] font-medium truncate max-w-full leading-tight",
          active && "font-semibold"
        )}
      >
        {label}
      </span>
    </button>
  );
}
