"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRef, useState } from "react";
import { NotePhoto } from "./NotePhoto";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconCamera } from "./icons";

interface EntryPhotoFieldProps {
  secretLink: string;
  selectedCaregiver: string;
  photoIds: Id<"_storage">[];
  onChange: (ids: Id<"_storage">[]) => void;
  maxPhotos?: number;
}

export function EntryPhotoField({
  secretLink,
  selectedCaregiver,
  photoIds,
  onChange,
  maxPhotos = 4,
}: EntryPhotoFieldProps) {
  const { t } = useLanguage();
  const generateUploadUrl = useMutation(api.trackers.generateEntryPhotoUploadUrl);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }
    if (photoIds.length >= maxPhotos) {
      return;
    }

    setIsUploading(true);
    try {
      const postUrl = await generateUploadUrl({
        secretLink,
        actingCaregiverName: selectedCaregiver,
      });
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) {
        throw new Error(`Upload failed (${result.status})`);
      }
      const { storageId } = (await result.json()) as {
        storageId: Id<"_storage">;
      };
      if (!storageId) {
        throw new Error("Upload response missing storageId");
      }
      onChange([...photoIds, storageId]);
    } catch (error) {
      console.error("Failed to upload photo:", error);
      alert(t("uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadPhoto(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="label-field">{t("photosOptional")}</label>
      {photoIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photoIds.map((id) => (
            <NotePhoto
              key={id}
              storageId={id}
              onRemove={() => onChange(photoIds.filter((p) => p !== id))}
              removeLabel={t("removePhoto")}
            />
          ))}
        </div>
      )}
      {photoIds.length < maxPhotos && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={isUploading}
            onChange={onFilePicked}
          />
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={onFilePicked}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 border border-border rounded-xl text-sm text-muted hover:bg-background transition-colors disabled:opacity-50"
          >
            <IconCamera size={16} />
            {isUploading ? t("uploading") : t("takePhoto")}
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => albumInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 border border-border rounded-xl text-sm text-muted hover:bg-background transition-colors disabled:opacity-50"
          >
            {isUploading ? t("uploading") : t("chooseFromAlbum")}
          </button>
        </div>
      )}
    </div>
  );
}
