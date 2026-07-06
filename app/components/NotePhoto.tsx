"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface NotePhotoProps {
  storageId: Id<"_storage">;
}

export function NotePhoto({ storageId }: NotePhotoProps) {
  const url = useQuery(api.notes.getPhotoUrl, { storageId });

  if (url === undefined) {
    return <div className="w-20 h-20 bg-gray-100 rounded animate-pulse" />;
  }

  if (!url) {
    return null;
  }

  return (
    <img
      src={url}
      alt="Note attachment"
      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
    />
  );
}
