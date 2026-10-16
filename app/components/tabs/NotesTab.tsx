"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useRef } from "react";
import { NotePhoto } from "../NotePhoto";
import { formatDateTime } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconCamera, IconNotes } from "../icons";

interface NotesTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function NotesTab({ trackerId, selectedCaregiver }: NotesTabProps) {
  const { t } = useLanguage();
  const notes = useQuery(api.notes.getRecent, { trackerId, limit: 20 });
  const createNote = useMutation(api.notes.create);
  const generateUploadUrl = useMutation(api.notes.generateUploadUrl);
  const removeNote = useMutation(api.notes.remove);

  const [content, setContent] = useState("");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    setIsUploading(true);
    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
      setPhotoIds((prev) => [...prev, storageId]);
    } catch (error) {
      console.error("Failed to upload photo:", error);
      alert(t("uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert(t("selectCaregiver"));
      return;
    }

    if (!content.trim()) {
      alert(t("enterNote"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createNote({
        trackerId,
        caregiverName: selectedCaregiver,
        content: content.trim(),
        photoIds,
        timestamp: Date.now(),
      });
      setContent("");
      setPhotoIds([]);
    } catch (error) {
      console.error("Failed to create note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-4 card-shadow">
        <h3 className="text-base font-medium text-foreground flex items-center gap-2">
          <IconNotes size={18} className="text-primary" />
          {t("handoverNote")}
        </h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("noteContentPlaceholder")}
          className="textarea-field"
          rows={4}
        />

        {photoIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photoIds.map((id) => (
              <NotePhoto key={id} storageId={id} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadPhoto(file);
              e.target.value = "";
            }}
          />
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadPhoto(file);
              e.target.value = "";
            }}
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
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
            className="flex-1 btn-primary py-2.5 min-w-[7rem]"
          >
            {isSubmitting ? t("saving") : t("postNote")}
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          {t("recentNotes")}
        </p>
        {!notes ? (
          <div className="text-center text-muted py-4 text-sm">{t("loading")}</div>
        ) : notes.length === 0 ? (
          <div className="text-center text-muted py-8 text-sm bg-surface rounded-2xl border border-border">
            {t("noHandoverNotes")}
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note._id}
                className="bg-secondary-light border border-secondary/20 rounded-2xl p-4 card-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <p className="text-xs text-muted mt-2">
                      {note.caregiverName} · {formatDateTime(note.timestamp)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNote({ noteId: note._id })}
                    className="text-xs text-[#c45c5c] hover:underline shrink-0"
                  >
                    {t("delete")}
                  </button>
                </div>
                {note.photoIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {note.photoIds.map((id) => (
                      <NotePhoto key={id} storageId={id} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
