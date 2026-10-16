"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  IconDiaper,
  IconFeed,
  IconPump,
  IconReminders,
} from "./icons";

type QuickLog = "feed" | "diaper" | "pump";

interface HomeQuickActionsProps {
  onQuickLog: (type: QuickLog) => void;
  onOpenReminders: () => void;
  remindersEnabled?: boolean;
}

export function HomeQuickActions({
  onQuickLog,
  onOpenReminders,
  remindersEnabled,
}: HomeQuickActionsProps) {
  const { t } = useLanguage();

  const actions: {
    id: string;
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      id: "feed",
      label: t("quickLogFeed"),
      onClick: () => onQuickLog("feed"),
      icon: <IconFeed size={22} className="text-accent-feed" />,
      accent: "bg-accent-feed-light",
    },
    {
      id: "diaper",
      label: t("quickLogDiaper"),
      onClick: () => onQuickLog("diaper"),
      icon: <IconDiaper size={22} className="text-accent-diaper" />,
      accent: "bg-accent-diaper-light",
    },
    {
      id: "pump",
      label: t("quickLogPump"),
      onClick: () => onQuickLog("pump"),
      icon: <IconPump size={22} className="text-accent-pump" />,
      accent: "bg-accent-pump-light",
    },
    {
      id: "reminders",
      label: remindersEnabled
        ? t("quickRemindersOn")
        : t("quickReminders"),
      onClick: onOpenReminders,
      icon: <IconReminders size={22} />,
      accent: "bg-terracotta-light",
    },
  ];

  return (
    <div className="px-4 pb-5 min-w-0">
      <p className="section-label">{t("quickActions")}</p>
      <div className="grid grid-cols-4 gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className="flex flex-col items-center gap-2 min-w-0 touch-manipulation active:scale-[0.97] transition-transform"
          >
            <span
              className={`w-14 h-14 rounded-[1.15rem] ${action.accent} flex items-center justify-center shadow-sm`}
            >
              {action.icon}
            </span>
            <span className="text-[10px] font-semibold text-foreground text-center leading-tight truncate w-full px-0.5">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
