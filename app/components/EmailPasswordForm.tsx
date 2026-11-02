"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState, type FormEvent } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";

type Flow = "signIn" | "signUp";

interface EmailPasswordFormProps {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export function EmailPasswordForm({
  disabled = false,
  onBusyChange,
}: EmailPasswordFormProps) {
  const { t } = useLanguage();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<Flow>("signIn");
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
    const trimmedEmail = email.trim();
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
      const formData = new FormData();
      formData.set("email", trimmedEmail);
      formData.set("password", password);
      formData.set("flow", flow);
      await signIn("password", formData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("emailPasswordFailed");
      // Convex Auth often returns opaque InvalidAccountId / InvalidSecret.
      if (/invalidaccountid|invalidsecret|invalid password|could not/i.test(message)) {
        setError(
          flow === "signIn"
            ? t("emailPasswordSignInFailed")
            : t("emailPasswordSignUpFailed")
        );
      } else {
        setError(message);
      }
    } finally {
      setBusyState(false);
    }
  };

  const locked = disabled || busy;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {flow === "signIn" ? t("signInWithEmail") : t("signUpWithEmail")}
        </p>
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            setFlow((prev) => (prev === "signIn" ? "signUp" : "signIn"));
            setError(null);
          }}
          className="text-xs font-semibold text-primary disabled:opacity-50"
        >
          {flow === "signIn" ? t("needAccount") : t("haveAccount")}
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

      {error ? (
        <p className="text-sm text-[#9b3b3b] break-words">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={locked}
        className="w-full rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold py-3 px-4 disabled:opacity-50"
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
