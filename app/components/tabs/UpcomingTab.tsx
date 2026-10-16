"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { AppointmentModal } from "../modals/AppointmentModal";
import { formatDateTime } from "@/app/lib/utils";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import { IconCalendar, IconLocation } from "../icons";

interface UpcomingTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function UpcomingTab({ trackerId, selectedCaregiver }: UpcomingTabProps) {
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [now] = useState(() => Date.now());
  const upcoming = useQuery(api.appointments.getUpcoming, { trackerId, now });
  const removeAppointment = useMutation(api.appointments.remove);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="section-label mb-0">{t("upcomingAppointments")}</p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-sm font-semibold text-primary"
        >
          + {t("add")}
        </button>
      </div>

      {!upcoming ? (
        <div className="text-center text-muted py-8 text-sm">{t("loading")}</div>
      ) : upcoming.length === 0 ? (
        <div className="bg-primary-light rounded-xl p-8 text-center card-shadow border border-primary/10">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mx-auto mb-3 text-primary">
            <IconCalendar size={24} />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t("noAppointments")}
          </h3>
          <p className="text-sm text-muted mb-4">{t("appointmentsHint")}</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-primary w-auto inline-block px-6"
          >
            {t("addAppointment")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((appointment) => (
            <div
              key={appointment._id}
              className="bg-surface border border-border rounded-2xl p-4 card-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {appointment.title}
                  </h3>
                  <p className="text-sm text-primary mt-1 font-medium">
                    {formatDateTime(appointment.date)}
                  </p>
                  {appointment.location && (
                    <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
                      <IconLocation size={14} className="shrink-0" />
                      {appointment.location}
                    </p>
                  )}
                  {appointment.notes && (
                    <p className="text-sm text-muted mt-2">{appointment.notes}</p>
                  )}
                  <p className="text-xs text-muted mt-2">
                    {t("addedBy", { name: appointment.caregiverName })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    removeAppointment({ appointmentId: appointment._id })
                  }
                  className="text-xs text-[#c45c5c] hover:underline shrink-0"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AppointmentModal
          trackerId={trackerId}
          selectedCaregiver={selectedCaregiver}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
