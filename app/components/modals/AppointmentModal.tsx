"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconCalendar } from "../icons";

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
  const { t } = useLanguage();
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
      alert(t("selectCaregiver"));
      return;
    }

    if (!title.trim()) {
      alert(t("appointmentTitleRequired"));
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
    <BottomSheet
      title={t("addAppointmentTitle")}
      icon={<IconCalendar size={20} />}
      onClose={onClose}
    >
      <div className="space-y-4 pt-2">
        <div>
          <label className="label-field">{t("title")}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-field">{t("dateTime")}</label>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-field">{t("location")}</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-field">{t("notesOptional")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("appointmentNotesPlaceholder")}
            className="textarea-field"
            rows={2}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? t("saving") : t("saveAppointment")}
        </button>
      </div>
    </BottomSheet>
  );
}
