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
  DEFAULT_NOTIFY_BEFORE_MINUTES,
  getNotificationPermission,
  isNativePlatform,
  requestNotificationPermission,
  type NotifPermission,
} from "@/app/lib/deviceNotifications";
import {
  getLiveActivityKindEnabled,
  setLiveActivityKindEnabled,
  type LiveActivityKind,
} from "@/app/lib/feedLiveActivity";
import {
  getReminderDeliveryMode,
  setReminderDeliveryMode,
  type ReminderDeliveryMode,
} from "@/app/lib/reminderDelivery";
import {
  DEFAULT_NIGHT_FEED_END,
  DEFAULT_NIGHT_FEED_INTERVAL_HOURS,
  DEFAULT_NIGHT_FEED_START,
} from "@/convex/lib/feedSchedule";

const NOTIFY_BEFORE_OPTIONS = [0, 5, 10, 15, 20, 30] as const;
const DEFAULT_WAKE_WINDOW_MINUTES = 90;

interface ReminderSettingsViewProps {
  secretLink: string;
  selectedCaregiver: string;
  babyName?: string;
  feedIntervalHours?: number;
  nightFeedIntervalEnabled?: boolean;
  nightFeedIntervalHours?: number;
  nightFeedWindowStart?: string;
  nightFeedWindowEnd?: string;
  notifyBeforeMinutes?: number;
  feedRemindersEnabled?: boolean;
  wakeWindowMinutes?: number;
  napRemindersEnabled?: boolean;
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

type PumpMode = "fixed" | "interval";

function notifyRemindersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("deviceRemindersChanged"));
}

function ReminderToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 mb-3">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary shrink-0"
      />
    </label>
  );
}

export function ReminderSettingsView({
  secretLink,
  selectedCaregiver,
  babyName,
  feedIntervalHours: initialFeedHours,
  nightFeedIntervalEnabled: initialNightEnabled,
  nightFeedIntervalHours: initialNightHours,
  nightFeedWindowStart: initialNightStart,
  nightFeedWindowEnd: initialNightEnd,
  notifyBeforeMinutes: initialNotifyBefore,
  feedRemindersEnabled: initialFeedEnabled,
  wakeWindowMinutes: initialWakeWindow,
  napRemindersEnabled: initialNapEnabled,
  pumpSchedule: initialPump,
  onBack,
}: ReminderSettingsViewProps) {
  const { t } = useLanguage();
  const updateSettings = useMutation(api.trackers.updateReminderSettings);

  const [feedEnabled, setFeedEnabled] = useState(initialFeedEnabled ?? true);
  const [feedHours, setFeedHours] = useState(String(initialFeedHours ?? 2.5));
  const [nightEnabled, setNightEnabled] = useState(
    initialNightEnabled ?? false
  );
  const [nightHours, setNightHours] = useState(
    String(initialNightHours ?? DEFAULT_NIGHT_FEED_INTERVAL_HOURS)
  );
  const [nightStart, setNightStart] = useState(
    initialNightStart ?? DEFAULT_NIGHT_FEED_START
  );
  const [nightEnd, setNightEnd] = useState(
    initialNightEnd ?? DEFAULT_NIGHT_FEED_END
  );
  const [notifyBefore, setNotifyBefore] = useState(
    String(initialNotifyBefore ?? DEFAULT_NOTIFY_BEFORE_MINUTES)
  );
  const [napEnabled, setNapEnabled] = useState(initialNapEnabled ?? true);
  const [wakeWindow, setWakeWindow] = useState(
    String(initialWakeWindow ?? DEFAULT_WAKE_WINDOW_MINUTES)
  );

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

  const [deliveryMode, setDeliveryMode] =
    useState<ReminderDeliveryMode>("off");
  const [notifStatus, setNotifStatus] = useState<NotifPermission>("unsupported");
  const [notifBusy, setNotifBusy] = useState(false);
  const [liveFeed, setLiveFeed] = useState(true);
  const [livePump, setLivePump] = useState(false);
  const [liveNap, setLiveNap] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mode = getReminderDeliveryMode();
    // Lock screen timers are native-only; fall back on web.
    if (mode === "timer" && !isNativePlatform()) {
      mode = "off";
    }
    setDeliveryMode(mode);
    setLiveFeed(getLiveActivityKindEnabled("last-feed"));
    setLivePump(getLiveActivityKindEnabled("last-pump"));
    setLiveNap(getLiveActivityKindEnabled("last-nap"));
    void getNotificationPermission().then(setNotifStatus);
  }, []);

  const setLiveKind = (kind: LiveActivityKind, next: boolean) => {
    setLiveActivityKindEnabled(kind, next);
    if (kind === "last-feed") setLiveFeed(next);
    if (kind === "last-pump") setLivePump(next);
    if (kind === "last-nap") setLiveNap(next);
    notifyRemindersChanged();
  };

  const handleSetDeliveryMode = async (mode: ReminderDeliveryMode) => {
    setNotifBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "notifications") {
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
      }

      await setReminderDeliveryMode(mode);
      setDeliveryMode(mode);
      setLiveFeed(getLiveActivityKindEnabled("last-feed"));
      setLivePump(getLiveActivityKindEnabled("last-pump"));
      setLiveNap(getLiveActivityKindEnabled("last-nap"));
      setMessage(
        mode === "timer"
          ? t("reminderDeliveryTimerOn")
          : mode === "notifications"
            ? t("reminderDeliveryNotificationsOn")
            : t("reminderDeliveryOff")
      );
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
      const nightParsed = parseFloat(nightHours);
      if (
        nightEnabled &&
        (isNaN(nightParsed) || nightParsed < 0.5 || nightParsed > 24)
      ) {
        throw new Error("Invalid night feed interval");
      }
      if (nightEnabled && (!nightStart || !nightEnd)) {
        throw new Error("Night window times required");
      }
      const lead = parseInt(notifyBefore, 10);
      if (!(NOTIFY_BEFORE_OPTIONS as readonly number[]).includes(lead)) {
        throw new Error("Invalid notify-before minutes");
      }
      const wakeMins = parseInt(wakeWindow, 10);
      if (
        napEnabled &&
        (isNaN(wakeMins) || wakeMins < 15 || wakeMins > 240)
      ) {
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
      if (pumpMode === "fixed" && pumpEnabled && times.length === 0) {
        throw new Error("Add at least one pump time");
      }
      await updateSettings({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        feedRemindersEnabled: feedEnabled,
        feedIntervalHours: parsed,
        nightFeedIntervalEnabled: nightEnabled,
        nightFeedIntervalHours: nightEnabled
          ? nightParsed
          : parseFloat(nightHours) || DEFAULT_NIGHT_FEED_INTERVAL_HOURS,
        nightFeedWindowStart: nightStart,
        nightFeedWindowEnd: nightEnd,
        notifyBeforeMinutes: lead,
        napRemindersEnabled: napEnabled,
        wakeWindowMinutes:
          !isNaN(wakeMins) && wakeMins >= 15 && wakeMins <= 240
            ? wakeMins
            : DEFAULT_WAKE_WINDOW_MINUTES,
        medicationReminders: [],
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
        <p className="text-sm font-semibold text-foreground mb-1">
          {t("reminderDeliveryTitle")}
        </p>
        <p className="text-xs text-muted mb-3 leading-snug">
          {t("reminderDeliveryHint")}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {(
            [
              {
                id: "timer" as const,
                label: t("reminderDeliveryTimer"),
                desc: t("reminderDeliveryTimerDesc"),
                nativeOnly: true,
              },
              {
                id: "notifications" as const,
                label: t("reminderDeliveryNotifications"),
                desc: t("reminderDeliveryNotificationsDesc"),
                nativeOnly: false,
              },
              {
                id: "off" as const,
                label: t("reminderDeliveryOffLabel"),
                desc: t("reminderDeliveryOffDesc"),
                nativeOnly: false,
              },
            ] as const
          )
            .filter((opt) => !opt.nativeOnly || isNativePlatform())
            .map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={notifBusy}
                onClick={() => void handleSetDeliveryMode(opt.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left disabled:opacity-50 ${
                  deliveryMode === opt.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-[#faf6f2]"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">
                  {opt.label}
                </p>
                <p className="text-xs text-muted mt-0.5 leading-snug">
                  {opt.desc}
                </p>
              </button>
            ))}
        </div>
      </div>

      {deliveryMode === "timer" && isNativePlatform() && (
        <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
          <p className="text-sm font-semibold text-foreground mb-1">
            {t("liveActivityTimers")}
          </p>
          <p className="text-xs text-muted mb-3">{t("liveActivityTimersDesc")}</p>
          <ReminderToggleRow
            label={t("liveActivityToggleFeed")}
            checked={liveFeed}
            onChange={(next) => setLiveKind("last-feed", next)}
          />
          <ReminderToggleRow
            label={t("liveActivityTogglePump")}
            checked={livePump}
            onChange={(next) => setLiveKind("last-pump", next)}
          />
          <ReminderToggleRow
            label={t("liveActivityToggleNap")}
            checked={liveNap}
            onChange={(next) => setLiveKind("last-nap", next)}
          />
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <ReminderToggleRow
          label={t("feedReminders")}
          checked={feedEnabled}
          onChange={setFeedEnabled}
        />
        {feedEnabled && (
          <>
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
              className="input-field mb-4"
            >
              {NOTIFY_BEFORE_OPTIONS.map((mins) => (
                <option key={mins} value={String(mins)}>
                  {mins === 0
                    ? t("notifyBeforeAtDue")
                    : t("notifyBeforeOption", { minutes: String(mins) })}
                </option>
              ))}
            </select>

            <div className="border-t border-border pt-3">
              <ReminderToggleRow
                label={t("nightFeedReminders")}
                checked={nightEnabled}
                onChange={setNightEnabled}
              />
              <p className="text-xs text-muted mb-3 leading-snug">
                {t("nightFeedRemindersHint")}
              </p>
              {nightEnabled && (
                <>
                  <label className="label-field">
                    {t("nightFeedIntervalHours")}
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={nightHours}
                    onChange={(e) => setNightHours(e.target.value)}
                    className="input-field mb-3"
                  />
                  <p className="text-xs font-medium text-muted mb-2">
                    {t("nightFeedWindow")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 min-w-0">
                    <div className="min-w-0">
                      <label className="label-field">
                        {t("nightFeedWindowStart")}
                      </label>
                      <input
                        type="time"
                        value={nightStart}
                        onChange={(e) => setNightStart(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="label-field">
                        {t("nightFeedWindowEnd")}
                      </label>
                      <input
                        type="time"
                        value={nightEnd}
                        onChange={(e) => setNightEnd(e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <ReminderToggleRow
          label={t("pumpReminders")}
          checked={pumpEnabled}
          onChange={setPumpEnabled}
        />
        <p className="text-xs text-muted mb-3 leading-snug">
          {t("pumpRemindersOptionalHint")}
        </p>
        {pumpEnabled && (
          <>
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
                  {t("pumpTimesLabel")}
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
                <div className="flex gap-2 mb-3 min-w-0">
                  <input
                    type="time"
                    value={newPumpTime}
                    onChange={(e) => setNewPumpTime(e.target.value)}
                    className="input-field flex-1 min-w-0"
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
          </>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
        <ReminderToggleRow
          label={t("napReminders")}
          checked={napEnabled}
          onChange={setNapEnabled}
        />
        {napEnabled && (
          <>
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
          </>
        )}
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
