"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconCheck } from "./icons";

interface TrackerCreatedSuccessProps {
  trackerUrl: string;
  babyName?: string;
  onContinue: () => void;
  /** Defaults to open tracker CTA; use for re-share “Done”. */
  continueLabel?: string;
  /** When true, primary CTA emphasizes inviting caregivers (post-create). */
  emphasizeShare?: boolean;
}

export function TrackerCreatedSuccess({
  trackerUrl,
  babyName,
  onContinue,
  continueLabel,
  emphasizeShare = true,
}: TrackerCreatedSuccessProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = trackerUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const primaryLabel = emphasizeShare
    ? copied
      ? t("copied")
      : t("copyLinkAndText")
    : copied
      ? t("copied")
      : t("copyLink");

  const secondaryLabel = continueLabel ?? t("openMyVillage");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-surface rounded-2xl card-shadow p-8 border border-border">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-secondary-light flex items-center justify-center mx-auto mb-4 text-secondary">
            <IconCheck size={28} />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {babyName
              ? t("trackerReady", { name: babyName })
              : t("trackerCreated")}
          </h1>
          <p className="text-muted text-sm">{t("shareWithCaregivers")}</p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-xl border border-border">
            <QRCodeSVG
              value={trackerUrl}
              size={160}
              bgColor="#ffffff"
              fgColor="#2c2a28"
              level="M"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-primary-light/60 rounded-xl px-4 py-3 text-sm text-foreground break-all font-mono">
            {trackerUrl}
          </div>

          <button type="button" onClick={handleCopy} className="btn-primary w-full">
            {primaryLabel}
          </button>

          <button
            type="button"
            onClick={onContinue}
            className="w-full py-3.5 px-4 rounded-xl font-medium text-primary bg-primary-light hover:bg-primary-light/80 transition-colors"
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
