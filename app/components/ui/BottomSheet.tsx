"use client";

import { useEffect, type ReactNode } from "react";
import { IconClose } from "../icons";

interface BottomSheetProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ title, icon, onClose, children }: BottomSheetProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] overlay-enter"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="relative w-full max-w-lg bg-surface rounded-t-2xl sheet-shadow max-h-[min(92vh,100dvh)] flex flex-col sheet-enter safe-bottom min-w-0"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2 shrink-0 border-b border-border/60 min-w-0">
          <h2
            id="sheet-title"
            className="text-base font-semibold text-foreground flex items-center gap-2.5 min-w-0 truncate"
          >
            {icon && (
              <span className="text-primary flex items-center shrink-0">{icon}</span>
            )}
            <span className="truncate">{title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-muted hover:bg-[#f3f1ee] hover:text-foreground transition-colors touch-manipulation"
            aria-label="Close sheet"
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
