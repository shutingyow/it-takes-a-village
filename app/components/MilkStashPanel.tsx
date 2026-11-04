"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { formatDateTime } from "@/app/lib/utils";

interface MilkStashPanelProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function MilkStashPanel({
  trackerId,
  selectedCaregiver,
}: MilkStashPanelProps) {
  const { t } = useLanguage();
  const available = useQuery(api.milkStash.listAvailable, { trackerId });
  const totalMl = useQuery(api.milkStash.availableTotalMl, { trackerId });
  const addBag = useMutation(api.milkStash.addBag);
  const markUsed = useMutation(api.milkStash.markUsed);
  const discard = useMutation(api.milkStash.discard);

  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const ml = Number(amount);
    if (!selectedCaregiver) {
      setError(t("selectCaregiver"));
      return;
    }
    if (!Number.isFinite(ml) || ml <= 0) {
      setError(t("stashAmountRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addBag({
        trackerId,
        caregiverName: selectedCaregiver,
        amountMl: ml,
        label: label.trim() || undefined,
      });
      setAmount("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("stashSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {t("milkStashTitle")}
        </p>
        <p className="text-xs text-muted mt-1">{t("milkStashHint")}</p>
        <p className="text-sm text-foreground mt-2">
          {t("stashAvailableMl", {
            ml: String(totalMl ?? 0),
          })}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("stashAddBag")}
        </p>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("stashAmountPlaceholder")}
          className="input-field"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("stashLabelPlaceholder")}
          className="input-field"
        />
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleAdd()}
          className="btn-primary text-sm py-2.5"
        >
          {busy ? t("saving") : t("stashAddBag")}
        </button>
      </div>

      <ul className="space-y-2">
        {available === undefined ? (
          <li className="text-sm text-muted">{t("loading")}</li>
        ) : available.length === 0 ? (
          <li className="text-sm text-muted">{t("stashEmpty")}</li>
        ) : (
          available.map((bag) => (
            <li
              key={bag._id}
              className="rounded-xl border border-border bg-surface px-3 py-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    {bag.amountMl} ml
                    {bag.label ? ` · ${bag.label}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(bag.pumpedAt ?? bag.createdAt)} ·{" "}
                    {bag.caregiverName}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-primary text-white text-sm font-semibold py-2"
                  onClick={() =>
                    void markUsed({
                      bagId: bag._id,
                      caregiverName: selectedCaregiver,
                    })
                  }
                >
                  {t("stashMarkUsed")}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-border text-sm font-semibold py-2 text-foreground"
                  onClick={() =>
                    void discard({
                      bagId: bag._id,
                      caregiverName: selectedCaregiver,
                    })
                  }
                >
                  {t("stashDiscard")}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
