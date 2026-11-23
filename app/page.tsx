"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  useConvexAuth,
  useMutation,
  useConvexConnectionState,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TrackerCreatedSuccess } from "@/app/components/TrackerCreatedSuccess";
import {
  clearLastVisitedTracker,
  getLastVisitedTracker,
  parseTrackerLinkInput,
  resolveLastVisitedInvite,
  saveLastVisitedTracker,
  trackerPath,
} from "@/app/lib/trackerStorage";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { cn } from "@/app/lib/utils";
import { IconReminders } from "@/app/components/icons";
import { LanguageToggle } from "@/app/components/LanguageToggle";
import { signInWithOAuth } from "@/app/lib/oauthSignIn";
import { EmailPasswordForm } from "@/app/components/EmailPasswordForm";
import { detectDeviceTimezone } from "@/app/lib/utils";

const CREATE_TIMEOUT_MS = 15_000;

type CaregiverDraft = {
  name: string;
  role: "admin" | "caregiver";
};

/** Guest join path after the first question (signed-in users skip this). */
type JoinPath = "choose" | "caregiver" | "parent";

export default function Home() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const createTracker = useMutation(api.trackers.create);
  const myVillages = useQuery(
    api.trackers.listMine,
    isAuthenticated ? {} : "skip"
  );
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const isBackendReady = isWebSocketConnected || hasEverConnected;
  /** Avoid a flash of “Connecting…” on every cold start (prod + iOS). */
  const [showConnectingBanner, setShowConnectingBanner] = useState(false);
  const [babyName, setBabyName] = useState("");
  const [caregivers, setCaregivers] = useState<CaregiverDraft[]>([
    { name: "", role: "admin" },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [signingInProvider, setSigningInProvider] = useState<
    "apple" | "google" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [createdTracker, setCreatedTracker] = useState<{
    secretLink: string;
    url: string;
    babyName?: string;
  } | null>(null);
  const [shareUrl, setShareUrl] = useState<{
    url: string;
    babyName?: string;
  } | null>(null);
  const [lastVisited, setLastVisited] = useState<ReturnType<
    typeof getLastVisitedTracker
  > | null>(null);
  const [openLinkInput, setOpenLinkInput] = useState("");
  const [pendingOpenSecret, setPendingOpenSecret] = useState<string | null>(
    null
  );
  const [pendingOpenInvite, setPendingOpenInvite] = useState<string | null>(
    null
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [joinPath, setJoinPath] = useState<JoinPath>("choose");

  useEffect(() => {
    setLastVisited(getLastVisitedTracker());
  }, []);

  useEffect(() => {
    if (isBackendReady) {
      setShowConnectingBanner(false);
      return;
    }
    const id = window.setTimeout(() => setShowConnectingBanner(true), 2500);
    return () => window.clearTimeout(id);
  }, [isBackendReady]);

  // After SSO, parent path (create if needed); after sign-out, join chooser.
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      setJoinPath("parent");
    } else {
      setJoinPath("choose");
    }
  }, [isAuthenticated, authLoading]);

  // Empty account → open create so parents aren’t hunting for the CTA.
  useEffect(() => {
    if (isAuthenticated && myVillages !== undefined && myVillages.length === 0) {
      setShowCreateForm(true);
    }
  }, [isAuthenticated, myVillages]);

  const savedTracker = useQuery(
    api.trackers.getBySecret,
    lastVisited ? { secretLink: lastVisited.secretLink } : "skip"
  );

  const pendingOpenTracker = useQuery(
    api.trackers.getBySecret,
    pendingOpenSecret ? { secretLink: pendingOpenSecret } : "skip"
  );

  // Landing is a transition: owners and returning caregivers go straight in.
  // Stay here only for first-time create, sign-in, or paste-a-link.
  // Never auto-open a bare village secret — that hits personal-invite and loops
  // via "Go to home". Caregivers need lastVisited (or stored) invite token.
  useEffect(() => {
    if (authLoading) return;
    if (createdTracker || shareUrl) return;
    if (pendingOpenSecret) return;
    if (showCreateForm && isAuthenticated) return;

    if (isAuthenticated) {
      if (myVillages === undefined) return;
      if (myVillages.length > 0) {
        const last = lastVisited?.secretLink;
        const match = last
          ? myVillages.find((v) => v.secretLink === last)
          : undefined;
        const target = match ?? myVillages[0]!;
        // Owners enter as admin via viewerIsOwner — do not carry a guest invite.
        router.replace(trackerPath(target.secretLink));
        return;
      }
      // Signed in, no owned village: caregiver return path with invite only.
      const invite = resolveLastVisitedInvite(lastVisited);
      if (lastVisited && invite) {
        if (savedTracker === undefined) return;
        if (savedTracker === null) {
          clearLastVisitedTracker();
          setLastVisited(null);
          return;
        }
        router.replace(trackerPath(lastVisited.secretLink, invite));
        return;
      }
      if (lastVisited) {
        clearLastVisitedTracker();
        setLastVisited(null);
      }
      return;
    }

    // Guest / caregiver: only auto-enter when we have a personal invite.
    const invite = resolveLastVisitedInvite(lastVisited);
    if (!lastVisited || !invite) {
      if (lastVisited && !invite) {
        clearLastVisitedTracker();
        setLastVisited(null);
      }
      return;
    }
    if (savedTracker === undefined) return;
    if (savedTracker === null) {
      clearLastVisitedTracker();
      setLastVisited(null);
      return;
    }
    router.replace(trackerPath(lastVisited.secretLink, invite));
  }, [
    authLoading,
    createdTracker,
    shareUrl,
    showCreateForm,
    pendingOpenSecret,
    isAuthenticated,
    myVillages,
    lastVisited,
    savedTracker,
    router,
  ]);

  useEffect(() => {
    if (!pendingOpenSecret) return;
    if (pendingOpenTracker === undefined) return;

    if (pendingOpenTracker === null) {
      setError(t("openExistingNotFound"));
      setPendingOpenSecret(null);
      setPendingOpenInvite(null);
      return;
    }

    saveLastVisitedTracker(
      pendingOpenSecret,
      pendingOpenTracker.babyName ?? undefined,
      pendingOpenInvite
    );
    setLastVisited(
      getLastVisitedTracker() ?? {
        secretLink: pendingOpenSecret,
        inviteToken: pendingOpenInvite ?? undefined,
        babyName: pendingOpenTracker.babyName ?? undefined,
        visitedAt: Date.now(),
      }
    );
    const invite = pendingOpenInvite;
    setPendingOpenSecret(null);
    setPendingOpenInvite(null);
    router.push(trackerPath(pendingOpenSecret, invite));
  }, [pendingOpenSecret, pendingOpenInvite, pendingOpenTracker, router, t]);

  const addCaregiverRow = () => {
    setCaregivers((prev) => [...prev, { name: "", role: "caregiver" }]);
  };

  const removeCaregiverRow = (index: number) => {
    setCaregivers((prev) => {
      const target = prev[index];
      if (target?.role === "admin") {
        const adminCount = prev.filter((c) => c.role === "admin").length;
        if (adminCount <= 1) return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateCaregiverName = (index: number, name: string) => {
    setCaregivers((prev) => {
      const updated = [...prev];
      const current = updated[index];
      if (!current) return prev;
      updated[index] = { ...current, name };
      // Keep first row as the labeled admin caregiver for the lock screen.
      if (!updated.some((c) => c.role === "admin") && updated[0]) {
        updated[0] = { ...updated[0], role: "admin" };
      }
      return updated;
    });
  };

  const handleSignIn = async (provider: "apple" | "google") => {
    setError(null);
    setSigningInProvider(provider);
    try {
      await signInWithOAuth(signIn, provider);
    } catch (err) {
      console.error("Sign-in failed:", err);
      const raw = err instanceof Error ? err.message : String(err);
      const invalidClient =
        /invalid_client|invalid client|client_id/i.test(raw) ||
        /AUTH_GOOGLE|AUTH_APPLE/i.test(raw);
      setError(
        invalidClient
          ? t("signInInvalidClient")
          : raw || "Sign-in failed. Try again."
      );
    } finally {
      setSigningInProvider(null);
    }
  };

  const handleCreateTracker = async () => {
    if (!isAuthenticated) {
      setError(t("createRequiresSignIn"));
      return;
    }

    const drafts = caregivers
      .map((c) => ({ name: c.name.trim(), role: c.role }))
      .filter((c) => c.name.length > 0);

    if (drafts.length === 0) {
      setError(t("addOneCaregiver"));
      return;
    }

    const normalized = drafts.map((c, i) => ({
      name: c.name,
      role: (i === 0 || c.role === "admin" ? "admin" : "caregiver") as
        | "admin"
        | "caregiver",
    }));
    // Exactly one labeled admin: the creator’s first name.
    const withSingleAdmin = normalized.map((c, i) => ({
      ...c,
      role: (i === 0 ? "admin" : "caregiver") as "admin" | "caregiver",
    }));

    setError(null);
    setIsCreating(true);

    try {
      const trimmedBabyName = babyName.trim();
      const result = await Promise.race([
        createTracker({
          caregivers: withSingleAdmin,
          babyName: trimmedBabyName || undefined,
          timezone: detectDeviceTimezone(),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Could not reach the server. Run `npx convex dev` in a separate terminal, then try again."
              )
            );
          }, CREATE_TIMEOUT_MS);
        }),
      ]);

      const url = `${window.location.origin}/tracker/${result.secretLink}`;
      saveLastVisitedTracker(result.secretLink, trimmedBabyName || undefined);
      setCreatedTracker({
        secretLink: result.secretLink,
        url,
        babyName: trimmedBabyName || undefined,
      });
    } catch (err) {
      console.error("Failed to create tracker:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create tracker. Please try again."
      );
      setIsCreating(false);
    }
  };

  if (createdTracker) {
    return (
      <TrackerCreatedSuccess
        trackerUrl={createdTracker.url}
        babyName={createdTracker.babyName}
        onContinue={() => router.push(`/tracker/${createdTracker.secretLink}`)}
      />
    );
  }

  if (shareUrl) {
    return (
      <TrackerCreatedSuccess
        trackerUrl={shareUrl.url}
        babyName={shareUrl.babyName}
        continueLabel={t("closeShare")}
        onContinue={() => setShareUrl(null)}
      />
    );
  }

  const guestInvite = resolveLastVisitedInvite(lastVisited);
  const canContinue =
    !!lastVisited &&
    !!guestInvite &&
    savedTracker !== undefined &&
    savedTracker !== null;

  const isOpening = pendingOpenSecret !== null;

  /** True while we know we’ll auto-enter a village (transition UI). */
  const isAutoEntering =
    !createdTracker &&
    !shareUrl &&
    !pendingOpenSecret &&
    !authLoading &&
    ((isAuthenticated &&
      myVillages !== undefined &&
      myVillages.length > 0 &&
      !showCreateForm) ||
      (isAuthenticated &&
        myVillages !== undefined &&
        myVillages.length === 0 &&
        canContinue &&
        !showCreateForm) ||
      (!isAuthenticated && canContinue));

  const handleOpenExisting = () => {
    setError(null);
    const parsed = parseTrackerLinkInput(openLinkInput);
    if (!parsed) {
      setError(t("openExistingInvalid"));
      return;
    }
    setPendingOpenInvite(parsed.inviteToken ?? null);
    setPendingOpenSecret(parsed.secretLink);
  };

  const goBackToChoices = () => {
    setError(null);
    setJoinPath("choose");
  };

  const pathChoiceButtonClass =
    "w-full rounded-xl border border-border bg-background/60 px-4 py-4 text-left transition-colors hover:bg-primary-light/40 disabled:opacity-50 disabled:hover:bg-background/60";

  const renderCaregiverPaste = () => (
    <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
      {!isAuthenticated && (
        <button
          type="button"
          onClick={goBackToChoices}
          className="text-sm font-semibold text-primary"
        >
          {t("backToChoices")}
        </button>
      )}
      <h2 className="text-sm font-semibold text-foreground">
        {t("openExistingTitle")}
      </h2>
      <input
        type="text"
        value={openLinkInput}
        onChange={(e) => setOpenLinkInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleOpenExisting();
          }
        }}
        placeholder={t("openExistingPlaceholder")}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="input-field font-mono text-sm"
        disabled={isOpening}
      />
      <button
        type="button"
        onClick={handleOpenExisting}
        disabled={isOpening || !openLinkInput.trim()}
        className="btn-primary"
      >
        {isOpening ? t("openingTracker") : t("openExistingButton")}
      </button>
      <p className="text-xs text-muted text-center">{t("noLoginRequired")}</p>
    </div>
  );

  const renderSignIn = () => (
    <div className="rounded-xl border border-border p-4 space-y-3">
      {!isAuthenticated && joinPath === "parent" && (
        <button
          type="button"
          onClick={goBackToChoices}
          className="text-sm font-semibold text-primary"
        >
          {t("backToChoices")}
        </button>
      )}
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("signInToCreate")}
        </h2>
        <p className="text-sm text-muted mt-1">{t("signInHint")}</p>
      </div>
      <EmailPasswordForm
        disabled={signingInProvider !== null}
        defaultFlow="signUp"
      />
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">{t("orContinueWith")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={() => void handleSignIn("apple")}
        disabled={signingInProvider !== null}
        className="w-full rounded-xl bg-[#111] text-white font-semibold py-3 px-4 disabled:opacity-50"
      >
        {signingInProvider === "apple" ? t("signingIn") : t("signInWithApple")}
      </button>
      <button
        type="button"
        onClick={() => void handleSignIn("google")}
        disabled={signingInProvider !== null}
        className="w-full rounded-xl border border-border bg-surface font-semibold py-3 px-4 text-foreground disabled:opacity-50"
      >
        {signingInProvider === "google"
          ? t("signingIn")
          : t("signInWithGoogle")}
      </button>
    </div>
  );

  const renderJoinChoices = () => (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground text-center">
        {t("howAreYouJoining")}
      </h2>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setJoinPath("caregiver");
        }}
        className={pathChoiceButtonClass}
      >
        <p className="text-sm font-semibold text-foreground">
          {t("joinPathCaregiver")}
        </p>
        <p className="text-sm text-muted mt-1">{t("joinPathCaregiverDesc")}</p>
      </button>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setJoinPath("parent");
        }}
        className={pathChoiceButtonClass}
      >
        <p className="text-sm font-semibold text-foreground">
          {t("joinPathParent")}
        </p>
        <p className="text-sm text-muted mt-1">{t("joinPathParentDesc")}</p>
      </button>
    </div>
  );

  const renderCreateForm = () => (
    <div className="space-y-6 border-t border-border pt-6">
      <div>
        <h2 className="text-sm font-medium text-muted mb-4">
          {t("babyNameOptional")}
        </h2>
        <input
          type="text"
          value={babyName}
          onChange={(e) => setBabyName(e.target.value)}
          placeholder={t("babyNamePlaceholder")}
          className="input-field"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted">{t("caregivers")}</h2>
          <button
            type="button"
            onClick={addCaregiverRow}
            className="text-sm font-semibold text-primary"
          >
            + {t("addCaregiver")}
          </button>
        </div>
        <div className="space-y-3">
          {caregivers.map((caregiver, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={caregiver.name}
                  onChange={(e) => updateCaregiverName(index, e.target.value)}
                  placeholder={t("caregiverPlaceholder")}
                  className="input-field pr-16"
                />
                {caregiver.role === "admin" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                    {t("admin")}
                  </span>
                )}
              </div>
              {caregivers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCaregiverRow(index)}
                  className={cn(
                    "shrink-0 w-10 h-10 rounded-lg text-muted hover:bg-[#f3f1ee] hover:text-foreground transition-colors",
                    caregiver.role === "admin" &&
                      caregivers.filter((c) => c.role === "admin").length <=
                        1 &&
                      "opacity-30 pointer-events-none"
                  )}
                  aria-label={t("remove")}
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCreateTracker}
        disabled={isCreating}
        className="btn-primary"
      >
        {isCreating ? t("creating") : t("createTracker")}
      </button>

      <div className="text-sm text-muted text-center">
        <p>{t("shareLinkHint")}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh overflow-y-auto overscroll-y-contain bg-background px-4 pb-8 relative safe-top">
      {/* Below status bar / battery — not absolute under the Dynamic Island */}
      <div className="mx-auto max-w-md w-full flex items-center justify-end gap-2 pt-3 pb-3">
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-semibold text-muted hover:text-foreground px-2 py-2 min-h-11"
          >
            {t("signOut")}
          </button>
        )}
        <LanguageToggle />
      </div>
      {/* Top-aligned so the keyboard can push the focused caregiver field into view */}
      <div className="mx-auto max-w-md w-full bg-surface rounded-2xl card-shadow p-8 border border-border">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary-light flex items-center justify-center mx-auto mb-4 p-2">
            <IconReminders size={40} className="rounded-lg object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {t("appName")}
          </h1>
          <p className="text-muted">{t("appTagline")}</p>
        </div>

        <div className="space-y-6">
          {showConnectingBanner && !isBackendReady && (
            <div className="rounded-2xl border border-warning/40 bg-warning-light px-4 py-3 text-sm text-[#9a7b2a]">
              {t("connecting")}
              {process.env.NODE_ENV === "development" && (
                <>
                  {" "}
                  {t("connectingDevHint")}{" "}
                  <code className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded">
                    npx convex dev
                  </code>{" "}
                  {t("inAnotherTerminal")}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-sm text-[#9b3b3b]">
              {error}
            </div>
          )}

          {authLoading || isAutoEntering ? (
            <p className="text-sm text-muted text-center">
              {isAutoEntering ? t("openingTracker") : t("loadingTracker")}
            </p>
          ) : isAuthenticated &&
            myVillages !== undefined &&
            myVillages.length === 0 ? (
            /* First-time parent create, or signed-in caregiver paste invite. */
            <>
              <p className="text-sm text-muted text-center">
                {t("myVillagesEmpty")}
              </p>
              {showCreateForm ? (
                renderCreateForm()
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="btn-primary"
                >
                  {t("createVillageTitle")}
                </button>
              )}
              {!showCreateForm && renderCaregiverPaste()}
            </>
          ) : joinPath === "caregiver" ? (
            renderCaregiverPaste()
          ) : joinPath === "parent" ? (
            renderSignIn()
          ) : (
            renderJoinChoices()
          )}
        </div>
      </div>
    </div>
  );
}
