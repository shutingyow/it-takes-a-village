"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { GrowthModal } from "./modals/GrowthModal";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatGrowthLine } from "@/app/lib/utils";
import { IconGrowth } from "./icons";

interface GrowthViewProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onBack: () => void;
}

export function GrowthView({
  trackerId,
  selectedCaregiver,
  onBack,
}: GrowthViewProps) {
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);

  const entries = useQuery(api.growthEntries.list, { trackerId, limit: 12 });

  const weights = entries
    ? [...entries]
        .reverse()
        .filter(
          (e): e is typeof e & { weight: number } => e.weight != null
        )
        .map((e) => ({ date: e.date, weight: e.weight }))
    : [];

  const maxWeight = Math.max(...weights.map((w) => w.weight), 1);
  const minWeight = Math.min(...weights.map((w) => w.weight), maxWeight);
  const range = maxWeight - minWeight || 1;

  const latest = entries?.[0];

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-sm font-semibold text-primary flex items-center gap-1"
      >
        {t("backToMore")}
      </button>

      <div className="flex items-center justify-between mb-3">
        <p className="section-label mb-0">{t("growth")}</p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-xs font-semibold text-primary"
        >
          + {t("logGrowth")}
        </button>
      </div>

      {!entries ? (
        <p className="text-sm text-muted">{t("loading")}</p>
      ) : entries.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-center card-shadow">
          <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center mx-auto mb-3 text-primary">
            <IconGrowth size={24} />
          </div>
          <p className="text-sm text-muted">{t("noGrowthEntries")}</p>
        </div>
      ) : (
        <>
          {latest && (
            <div className="bg-surface border border-border rounded-2xl px-4 py-3 card-shadow mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                {t("latestGrowth")}
              </p>
              <p className="font-semibold text-foreground">
                {formatGrowthLine(latest) || t("noGrowthEntries")}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {latest.date} · {latest.caregiverName}
              </p>
            </div>
          )}

          {weights.length > 1 && (
            <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                {t("weightOverTime")}
              </p>
              <div className="flex items-end justify-between gap-1 h-24">
                {weights.map((w) => {
                  const pct = ((w.weight - minWeight) / range) * 80 + 20;
                  return (
                    <div
                      key={w.date}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-[10px] font-medium text-muted">
                        {w.weight} kg
                      </span>
                      <div className="w-full flex items-end justify-center h-16">
                        <div
                          className="w-full max-w-[24px] rounded-t-lg bg-secondary"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted truncate w-full text-center">
                        {w.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {entries.map((entry) => {
              const line = formatGrowthLine(entry);
              return (
                <div
                  key={entry._id}
                  className="bg-surface border border-border rounded-xl px-4 py-3 card-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-foreground">
                        {line || "—"}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {entry.date} · {entry.caregiverName}
                      </p>
                    </div>
                  </div>
                  {entry.notes && (
                    <p className="text-sm text-muted mt-2">{entry.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showModal && (
        <GrowthModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
