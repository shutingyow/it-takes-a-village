"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { BottomSheet } from "./ui/BottomSheet";
import { ActivityIcon, type ActivityType } from "./icons";

type LogType = "feed" | "diaper" | "pump" | "nap";

interface LogSheetProps {
  onSelect: (type: LogType) => void;
  onClose: () => void;
}

export function LogSheet({ onSelect, onClose }: LogSheetProps) {
  const { t } = useLanguage();

  const actions: {
    type: LogType;
    label: string;
    bg: string;
    text: string;
    icon: ActivityType;
  }[] = [
    {
      type: "feed",
      label: t("feed"),
      bg: "bg-[#fde8e8]",
      text: "text-[#b42318]",
      icon: "feed",
    },
    {
      type: "diaper",
      label: t("diaper"),
      bg: "bg-[#fff6d6]",
      text: "text-[#8a6a00]",
      icon: "diaper",
    },
    {
      type: "pump",
      label: t("pump"),
      bg: "bg-[#e3f2fc]",
      text: "text-[#1769a8]",
      icon: "pump",
    },
    {
      type: "nap",
      label: t("filterNap"),
      bg: "bg-[#e6f6ec]",
      text: "text-[#1f7a45]",
      icon: "nap",
    },
  ];

  return (
    <BottomSheet title={t("logActivity")} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 pt-2 min-w-0">
        {actions.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => onSelect(action.type)}
            className={`${action.bg} ${action.text} rounded-2xl p-4 flex flex-col items-center gap-2.5 active:scale-[0.98] transition-transform min-w-0`}
          >
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-sm">
              <ActivityIcon
                type={action.icon}
                size={22}
                strokeWidth={2.25}
                className={action.text}
              />
            </div>
            <span className="text-sm font-semibold text-center leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
