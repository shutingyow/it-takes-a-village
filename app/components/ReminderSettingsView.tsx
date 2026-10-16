"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/lib/i18n/LanguageProvider";
import {
  DEFAULT_PUMP_AMOUNT_ML,
  DEFAULT_PUMP_TIMEZONE,
  DEFAULT_PUMP_TIMES,
  downloadPumpScheduleIcs,
  normalizePumpTimes,
} from "@/app/lib/pumpCalendar";
import { DEFAULT_PUMP_INTERVAL_HOURS } from "@/convex/lib/pumpSchedule";
import {
  cancelAllDueNotifications,
  DEFAULT_NOTIFY_BEFORE_MINUTES,
  getDeviceRemindersEnabled,
  getNotificationPermission,
  requestNotificationPermission,
  setDeviceRemindersEnabled,
  type NotifPermission,
} from "@/app/lib/deviceNotifications";

const NOTIFY_BEFORE_OPTIONS = [0, 5, 10, 15, 20, 30] as const;
const DEFAULT_WAKE_WINDOW_MINUTES = 90;

interface ReminderSettingsViewProps {
  secretLink: string;
  selectedCaregiver: string;
  babyName?: string;
  feedIntervalHours?: number;
  notifyBeforeMinutes?: number;
  wakeWindowMinutes?: number;
  medicationReminders?: Array<{
    name: string;
    intervalHours: number;
    lastLoggedAt?: number;
  }>;
  pumpSchedule?: {
    enabled: boolean;
    times: string[];
    amountMl?: number;
    timezone?: string;
    mode?: "fixed" | "interval";
    intervalHours?: number;
  };
  onBack: () => void;
}

type MedReminder = {
  name: string;
  intervalHours: number;
};

type PumpMode = "fixed" | "interval";

function notifyRemindersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("deviceRemindersChanged"));
}

export function ReminderSettingsView({
  secretLink,
  selectedCaregiver,
  babyName,
  feedIntervalHours: initialFeedHours,
  notifyBeforeMinutes: initialNotifyBefore,
  wakeWindowMinutes: initialWakeWindow,
  medicationReminders: initialMeds,
  pumpSchedule: initialPump,
  onBack,
}: ReminderSettingsViewProps) {
  const { t } = useLanguage();
  const updateSettings = useMutation(api.trackers.updateReminderSettings);

  const [feedHours, setFeedHours] = useState(String(initialFeedHours ?? 2.5));
  const [notifyBefore, setNotifyBefore] = useState(
    String(initialNotifyBefore ?? DEFAULT_NOTIFY_BEFORE_MINUTES)
  );
  const [wakeWindow, setWakeWindow] = useState(
    String(initialWakeWindow ?? DEFAULT_WAKE_WINDOW_MINUTES)
  );
  const [meds, setMeds] = useState<MedReminder[]>(
    initialMeds?.map((m) => ({ name: m.name, intervalHours: m.intervalHours })) ??
      []
  );
  const [newMedName, setNewMedName] = useState("");
  const [newMedHours, setNewMedHours] = useState("12");

  const [pumpEnabled, setPumpEnabled] = useState(initialPump?.enabled ?? false);
  const [pumpMode, setPumpMode] = useState<PumpMode>(
    initialPump?.mode ?? "fixed"
  );
  const [pumpIntervalHours, setPumpIntervalHours] = useState(
    String(initialPump?.intervalHours ?? DEFAULT_PUMP_INTERVAL_HOURS)
  );
  const [pumpTimes, setPumpTimes] = useState<string[]>(
    initialPump?.times?.length
      ? [...initialPump.times]
      : [...DEFAULT_PUMP_TIMES]
  );
  const [pumpAmount, setPumpAmount] = useState(
    String(initialPump?.amountMl ?? DEFAULT_PUMP_AMOUNT_ML)
  );
  const [newPumpTime, setNewPumpTime] = useState("");
  const [pumpTimezone] = useState(
    initialPump?.timezone ?? DEFAULT_PUMP_TIMEZONE
  );

  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [notifStatus, setNotifStatus] = useState<NotifPermission>("unsupported");
  const [notifBusy, setNotifBusy] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDeviceEnabled(getDeviceRemindersEnabled());
    void getNotificationPermission().then(setNotifStatus);
  }, []);

  const handleToggleDeviceNotifications = async () => {
    setNotifBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (deviceEnabled) {
        setDeviceRemindersEnabled(false);
        setDeviceEnabled(false);
        await cancelAllDueNotifications();
        notifyRemindersChanged();
        setMessage(t("disableDeviceNotifications"));
        return;
      }

      let permission = notifStatus;
      if (permission !== "granted") {
        permission = await requestNotificationPermission();
        setNotifStatus(permission);
      }
      if (permission !== "granted") {
        setError(
          permission === "unsupported"
            ? t("deviceNotificationsUnsupported")
            : t("deviceNotificationsDenied")
        );
        return;
      }

      setDeviceRemindersEnabled(true);
      setDeviceEnabled(true);
      notifyRemindersChanged();
      setMessage(t("deviceNotificationsEnabled"));
    } catch {
      setError(t("deviceNotificationsDenied"));
    } finally {
      setNotifBusy(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const parsed = parseFloat(feedHours);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error("Invalid feed interval");
      }
      const lead = parseInt(notifyBefore, 10);
      if (!(NOTIFY_BEFORE_OPTIONS as readonly number[]).includes(lead)) {
        throw new Error("Invalid notify-before minutes");
      }
      const wakeMins = parseInt(wakeWindow, 10);
      if (isNaN(wakeMins) || wakeMins < 15 || wakeMins > 240) {
        throw new Error("Wake window must be between 15 and 240 minutes");
      }
      const amountMl = parseFloat(pumpAmount);
      if (isNaN(amountMl) || amountMl < 0) {
        throw new Error("Invalid pump amount");
      }
      const intervalParsed = parseFloat(pumpIntervalHours);
      if (
        pumpMode === "interval" &&
        (isNaN(intervalParsed) || intervalParsed < 0.5 || intervalParsed > 24)
      ) {
        throw new Error("Invalid pump interval");
      }
      const times = normalizePumpTimes(pumpTimes);
      if (pumpMode === "fixed" && times.length === 0) {
        throw new Error("Add at least one pump time");
      }
      await updateSettings({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        feedIntervalHours: parsed,
        notifyBeforeMinutes: lead,
        wakeWindowMinutes: wakeMins,
        medicationReminders: meds,
        pumpSchedule: {
          enabled: pumpEnabled,
          times: times.length > 0 ? times : [...DEFAULT_PUMP_TIMES],
          amountMl,
          timezone: pumpTimezone,
          mode: pumpMode,
          intervalHours:
            pumpMode === "interval"
              ? intervalParsed
              : parseFloat(pumpIntervalHours) || DEFAULT_PUMP_INTERVAL_HOURS,
        },
      });
      setPumpTimes(times.length > 0 ? times : [...DEFAULT_PUMP_TIMES]);
      setMessage(t("settingsSaved"));
      notifyRemindersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMed = () => {
    const name = newMedName.trim();
    const hours = parseFloat(newMedHours);
    if (!name || isNaN(hours) || hours <= 0) return;
    setMeds([...meds, { name, intervalHours: hours }]);
    setNewMedName("");
    setNewMedHours("12");
  };

  const handleRemoveMed = (index: number) => {
    setMeds(meds.filter((_, i) => i !== index));
  };

  const handleAddPumpTime = () => {
    const times = normalizePumpTimes([...pumpTimes, newPumpTime]);
    if (times.length === pumpTimes.length) return;
    setPumpTimes(times);
    setNewPumpTime("");
  };

  const handleRemovePumpTime = (time: string) => {
    setPumpTimes(pumpTimes.filter((t) => t !== time));
  };

  const handleDownloadCalendar = () => {
    const times = normalizePumpTimes(pumpTimes);
    if (times.length === 0) {
      setError(t("pumpTimesRequired"));
      return;
    }
    const amountMl = parseFloat(pumpAmount);
    downloadPumpScheduleIcs(
      {
        times,
        amountMl: isNaN(amountMl) ? DEFAULT_PUMP_AMOUNT_ML : amountMl,
        timezone: pumpTimezone,
      },
      { babyName }
    );
    setMessage(t("pumpCalendarDownloaded"));
  };

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-sm font-semibold text-primary flex items-center gap-1"
      >
        {t("backToMore")}
      </button>

      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
        {t("reminderSettings")}
      </p>

      {error && (
        <div className="mb-3 rounded-xl border border-[#e8b4b4] bg-[#fdf0f0] px-3 py-2 text-sm text-[#9b3b3b]">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-3 rounded-xl border border-secondary/30 bg-secondary-light px-3 py-2 text-sm text-secondary">
          {message}
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <p className="text-sm font-semibold text-foreground mb-3">
          {t("deviceNotifications")}
        </p>
        {deviceEnabled && notifStatus === "granted" ? (
          <p className="text-xs font-medium text-secondary mb-2">
            {t("deviceNotificationsEnabled")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleToggleDeviceNotifications()}
          disabled={notifBusy || notifStatus === "unsupported"}
          className="w-full rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
        >
          {notifStatus === "unsupported"
            ? t("deviceNotificationsUnsupported")
            : deviceEnabled
              ? t("disableDeviceNotifications")
              : t("enableDeviceNotifications")}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <p className="text-sm font-semibold text-foreground mb-3">
          {t("feedReminders")}
        </p>
        <label className="label-field">{t("feedIntervalHours")}</label>
        <input
          type="number"
          min="0.5"
          max="24"
          step="0.5"
          value={feedHours}
          onChange={(e) => setFeedHours(e.target.value)}
          className="input-field mb-3"
        />
        <label className="label-field">{t("notifyBeforeMinutes")}</label>
        <select
          value={notifyBefore}
          onChange={(e) => setNotifyBefore(e.target.value)}
          className="input-field"
        >
          {NOTIFY_BEFORE_OPTIONS.map((mins) => (
            <option key={mins} value={String(mins)}>
              {mins === 0
                ? t("notifyBeforeAtDue")
                : t("notifyBeforeOption", { minutes: String(mins) })}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <p className="text-sm font-semibold text-foreground mb-3">
          {t("wakeWindowLabel")}
        </p>
        <label className="label-field">{t("wakeWindowMinutes")}</label>
        <input
          type="number"
          min="15"
          max="240"
          step="5"
          value={wakeWindow}
          onChange={(e) => setWakeWindow(e.target.value)}
          className="input-field"
        />
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-foreground">
            {t("pumpSchedule")}
          </p>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={pumpEnabled}
              onChange={(e) => setPumpEnabled(e.target.checked)}
              className="size-4 accent-primary"
            />
            {t("pumpRemindersEnabled")}
          </label>
        </div>

        <p className="text-xs font-medium text-muted mb-2">
          {t("pumpReminderMode")}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setPumpMode("fixed")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold border ${
              pumpMode === "fixed"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-[#faf6f2] text-foreground"
            }`}
          >
            {t("pumpModeFixed")}
          </button>
          <button
            type="button"
            onClick={() => setPumpMode("interval")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold border ${
              pumpMode === "interval"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-[#faf6f2] text-foreground"
            }`}
          >
            {t("pumpModeInterval")}
          </button>
        </div>

        <label className="label-field">{t("pumpDefaultAmount")}</label>
        <input
          type="number"
          min="0"
          max="1000"
          step="10"
          value={pumpAmount}
          onChange={(e) => setPumpAmount(e.target.value)}
          className="input-field mb-3"
        />

        {pumpMode === "interval" ? (
          <>
            <label className="label-field">{t("pumpIntervalHours")}</label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={pumpIntervalHours}
              onChange={(e) => setPumpIntervalHours(e.target.value)}
              className="input-field"
            />
          </>
        ) : (
          <>
            <p className="text-xs font-medium text-muted mb-2">
              {t("pumpTimesLabel")} · {pumpTimezone}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {pumpTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleRemovePumpTime(time)}
                  className="rounded-xl bg-[#faf6f2] px-3 py-1.5 text-sm font-medium text-foreground"
                  title={t("remove")}
                >
                  {time} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="time"
                value={newPumpTime}
                onChange={(e) => setNewPumpTime(e.target.value)}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={handleAddPumpTime}
                disabled={!newPumpTime}
                className="shrink-0 px-3 py-2 rounded-xl bg-secondary text-white font-semibold text-sm disabled:opacity-50"
              >
                {t("add")}
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadCalendar}
              className="w-full rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary"
            >
              {t("addPumpAlarmsToCalendar")}
            </button>
          </>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <p className="text-sm font-semibold text-foreground mb-3">
          {t("medicationReminders")}
        </p>

        {meds.length > 0 && (
          <div className="space-y-2 mb-3">
            {meds.map((med, i) => (
              <div
                key={`${med.name}-${i}`}
                className="flex items-center justify-between bg-[#faf6f2] rounded-xl px-3 py-2"
              >
                <div>
                  <span className="font-medium text-sm">{med.name}</span>
                  <span className="text-xs text-muted ml-2">
                    {t("intervalHours", { hours: String(med.intervalHours) })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMed(i)}
                  className="text-xs text-[#9b3b3b] font-medium"
                >
                  {t("remove")}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newMedName}
            onChange={(e) => setNewMedName(e.target.value)}
            placeholder={t("medNamePlaceholder")}
            className="input-field flex-1"
          />
          <input
            type="number"
            min="1"
            max="48"
            value={newMedHours}
            onChange={(e) => setNewMedHours(e.target.value)}
            className="input-field w-20"
            aria-label={t("hours")}
          />
          <button
            type="button"
            onClick={handleAddMed}
            disabled={!newMedName.trim()}
            className="shrink-0 px-3 py-2 rounded-xl bg-secondary text-white font-semibold text-sm disabled:opacity-50"
          >
            {t("add")}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full"
      >
        {saving ? t("saving") : t("saveSettings")}
      </button>
    </div>
  );
}
