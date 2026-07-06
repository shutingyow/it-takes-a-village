"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { NotePhoto } from "../NotePhoto";
import { formatDateTime } from "@/app/lib/utils";

interface NotesTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function NotesTab({ trackerId, selectedCaregiver }: NotesTabProps) {
  const notes = useQuery(api.notes.getRecent, { trackerId, limit: 20 });
  const createNote = useMutation(api.notes.create);
  const generateUploadUrl = useMutation(api.notes.generateUploadUrl);
  const removeNote = useMutation(api.notes.remove);

  const [content, setContent] = useState("");
  const [photoIds, setPhotoIds] = useState<Id<"_storage">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
      alert("Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert("Please select a caregiver");
      return;
    }

    if (!content.trim()) {
      alert("Please enter a note");
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">📋 Handover Note</h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Baby was fussy after last feed. Tummy time went well..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
          rows={4}
        />

        {photoIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photoIds.map((id) => (
              <NotePhoto key={id} storageId={id} />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <label className="flex-1 cursor-pointer">
            <input
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
            <span className="block text-center py-2 px-4 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              {isUploading ? "Uploading..." : "📷 Add Photo"}
            </span>
          </label>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Post Note"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Recent Notes</h3>
        {!notes ? (
          <div className="text-center text-gray-500 py-4">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No handover notes yet.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note._id}
                className="bg-blue-50 border border-blue-100 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      {note.caregiverName} • {formatDateTime(note.timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeNote({ noteId: note._id })}
                    className="text-xs text-red-600 hover:underline shrink-0"
                  >
                    Delete
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
