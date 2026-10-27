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
  getLastVisitedTracker,
  parseTrackerSecretInput,
  saveLastVisitedTracker,
} from "@/app/lib/trackerStorage";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { cn } from "@/app/lib/utils";
import { IconReminders } from "@/app/components/icons";
import { LanguageToggle } from "@/app/components/LanguageToggle";
import { signInWithOAuth } from "@/app/lib/oauthSignIn";

const CREATE_TIMEOUT_MS = 15_000;
const DEFAULT_ADMIN = "Mommy (Shuting)";

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
    { name: DEFAULT_ADMIN, role: "admin" },
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [joinPath, setJoinPath] = useState<JoinPath>("choose");
  const [showSomethingElse, setShowSomethingElse] = useState(false);

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

  // After SSO, land on parent manage/create; after sign-out, return to join chooser.
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      setJoinPath("parent");
      setShowSomethingElse(false);
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

  useEffect(() => {
    if (!pendingOpenSecret) return;
    if (pendingOpenTracker === undefined) return;

    if (pendingOpenTracker === null) {
      setError(t("openExistingNotFound"));
      setPendingOpenSecret(null);
      return;
    }

    saveLastVisitedTracker(
      pendingOpenSecret,
      pendingOpenTracker.babyName ?? undefined
    );
    setLastVisited(
      getLastVisitedTracker() ?? {
        secretLink: pendingOpenSecret,
        babyName: pendingOpenTracker.babyName ?? undefined,
        visitedAt: Date.now(),
      }
    );
    setPendingOpenSecret(null);
    router.push(`/tracker/${pendingOpenSecret}`);
  }, [pendingOpenSecret, pendingOpenTracker, router, t]);

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
      const isDefaultAdmin =
        index === 0 &&
        current.role === "admin" &&
        current.name === DEFAULT_ADMIN;
      updated[index] = {
        name,
        role:
          name.trim().toLowerCase() === DEFAULT_ADMIN.toLowerCase() ||
          isDefaultAdmin
            ? "admin"
            : current.role,
      };
      const hasAdmin = updated.some(
        (c) =>
          c.role === "admin" ||
          c.name.trim().toLowerCase() === DEFAULT_ADMIN.toLowerCase()
      );
      if (!hasAdmin && updated[0]) {
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

    const hasNamedAdmin = drafts.some(
      (c) => c.name.toLowerCase() === DEFAULT_ADMIN.toLowerCase()
    );
    const normalized = drafts.map((c, i) => ({
      name: c.name,
      role:
        c.name.toLowerCase() === DEFAULT_ADMIN.toLowerCase() ||
        (!hasNamedAdmin && i === 0)
          ? ("admin" as const)
          : ("caregiver" as const),
    }));

    setError(null);
    setIsCreating(true);

    try {
      const trimmedBabyName = babyName.trim();
      const result = await Promise.race([
        createTracker({
          caregivers: normalized,
          babyName: trimmedBabyName || undefined,
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

  const continueLabel =
    savedTracker?.babyName ?? lastVisited?.babyName ?? t("yourTracker");

  const canContinue =
    lastVisited && savedTracker !== undefined && savedTracker !== null;

  const isOpening = pendingOpenSecret !== null;

  const handleOpenExisting = () => {
    setError(null);
    const secret = parseTrackerSecretInput(openLinkInput);
    if (!secret) {
      setError(t("openExistingInvalid"));
      return;
    }
    setPendingOpenSecret(secret);
  };

  const goBackToChoices = () => {
    setError(null);
    setJoinPath("choose");
    setShowSomethingElse(false);
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
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("openExistingTitle")}
        </h2>
        <p className="text-sm text-muted mt-1">{t("openExistingHint")}</p>
      </div>
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
      <p className="text-xs text-muted">{t("openExistingAdvancedHint")}</p>
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
        disabled={!canContinue}
        onClick={() => {
          if (!lastVisited || !canContinue) return;
          router.push(`/tracker/${lastVisited.secretLink}`);
        }}
        className={pathChoiceButtonClass}
      >
        <p className="text-sm font-semibold text-foreground">
          {t("joinPathReturning")}
        </p>
        <p className="text-sm text-muted mt-1">
          {canContinue
            ? t("joinPathReturningDesc")
            : t("joinPathReturningUnavailable")}
        </p>
      </button>
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

  const renderMyVillages = () => {
    if (myVillages === undefined) {
      return (
        <p className="text-sm text-muted text-center">{t("loadingTracker")}</p>
      );
    }

    if (myVillages.length === 0) {
      return (
        <p className="text-sm text-muted text-center">{t("myVillagesEmpty")}</p>
      );
    }

    // One village: a single primary open action for the admin.
    if (myVillages.length === 1) {
      const village = myVillages[0]!;
      const label = village.babyName?.trim() || t("yourTracker");
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/tracker/${village.secretLink}`;
      return (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/tracker/${village.secretLink}`)}
            className="btn-primary w-full text-left px-4 py-4"
          >
            <p className="text-xs font-medium text-white/80 mb-1">
              {t("openVillage")}
            </p>
            <p className="text-base font-semibold text-white">{label}</p>
          </button>
          <button
            type="button"
            onClick={() =>
              setShareUrl({
                url,
                babyName: village.babyName ?? undefined,
              })
            }
            className="w-full text-sm font-semibold text-muted py-2"
          >
            {t("shareVillage")}
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("myVillages")}
        </h2>
        <ul className="space-y-2">
          {myVillages.map((village) => {
            const label = village.babyName?.trim() || t("yourTracker");
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/tracker/${village.secretLink}`;
            return (
              <li
                key={village._id}
                className="rounded-xl bg-background/80 border border-border px-3 py-3"
              >
                <p className="font-semibold text-foreground text-sm mb-2">
                  {label}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/tracker/${village.secretLink}`)
                    }
                    className="flex-1 rounded-lg bg-primary text-white text-sm font-semibold py-2"
                  >
                    {t("openVillage")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShareUrl({
                        url,
                        babyName: village.babyName ?? undefined,
                      })
                    }
                    className="flex-1 rounded-lg border border-border text-sm font-semibold py-2 text-foreground"
                  >
                    {t("shareVillage")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-semibold text-muted hover:text-foreground px-2 py-1"
          >
            {t("signOut")}
          </button>
        )}
        <LanguageToggle />
      </div>
      <div className="max-w-md w-full bg-surface rounded-2xl card-shadow p-8 border border-border">
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

          {/* Signed-in admin: one village entry (My villages), not Continue + Open */}
          {isAuthenticated ? (
            <>
              {renderMyVillages()}
              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                className="w-full text-sm font-semibold text-primary py-2"
              >
                {showCreateForm ? t("cancel") : t("createVillageTitle")}
              </button>
              {showCreateForm && renderCreateForm()}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSomethingElse((v) => !v)}
                  className="w-full text-sm font-semibold text-muted py-1"
                >
                  {t("somethingElse")}
                </button>
                {showSomethingElse && (
                  <div className="mt-3">{renderCaregiverPaste()}</div>
                )}
              </div>
            </>
          ) : authLoading ? (
            <p className="text-sm text-muted text-center">{t("loadingTracker")}</p>
          ) : canContinue && joinPath === "choose" && !showSomethingElse ? (
            /* Returning guest: Continue first, other paths tucked away */
            <>
              <button
                type="button"
                onClick={() =>
                  router.push(`/tracker/${lastVisited!.secretLink}`)
                }
                className="btn-primary w-full text-left px-4 py-4"
              >
                <p className="text-xs font-medium text-white/80 mb-1">
                  {t("continue")}
                </p>
                <p className="text-base font-semibold text-white">
                  {t("continueWith", { name: continueLabel })}
                </p>
                <p className="text-sm text-white/75 mt-1">{t("continueHint")}</p>
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => setShowSomethingElse(true)}
                  className="w-full text-sm font-semibold text-muted py-2"
                >
                  {t("somethingElse")}
                </button>
              </div>
            </>
          ) : canContinue && joinPath === "choose" && showSomethingElse ? (
            <>
              <button
                type="button"
                onClick={() => setShowSomethingElse(false)}
                className="text-sm font-semibold text-primary"
              >
                {t("backToChoices")}
              </button>
              <div className="space-y-3">
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
                  <p className="text-sm text-muted mt-1">
                    {t("joinPathCaregiverDesc")}
                  </p>
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
                  <p className="text-sm text-muted mt-1">
                    {t("joinPathParentDesc")}
                  </p>
                </button>
              </div>
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
