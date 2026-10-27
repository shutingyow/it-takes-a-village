"use client";

import { useMemo, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import type { CaregiverInfo } from "../lib/trackerStorage";
import { signInWithOAuth } from "../lib/oauthSignIn";
import { IconUser } from "./icons";

interface CaregiverLockScreenProps {
  caregivers: CaregiverInfo[];
  onConfirm: (name: string) => void;
  /** Village owner (SSO) may pick admin names; caregivers cannot. */
  viewerIsOwner?: boolean;
  /** Village has no owner yet — signed-in user can claim it. */
  canClaim?: boolean;
  claiming?: boolean;
  claimError?: string | null;
  onClaim?: () => void;
}

export function CaregiverLockScreen({
  caregivers,
  onConfirm,
  viewerIsOwner = false,
  canClaim = false,
  claiming = false,
  claimError = null,
  onClaim,
}: CaregiverLockScreenProps) {
  const { t } = useLanguage();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [selected, setSelected] = useState("");
  const [authBusy, setAuthBusy] = useState<"apple" | "google" | null>(null);

  const selectable = useMemo(() => {
    if (viewerIsOwner) return caregivers;
    return caregivers.filter((c) => c.role !== "admin");
  }, [caregivers, viewerIsOwner]);

  const handleSignIn = async (provider: "apple" | "google") => {
    setAuthBusy(provider);
    try {
      await signInWithOAuth(signIn, provider);
    } finally {
      setAuthBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-sm w-full min-w-0 bg-surface rounded-2xl card-shadow p-5 sm:p-8 border border-border my-auto">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-xl bg-primary-light flex items-center justify-center mx-auto mb-4 text-primary">
            <IconUser size={28} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            {t("whoAreYou")}
          </h1>
          <p className="text-sm text-muted">{t("pickCaregiver")}</p>
        </div>

        {/* Parent path: sign in / claim before admin name appears */}
        {!viewerIsOwner && (
          <div className="mb-5 rounded-xl border border-border bg-background/70 p-3 space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t("parentUnlockTitle")}
            </p>
            {!isAuthenticated ? (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={authBusy !== null}
                  onClick={() => void handleSignIn("apple")}
                  className="w-full rounded-xl bg-[#111] text-white text-sm font-semibold py-3 disabled:opacity-50"
                >
                  {authBusy === "apple"
                    ? t("signingIn")
                    : t("signInWithApple")}
                </button>
                <button
                  type="button"
                  disabled={authBusy !== null}
                  onClick={() => void handleSignIn("google")}
                  className="w-full rounded-xl border border-border bg-surface text-sm font-semibold py-3 text-foreground disabled:opacity-50"
                >
                  {authBusy === "google"
                    ? t("signingIn")
                    : t("signInWithGoogle")}
                </button>
              </div>
            ) : canClaim && onClaim ? (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-foreground">{t("claimVillageHint")}</p>
                {claimError && (
                  <p className="text-xs text-red-600" role="alert">
                    {claimError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onClaim}
                  disabled={claiming}
                  className="btn-primary text-sm py-3"
                >
                  {claiming ? t("claimingVillage") : t("claimVillage")}
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted pt-1">
                {t("parentSignedInNotOwner")}
              </p>
            )}
          </div>
        )}

        {viewerIsOwner && (
          <p className="text-xs text-primary font-medium mb-3 text-center">
            {t("parentOwnerReady")}
          </p>
        )}

        <div className="space-y-2 mb-6">
          {selectable.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">
              {viewerIsOwner
                ? t("noCaregiverNamesYet")
                : t("adminPickLockedHint")}
            </p>
          ) : (
            selectable.map((caregiver) => (
              <button
                key={caregiver.name}
                type="button"
                onClick={() => setSelected(caregiver.name)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-3.5 rounded-xl border text-left transition-all min-w-0",
                  selected === caregiver.name
                    ? "border-primary bg-primary-light"
                    : "border-border bg-surface hover:bg-background"
                )}
              >
                <span className="font-medium text-foreground truncate min-w-0">
                  {caregiver.name}
                </span>
                {caregiver.role === "admin" && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-secondary/15 text-secondary px-2 py-0.5 rounded-full shrink-0">
                    {t("admin")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          disabled={!selected}
          onClick={() => onConfirm(selected)}
          className="btn-primary disabled:opacity-50"
        >
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}
