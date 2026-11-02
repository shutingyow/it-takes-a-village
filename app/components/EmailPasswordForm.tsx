"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState, type FormEvent } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n/en";
import { cn } from "@/app/lib/utils";

type Flow = "signIn" | "signUp";

interface EmailPasswordFormProps {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  /** Prefer create-account first (e.g. new parents). */
  defaultFlow?: Flow;
}

function friendlyAuthErrorKey(raw: string, flow: Flow): TranslationKey {
  const msg = raw.toLowerCase();
  if (
    msg.includes("invalid credentials") ||
    msg.includes("invalidaccountid") ||
    msg.includes("invalidsecret") ||
    msg.includes("invalid password") ||
    msg.includes("server error") ||
    msg.includes("[convex")
  ) {
    return flow === "signIn"
      ? "emailPasswordSignInFailed"
      : "emailPasswordSignUpFailed";
  }
  if (msg.includes("already") || msg.includes("exists")) {
    return "emailPasswordAlreadyExists";
  }
  if (msg.includes("invalid email")) {
    return "emailPasswordInvalidEmail";
  }
  return "emailPasswordFailed";
}

export function EmailPasswordForm({
  disabled = false,
  onBusyChange,
  defaultFlow = "signIn",
}: EmailPasswordFormProps) {
  const { t } = useLanguage();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<Flow>(defaultFlow);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBusyState = (next: boolean) => {
    setBusy(next);
    onBusyChange?.(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError(t("emailPasswordRequired"));
      return;
    }
    if (flow === "signUp" && password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setBusyState(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("email", trimmedEmail);
      formData.set("password", password);
      formData.set("flow", flow);
      await signIn("password", formData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("emailPasswordFailed");
      setError(t(friendlyAuthErrorKey(message, flow)));
    } finally {
      setBusyState(false);
    }
  };

  const locked = disabled || busy;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f3ede7] p-1">
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            setFlow("signIn");
            setError(null);
          }}
          className={cn(
            "rounded-lg py-2.5 text-sm font-semibold touch-manipulation min-h-11",
            flow === "signIn"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted"
          )}
        >
          {t("signInTab")}
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            setFlow("signUp");
            setError(null);
          }}
          className={cn(
            "rounded-lg py-2.5 text-sm font-semibold touch-manipulation min-h-11",
            flow === "signUp"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted"
          )}
        >
          {t("createAccountTab")}
        </button>
      </div>

      <label className="block">
        <span className="label-field">{t("emailLabel")}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={locked}
          className="input-field"
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="block">
        <span className="label-field">{t("passwordLabel")}</span>
        <input
          type="password"
          name="password"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={locked}
          className="input-field"
          placeholder={t("passwordPlaceholder")}
          minLength={flow === "signUp" ? 8 : undefined}
          required
        />
      </label>

      {/* Convex Auth Password provider reads this from FormData */}
      <input type="hidden" name="flow" value={flow} />

      {error ? (
        <p className="text-sm text-[#9b3b3b] break-words" role="alert">
          {error}
        </p>
      ) : null}

      {flow === "signUp" ? (
        <p className="text-xs text-muted leading-snug">{t("signUpHint")}</p>
      ) : null}

      <button
        type="submit"
        disabled={locked}
        className="w-full rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold py-3 px-4 disabled:opacity-50 min-h-11"
      >
        {busy
          ? t("signingIn")
          : flow === "signIn"
            ? t("signInWithEmail")
            : t("createAccount")}
      </button>
    </form>
  );
}
