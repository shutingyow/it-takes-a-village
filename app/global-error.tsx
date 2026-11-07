"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="mx-auto max-w-md p-6 font-sans">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-neutral-600">
          The error was reported so we can fix it. You can try again.
        </p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
