"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/app/lib/utils";
import { useState } from "react";

interface NotePhotoProps {
  storageId: Id<"_storage">;
  size?: "sm" | "md";
  className?: string;
  onRemove?: () => void;
  removeLabel?: string;
}

export function NotePhoto({
  storageId,
  size = "md",
  className,
  onRemove,
  removeLabel = "Remove",
}: NotePhotoProps) {
  const url = useQuery(api.notes.getPhotoUrl, { storageId });
  const [enlarged, setEnlarged] = useState(false);

  const sizeClass = size === "sm" ? "w-12 h-12" : "w-20 h-20";

  if (url === undefined) {
    return (
      <div
        className={cn(
          sizeClass,
          "bg-[#f3ede7] rounded-lg animate-pulse",
          className
        )}
      />
    );
  }

  if (!url) {
    return null;
  }

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
          aria-label="View photo"
        >
          <img
            src={url}
            alt=""
            className={cn(
              sizeClass,
              "object-cover rounded-lg border border-border"
            )}
          />
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground/80 text-white text-xs leading-none flex items-center justify-center"
          >
            ×
          </button>
        )}
      </div>
      {enlarged && (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setEnlarged(false)}
          aria-label="Close photo"
        >
          <img
            src={url}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </button>
      )}
    </>
  );
}
