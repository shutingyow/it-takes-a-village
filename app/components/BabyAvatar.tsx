"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { IconUser } from "./icons";

interface BabyAvatarProps {
  storageId?: Id<"_storage">;
  secretLink: string;
  actingCaregiverName: string;
  alt: string;
  size?: "sm" | "md" | "lg";
}

export function BabyAvatar({
  storageId,
  secretLink,
  actingCaregiverName,
  alt,
  size = "md",
}: BabyAvatarProps) {
  const url = useQuery(
    api.notes.getPhotoUrl,
    storageId ? { secretLink, actingCaregiverName, storageId } : "skip"
  );

  const sizeClass =
    size === "sm" ? "w-10 h-10" : size === "lg" ? "w-full h-full" : "w-full h-full";
  const iconSize = size === "sm" ? 20 : size === "lg" ? 40 : 28;

  if (storageId && url === undefined) {
    return (
      <div
        className={`${sizeClass} bg-beige-light animate-pulse rounded-full`}
      />
    );
  }

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className={`${sizeClass} object-cover rounded-full`}
      />
    );
  }

  return <IconUser size={iconSize} className="text-muted/60" />;
}
