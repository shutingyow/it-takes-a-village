"use client";

import { useEffect, useState } from "react";

/**
 * Blank screen while auth / redirect is decided. Matches the splash colour so
 * cold start does not flash copy; a spinner only appears if it drags on.
 */
export function BootBlank() {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShowSpinner(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      {showSpinner && (
        <div className="w-8 h-8 rounded-full border-2 border-accent-diaper border-t-transparent animate-spin" />
      )}
    </div>
  );
}
