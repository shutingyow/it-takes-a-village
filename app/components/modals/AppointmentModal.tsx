"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

interface AppointmentModalProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
  onClose: () => void;
}

function toDatetimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function AppointmentModal({
  trackerId,
  selectedCaregiver,
  onClose,
}: AppointmentModalProps) {
  const createAppointment = useMutation(api.appointments.create);
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState(
    toDatetimeLocalValue(Date.now() + 24 * 60 * 60 * 1000)
  );
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCaregiver) {
      alert("Please select a caregiver");
      return;
    }

    if (!title.trim()) {
      alert("Please enter an appointment title");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAppointment({
        trackerId,
        caregiverName: selectedCaregiver,
        title: title.trim(),
        date: new Date(dateTime).getTime(),
        location: location || undefined,
        notes: notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create appointment:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">📅 Add Appointment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="2-month checkup, vaccination..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date & time:
            </label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location (optional):
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Pediatrician office..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bring vaccination card..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              rows={2}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "SAVE APPOINTMENT"}
          </button>
        </div>
      </div>
    </div>
  );
}
