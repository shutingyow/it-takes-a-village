"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  daysFrozen,
  resolveFrozenOn,
  toLocalIsoDate,
} from "@/app/lib/milkStashDates";

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
  const [frozenOn, setFrozenOn] = useState(() => toLocalIsoDate());
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
    if (!frozenOn) {
      setError(t("stashFrozenDateRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addBag({
        trackerId,
        caregiverName: selectedCaregiver,
        amountMl: ml,
        frozenOn,
      });
      setAmount("");
      setFrozenOn(toLocalIsoDate());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("stashSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const bagCount = available?.length ?? 0;

  return (
    <div className="px-4 pb-8 space-y-8">
      <h1 className="text-xl font-semibold text-foreground pt-1">
        {t("milkStashTitle")}
      </h1>

      <section className="text-center py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          {t("stashTotalAvailable")}
        </p>
        <p className="text-4xl font-semibold text-foreground tabular-nums tracking-tight">
          {totalMl === undefined ? "—" : totalMl}
          <span className="text-lg font-medium text-muted ml-1.5">ml</span>
        </p>
        {available !== undefined && (
          <p className="text-sm text-muted mt-1.5">
            {t("stashBagCount", { count: String(bagCount) })}
          </p>
        )}
      </section>

      <hr className="border-border" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("stashAddBag")}
        </h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="stash-amount-ml" className="label-field">
              {t("stashAmountLabel")}
            </label>
            <input
              id="stash-amount-ml"
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("stashAmountPlaceholder")}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="stash-frozen-on" className="label-field">
              {t("stashFrozenDate")}
            </label>
            <input
              id="stash-frozen-on"
              type="date"
              value={frozenOn}
              max={toLocalIsoDate()}
              onChange={(e) => setFrozenOn(e.target.value)}
              className="input-field min-h-11"
            />
          </div>
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
      </section>

      <hr className="border-border" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("stashInventory")}
        </h2>
        <ul className="space-y-3">
          {available === undefined ? (
            <li className="text-sm text-muted py-2">{t("loading")}</li>
          ) : available.length === 0 ? (
            <li className="py-4 text-sm text-muted text-center">
              {t("stashEmpty")}
            </li>
          ) : (
            available.map((bag) => {
              const frozen = resolveFrozenOn(bag);
              const days = daysFrozen(frozen);
              return (
                <li
                  key={bag._id}
                  className="border-b border-border pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-3 mb-2.5">
                    <p className="font-semibold text-foreground text-sm">
                      {bag.amountMl} ml
                    </p>
                    <p className="text-xs text-muted text-right">
                      {frozen}
                      {" · "}
                      {t("stashFrozenFor", { days: String(days) })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-primary text-white text-sm font-semibold py-2.5"
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
                      className="flex-1 rounded-xl border border-border text-sm font-semibold py-2.5 text-foreground"
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
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
