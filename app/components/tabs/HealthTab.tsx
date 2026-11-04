"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { HealthModal } from "../modals/HealthModal";
import { formatTimeAgo } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  IconChevronRight,
  IconMedication,
  IconTemperature,
} from "../icons";

interface HealthTabProps {
  secretLink: string;
  selectedCaregiver: string;
}

type HealthType = "temperature" | "medication" | "vaccine" | "spitup";

export function HealthTab({ secretLink, selectedCaregiver }: HealthTabProps) {
  const { t } = useLanguage();
  const [activeModal, setActiveModal] = useState<HealthType | null>(null);

  const healthItems: {
    id: HealthType;
    icon: React.ReactNode;
    label: string;
  }[] = [
    {
      id: "temperature",
      icon: <IconTemperature size={20} className="text-primary" />,
      label: t("temperature"),
    },
    {
      id: "medication",
      icon: <IconMedication size={20} className="text-secondary" />,
      label: t("medicationVitamins"),
    },
    {
      id: "vaccine",
      icon: <IconMedication size={20} className="text-terracotta" />,
      label: t("vaccine"),
    },
    {
      id: "spitup",
      icon: <IconTemperature size={20} className="text-muted" />,
      label: t("spitUp"),
    },
  ];

  const lastTemp = useQuery(api.healthEntries.getByType, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    type: "temperature",
    limit: 1,
  });
  const lastMed = useQuery(api.healthEntries.getByType, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    type: "medication",
    limit: 1,
  });
  const lastVaccine = useQuery(api.healthEntries.getByType, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    type: "vaccine",
    limit: 1,
  });
  const lastSpit = useQuery(api.healthEntries.getByType, {
    secretLink,
    actingCaregiverName: selectedCaregiver,
    type: "spitup",
    limit: 1,
  });

  const lastByType: Record<HealthType, string> = {
    temperature: lastTemp?.[0]
      ? `${lastTemp[0].temperature?.toFixed(1)}°C · ${formatTimeAgo(lastTemp[0].timestamp)}`
      : t("never"),
    medication: lastMed?.[0]
      ? `${lastMed[0].medicationName} · ${formatTimeAgo(lastMed[0].timestamp)}`
      : t("never"),
    vaccine: lastVaccine?.[0]
      ? `${lastVaccine[0].vaccineName} · ${formatTimeAgo(lastVaccine[0].timestamp)}`
      : t("never"),
    spitup: lastSpit?.[0]
      ? formatTimeAgo(lastSpit[0].timestamp)
      : t("never"),
  };

  return (
    <div className="p-4">
      <p className="section-label mb-4">{t("healthLogging")}</p>
      <div className="space-y-3">
        {healthItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveModal(item.id)}
            className="w-full bg-surface hover:bg-background border border-border text-foreground font-medium py-4 px-4 rounded-xl transition-colors text-left card-shadow active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                {item.icon}
              </span>
              <div className="flex-1">
                <div className="font-medium">{item.label}</div>
                <div className="text-sm text-muted">
                  {t("lastLogged", { value: lastByType[item.id] })}
                </div>
              </div>
              <IconChevronRight size={18} className="text-muted shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {activeModal && (
        <HealthModal
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
          healthType={activeModal}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
