"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import {
  ownerLoggingCaregivers,
  type CaregiverInfo,
} from "../lib/trackerStorage";
import { GetAppBanner } from "./GetAppBanner";
import { IconUser } from "./icons";

export type OwnedVillageSummary = {
  secretLink: string;
  babyName?: string;
};

interface CaregiverLockScreenProps {
  caregivers: CaregiverInfo[];
  onConfirm: (name: string) => void;
  /** Village owner (SSO) locks to admin name(s) only. */
  viewerIsOwner?: boolean;
  /**
   * Personal invite resolved from ?invite= — only this name may log.
   * When set for a guest, skip the picker entirely (parent auto-confirms).
   */
  inviteCaregiverName?: string | null;
  /** Bare village link with no valid invite and not the owner. */
  needsPersonalInvite?: boolean;
  /** Village has no owner yet — signed-in user can claim it. */
  canClaim?: boolean;
  claiming?: boolean;
  claimError?: string | null;
  onClaim?: () => void;
  ownedVillages?: OwnedVillageSummary[];
  ownedVillagesLoading?: boolean;
  onOpenOwnedVillage?: (secretLink: string) => void;
  /** Prefer over raw `/` so callers can clear a bare lastVisited pin first. */
  onGoHome?: () => void;
}

export function CaregiverLockScreen({
  caregivers,
  onConfirm,
  viewerIsOwner = false,
  inviteCaregiverName = null,
  needsPersonalInvite = false,
  canClaim = false,
  claiming = false,
  claimError = null,
  onClaim,
  ownedVillages = [],
  ownedVillagesLoading = false,
  onOpenOwnedVillage,
  onGoHome,
}: CaregiverLockScreenProps) {
  const { t } = useLanguage();
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [selected, setSelected] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const goHomeClass =
    "block w-full text-center rounded-xl border border-border bg-surface text-sm font-semibold py-3 text-foreground";
  const goHomeLink = onGoHome ? (
    <button type="button" onClick={onGoHome} className={goHomeClass}>
      {t("goToHome")}
    </button>
  ) : (
    <Link href="/" className={goHomeClass}>
      {t("goToHome")}
    </Link>
  );

  const selectable = useMemo(() => {
    if (viewerIsOwner) return ownerLoggingCaregivers(caregivers);
    if (inviteCaregiverName) {
      return caregivers.filter((c) => c.name === inviteCaregiverName);
    }
    return [];
  }, [caregivers, viewerIsOwner, inviteCaregiverName]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const villageLabel = (babyName?: string) =>
    babyName?.trim() || t("yourTracker");

  // Guest opened the village secret without a personal invite.
  if (needsPersonalInvite && !viewerIsOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-3 sm:p-4 overflow-y-auto">
        <div className="max-w-sm w-full min-w-0 bg-surface rounded-2xl card-shadow p-5 sm:p-8 border border-border my-auto space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-primary-light flex items-center justify-center mx-auto mb-4 text-primary">
              <IconUser size={28} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
              {t("personalInviteRequiredTitle")}
            </h1>
            <p className="text-sm text-muted leading-snug">
              {t("personalInviteRequiredHint")}
            </p>
          </div>
          <GetAppBanner />
          {isAuthenticated && (
            <div className="space-y-2 pt-1">
              {ownedVillagesLoading ? (
                <p className="text-xs text-muted text-center">
                  {t("findingYourVillage")}
                </p>
              ) : ownedVillages.length > 0 ? (
                ownedVillages.map((village) => (
                  <button
                    key={village.secretLink}
                    type="button"
                    onClick={() => onOpenOwnedVillage?.(village.secretLink)}
                    className="btn-primary text-sm py-3"
                  >
                    {t("openYourVillage", {
                      name: villageLabel(village.babyName),
                    })}
                  </button>
                ))
              ) : null}
              {goHomeLink}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="w-full text-xs font-semibold text-muted py-1 disabled:opacity-50"
              >
                {t("signOut")}
              </button>
            </div>
          )}
          {!isAuthenticated &&
            (onGoHome ? (
              <button
                type="button"
                onClick={onGoHome}
                className="block w-full text-center text-sm font-semibold text-primary py-2"
              >
                {t("goToHome")}
              </button>
            ) : (
              <Link
                href="/"
                className="block w-full text-center text-sm font-semibold text-primary py-2"
              >
                {t("goToHome")}
              </Link>
            ))}
        </div>
      </div>
    );
  }

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

        {viewerIsOwner && (
          <p className="text-xs text-primary font-medium mb-3 text-center">
            {t("parentOwnerReady")}
          </p>
        )}

        {/* Signed-in but not owner of this link — escape hatch */}
        {isAuthenticated && !viewerIsOwner && (
          <div className="mb-5 rounded-xl border border-border bg-background/70 p-3 space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t("parentUnlockTitleSignedIn")}
            </p>
            {canClaim && onClaim ? (
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
            ) : ownedVillagesLoading ? (
              <p className="text-xs text-muted pt-1">{t("findingYourVillage")}</p>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted leading-snug">
                  {ownedVillages.length > 0
                    ? t("parentSignedInNotOwner")
                    : t("parentSignedInNoVillages")}
                </p>
                {ownedVillages.map((village) => (
                  <button
                    key={village.secretLink}
                    type="button"
                    onClick={() => onOpenOwnedVillage?.(village.secretLink)}
                    className="btn-primary text-sm py-3"
                  >
                    {t("openYourVillage", {
                      name: villageLabel(village.babyName),
                    })}
                  </button>
                ))}
                {goHomeLink}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="w-full text-xs font-semibold text-muted py-1 disabled:opacity-50"
                >
                  {t("signOut")}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 mb-6">
          {selectable.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">
              {viewerIsOwner
                ? t("noCaregiverNamesYet")
                : t("personalInviteRequiredHint")}
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
