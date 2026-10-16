"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { formatDate } from "@/app/lib/utils";

interface MilestonesViewProps {
  trackerId: Id<"trackers">;
  onBack: () => void;
}

const CATEGORY_LABELS: Record<string, TranslationKey> = {
  motor: "milestoneCategoryMotor",
  social: "milestoneCategorySocial",
  language: "milestoneCategoryLanguage",
  sleep: "milestoneCategorySleep",
};

export function MilestonesView({ trackerId, onBack }: MilestonesViewProps) {
  const { t } = useLanguage();
  const ensureSeeded = useMutation(api.milestones.ensureSeeded);
  const markAchieved = useMutation(api.milestones.markAchieved);
  const clearAchieved = useMutation(api.milestones.clearAchieved);
  const addCustom = useMutation(api.milestones.addCustom);

  const milestones = useQuery(api.milestones.list, { trackerId });
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void ensureSeeded({ trackerId });
  }, [trackerId, ensureSeeded]);

  const getTitle = (m: {
    title: string;
    predefinedKey?: string;
    isCustom: boolean;
  }) => {
    if (m.predefinedKey && !m.isCustom) {
      const key = `predefined_${m.predefinedKey}` as TranslationKey;
      return t(key);
    }
    return m.title;
  };

  const handleToggle = async (
    id: Id<"milestones">,
    achievedAt?: number
  ) => {
    if (achievedAt) {
      await clearAchieved({ milestoneId: id });
    } else {
      await markAchieved({ milestoneId: id, achievedAt: Date.now() });
    }
  };

  const handleAddCustom = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await addCustom({ trackerId, title });
      setNewTitle("");
    } finally {
      setAdding(false);
    }
  };

  const sorted = milestones
    ? [...milestones].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const achieved = sorted.filter((m) => m.achievedAt);
  const pending = sorted.filter((m) => !m.achievedAt);

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-sm font-semibold text-primary flex items-center gap-1"
      >
        {t("backToMore")}
      </button>

      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
        {t("milestones")}
      </p>

      {!milestones ? (
        <p className="text-sm text-muted">{t("loading")}</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2 mb-4">
              {pending.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => handleToggle(m._id, m.achievedAt)}
                  className="w-full flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 text-left card-shadow active:scale-[0.99] transition-transform"
                >
                  <span className="w-6 h-6 rounded-full border-2 border-border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">
                      {getTitle(m)}
                    </p>
                    {m.category && CATEGORY_LABELS[m.category] && (
                      <p className="text-[10px] text-muted uppercase tracking-wide">
                        {t(CATEGORY_LABELS[m.category])}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {achieved.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                ✓ {t("markAchieved")}
              </p>
              <div className="space-y-2 mb-4">
                {achieved.map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => handleToggle(m._id, m.achievedAt)}
                    className="w-full flex items-center gap-3 bg-secondary-light border border-secondary/20 rounded-xl px-4 py-3 text-left"
                  >
                    <span className="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center text-xs shrink-0">
                      ✓
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm line-through opacity-70">
                        {getTitle(m)}
                      </p>
                      {m.achievedAt && (
                        <p className="text-[10px] text-secondary">
                          {t("achievedOn", {
                            date: formatDate(m.achievedAt),
                          })}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="bg-surface border border-border rounded-2xl p-4 card-shadow">
            <p className="text-sm font-semibold text-foreground mb-2">
              {t("addMilestone")}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("milestonePlaceholder")}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!newTitle.trim() || adding}
                className="shrink-0 px-4 py-2 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
              >
                {t("add")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
