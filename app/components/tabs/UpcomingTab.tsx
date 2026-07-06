"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { AppointmentModal } from "../modals/AppointmentModal";
import { formatDateTime } from "@/app/lib/utils";

interface UpcomingTabProps {
  trackerId: Id<"trackers">;
  selectedCaregiver: string;
}

export function UpcomingTab({ trackerId, selectedCaregiver }: UpcomingTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [now] = useState(() => Date.now());
  const upcoming = useQuery(api.appointments.getUpcoming, { trackerId, now });
  const removeAppointment = useMutation(api.appointments.remove);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm text-gray-600">Upcoming appointments</h2>
        <button
          onClick={() => setShowModal(true)}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          + Add
        </button>
      </div>

      {!upcoming ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : upcoming.length === 0 ? (
        <div className="bg-blue-50 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No upcoming appointments
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Track pediatrician visits and vaccinations
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Add Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((appointment) => (
            <div
              key={appointment._id}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {appointment.title}
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {formatDateTime(appointment.date)}
                  </p>
                  {appointment.location && (
                    <p className="text-sm text-gray-600 mt-1">
                      📍 {appointment.location}
                    </p>
                  )}
                  {appointment.notes && (
                    <p className="text-sm text-gray-600 mt-2">
                      {appointment.notes}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Added by {appointment.caregiverName}
                  </p>
                </div>
                <button
                  onClick={() =>
                    removeAppointment({ appointmentId: appointment._id })
                  }
                  className="text-xs text-red-600 hover:underline shrink-0"
                >
                  Delete
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
