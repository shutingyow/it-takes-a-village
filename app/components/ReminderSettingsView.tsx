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
  normalizeReminderSchedule,
  type ReminderMode,
  type ScheduleSlot,
  type ScheduleSlotKind,
} from "@/convex/lib/clockSchedule";
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
import { BottomSheet } from "./ui/BottomSheet";
import { IconPlus } from "./icons";
import { ScheduleGuideList } from "./ScheduleGuideList";

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
  reminderMode?: ReminderMode;
  reminderSchedule?: { slots: ScheduleSlot[] };
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

type SlotDraft = {
  id: string | null;
  time: string;
  label: string;
  note: string;
  kind?: ScheduleSlotKind;
};

function notifyRemindersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("deviceRemindersChanged"));
}

function newSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Fill missing labels on legacy kind-only rows using the current locale. */
function hydrateScheduleLabels(
  slots: ScheduleSlot[],
  kindLabels: Record<ScheduleSlotKind, string>
): ScheduleSlot[] {
  return slots.map((slot) => {
    if (slot.label?.trim()) return slot;
    if (slot.kind) return { ...slot, label: kindLabels[slot.kind] };
    return slot;
  });
}

function defaultDraftTime(): string {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  return `${hour}:00`;
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

function ModeChoice({
  mode,
  onChange,
  intervalLabel,
  scheduleLabel,
  intervalDesc,
  scheduleDesc,
}: {
  mode: ReminderMode;
  onChange: (mode: ReminderMode) => void;
  intervalLabel: string;
  scheduleLabel: string;
  intervalDesc: string;
  scheduleDesc: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          { id: "interval" as const, label: intervalLabel, desc: intervalDesc },
          { id: "schedule" as const, label: scheduleLabel, desc: scheduleDesc },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-xl px-3 py-2.5 text-left border ${
            mode === opt.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-[#faf6f2] text-foreground"
          }`}
        >
          <p className="text-sm font-semibold">{opt.label}</p>
          <p className="text-xs text-muted mt-0.5 leading-snug">{opt.desc}</p>
        </button>
      ))}
    </div>
  );
}

function ScheduleSlotSheet({
  draft,
  onChange,
  onClose,
  onSave,
  onDelete,
  error,
  labels,
}: {
  draft: SlotDraft;
  onChange: (next: SlotDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  error?: string | null;
  labels: {
    titleAdd: string;
    titleEdit: string;
    time: string;
    activity: string;
    activityPlaceholder: string;
    note: string;
    notePlaceholder: string;
    categoryHelp: string;
    remindNone: string;
    kindFeed: string;
    kindNap: string;
    kindPump: string;
    save: string;
    remove: string;
  };
}) {
  const kinds: Array<{ id: ScheduleSlotKind | ""; label: string }> = [
    { id: "", label: labels.remindNone },
    { id: "feed", label: labels.kindFeed },
    { id: "nap", label: labels.kindNap },
    { id: "pump", label: labels.kindPump },
  ];

  const applyKind = (value: ScheduleSlotKind | "") => {
    if (!value) {
      onChange({ ...draft, kind: undefined });
      return;
    }
    const kindLabel =
      value === "feed"
        ? labels.kindFeed
        : value === "nap"
          ? labels.kindNap
          : labels.kindPump;
    onChange({
      ...draft,
      kind: value,
      label: draft.label.trim() ? draft.label : kindLabel,
    });
  };

  return (
    <BottomSheet
      title={draft.id ? labels.titleEdit : labels.titleAdd}
      onClose={onClose}
    >
      <div className="pt-3 space-y-3">
        {error ? (
          <div className="rounded-xl border border-[#e8b4b4] bg-[#fdf0f0] px-3 py-2 text-sm text-[#9b3b3b]">
            {error}
          </div>
        ) : null}
        <div>
          <label className="label-field">{labels.time}</label>
          <input
            type="time"
            value={draft.time}
            onChange={(e) => onChange({ ...draft, time: e.target.value })}
            className="input-field font-semibold tabular-nums"
            aria-label={labels.time}
          />
        </div>
        <div>
          <label className="label-field">{labels.activity}</label>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            maxLength={80}
            placeholder={labels.activityPlaceholder}
            className="input-field font-semibold"
            aria-label={labels.activity}
          />
        </div>
        <div>
          <label className="label-field">{labels.note}</label>
          <input
            type="text"
            value={draft.note}
            onChange={(e) => onChange({ ...draft, note: e.target.value })}
            maxLength={80}
            placeholder={labels.notePlaceholder}
            className="input-field text-sm"
            aria-label={labels.note}
          />
        </div>
        <div>
          <p className="text-xs text-muted mb-2 leading-snug">
            {labels.categoryHelp}
          </p>
          <div className="flex flex-wrap gap-2">
            {kinds.map((opt) => {
              const selected = (draft.kind ?? "") === opt.id;
              return (
                <button
                  key={opt.id || "none"}
                  type="button"
                  onClick={() => applyKind(opt.id)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold border ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-[#faf6f2] text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" onClick={onSave} className="btn-primary w-full">
          {labels.save}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded-xl border border-[#e8b4b4] bg-[#fdf0f0] px-3 py-2.5 text-sm font-semibold text-[#9b3b3b]"
          >
            {labels.remove}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function DayScheduleCalendar({
  slots,
  onChange,
  labels,
}: {
  slots: ScheduleSlot[];
  onChange: (slots: ScheduleSlot[]) => void;
  labels: {
    empty: string;
    add: string;
    titleAdd: string;
    titleEdit: string;
    time: string;
    activity: string;
    activityPlaceholder: string;
    note: string;
    notePlaceholder: string;
    categoryHelp: string;
    remindNone: string;
    kindFeed: string;
    kindNap: string;
    kindPump: string;
    save: string;
    remove: string;
    needTimeAndLabel: string;
    guideHint: string;
    dayLabel: string;
    nightLabel: string;
    nowLabel: string;
    activityFallback: string;
  };
}) {
  const [draft, setDraft] = useState<SlotDraft | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const openAdd = () => {
    setSheetError(null);
    setDraft({
      id: null,
      time: defaultDraftTime(),
      label: "",
      note: "",
    });
  };

  const openEdit = (slot: ScheduleSlot) => {
    setSheetError(null);
    setDraft({
      id: slot.id,
      time: slot.time,
      label: slot.label ?? "",
      note: slot.note ?? "",
      kind: slot.kind,
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.time.trim() || !draft.label.trim()) {
      setSheetError(labels.needTimeAndLabel);
      return;
    }
    const nextSlot: ScheduleSlot = {
      id: draft.id ?? newSlotId(),
      time: draft.time,
      label: draft.label.trim(),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      ...(draft.kind ? { kind: draft.kind } : {}),
    };
    if (draft.id) {
      onChange(
        slots.map((slot) => (slot.id === draft.id ? nextSlot : slot))
      );
    } else {
      onChange([...slots, nextSlot]);
    }
    setDraft(null);
    setSheetError(null);
  };

  const deleteDraft = () => {
    if (!draft?.id) return;
    onChange(slots.filter((slot) => slot.id !== draft.id));
    setDraft(null);
    setSheetError(null);
  };

  return (
    <div className="relative rounded-2xl border border-border bg-beige-light/40 overflow-hidden">
      <div className="max-h-[min(58vh,560px)] overflow-y-auto overscroll-contain px-2.5 pt-2.5 pb-16">
        <ScheduleGuideList
          slots={slots}
          emptyLabel={labels.empty}
          guideHint={labels.guideHint}
          dayLabel={labels.dayLabel}
          nightLabel={labels.nightLabel}
          nowLabel={labels.nowLabel}
          kindLabels={{
            feed: labels.kindFeed,
            nap: labels.kindNap,
            pump: labels.kindPump,
          }}
          activityFallback={labels.activityFallback}
          onSlotClick={openEdit}
        />
      </div>

      <button
        type="button"
        onClick={openAdd}
        className="absolute bottom-3 right-3 z-20 size-12 rounded-2xl bg-primary text-white shadow-[0_4px_16px_var(--shadow-sheet)] flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
        aria-label={labels.add}
        title={labels.add}
      >
        <IconPlus size={22} className="text-white" />
      </button>

      {draft && (
        <ScheduleSlotSheet
          draft={draft}
          onChange={setDraft}
          onClose={() => {
            setDraft(null);
            setSheetError(null);
          }}
          onSave={saveDraft}
          onDelete={draft.id ? deleteDraft : undefined}
          error={sheetError}
          labels={{
            titleAdd: labels.titleAdd,
            titleEdit: labels.titleEdit,
            time: labels.time,
            activity: labels.activity,
            activityPlaceholder: labels.activityPlaceholder,
            note: labels.note,
            notePlaceholder: labels.notePlaceholder,
            categoryHelp: labels.categoryHelp,
            remindNone: labels.remindNone,
            kindFeed: labels.kindFeed,
            kindNap: labels.kindNap,
            kindPump: labels.kindPump,
            save: labels.save,
            remove: labels.remove,
          }}
        />
      )}
    </div>
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
  reminderMode: initialMode,
  reminderSchedule: initialSchedule,
  pumpSchedule: initialPump,
  onBack,
}: ReminderSettingsViewProps) {
  const { t } = useLanguage();
  const updateSettings = useMutation(api.trackers.updateReminderSettings);

  const [reminderMode, setReminderMode] = useState<ReminderMode>(
    initialMode === "schedule" ? "schedule" : "interval"
  );
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>(() =>
    hydrateScheduleLabels(
      normalizeReminderSchedule(initialSchedule ?? { slots: [] }).slots,
      {
        feed: t("reminderScheduleKindFeed"),
        nap: t("reminderScheduleKindNap"),
        pump: t("reminderScheduleKindPump"),
      }
    )
  );

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
  const [notifStatus, setNotifStatus] =
    useState<NotifPermission>("unsupported");
  const [notifBusy, setNotifBusy] = useState(false);
  const [liveFeed, setLiveFeed] = useState(true);
  const [livePump, setLivePump] = useState(false);
  const [liveNap, setLiveNap] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mode = getReminderDeliveryMode();
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

  const handleModeChange = (mode: ReminderMode) => {
    setReminderMode(mode);
  };

  const calendarLabels = {
    empty: t("reminderScheduleEmpty"),
    add: t("reminderScheduleAdd"),
    titleAdd: t("reminderScheduleAddEntry"),
    titleEdit: t("reminderScheduleEditEntry"),
    time: t("reminderScheduleTime"),
    activity: t("reminderScheduleActivity"),
    activityPlaceholder: t("reminderScheduleActivityPlaceholder"),
    note: t("reminderScheduleNote"),
    notePlaceholder: t("reminderScheduleNotePlaceholder"),
    categoryHelp: t("reminderScheduleCategoryHelp"),
    remindNone: t("reminderScheduleRemindNone"),
    kindFeed: t("reminderScheduleKindFeed"),
    kindNap: t("reminderScheduleKindNap"),
    kindPump: t("reminderScheduleKindPump"),
    save: t("reminderScheduleSaveEntry"),
    remove: t("remove"),
    needTimeAndLabel: t("reminderScheduleNeedTimeAndLabel"),
    guideHint: t("whatsDueGuideHint"),
    dayLabel: t("reminderSchedulePeriodDay"),
    nightLabel: t("reminderSchedulePeriodNight"),
    nowLabel: t("scheduleNowLine"),
    activityFallback: t("reminderScheduleActivity"),
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
        reminderMode === "interval" &&
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
        reminderMode === "interval" &&
        pumpMode === "interval" &&
        (isNaN(intervalParsed) || intervalParsed < 0.5 || intervalParsed > 24)
      ) {
        throw new Error("Invalid pump interval");
      }

      if (reminderMode === "schedule") {
        const incomplete = scheduleSlots.some(
          (s) => !s.time.trim() || !(s.label?.trim() ?? "")
        );
        if (incomplete) {
          throw new Error(t("reminderScheduleNeedTimeAndLabel"));
        }
      }
      const normalizedSchedule = normalizeReminderSchedule({
        slots: scheduleSlots,
      });

      const scheduleHas = (kind: ScheduleSlotKind) =>
        normalizedSchedule.slots.some((s) => s.kind === kind);

      // Schedule mode: kinds on calendar entries drive due logic — no separate
      // feed/nap/pump reminder toggles.
      const effectiveFeedEnabled =
        reminderMode === "schedule" ? scheduleHas("feed") : feedEnabled;
      const effectiveNapEnabled =
        reminderMode === "schedule" ? scheduleHas("nap") : napEnabled;
      const effectivePumpEnabled =
        reminderMode === "schedule" ? scheduleHas("pump") : pumpEnabled;

      const times =
        reminderMode === "schedule"
          ? normalizePumpTimes(
              normalizedSchedule.slots
                .filter((s: ScheduleSlot) => s.kind === "pump")
                .map((s: ScheduleSlot) => s.time)
            )
          : normalizePumpTimes(pumpTimes);
      if (
        reminderMode === "interval" &&
        pumpMode === "fixed" &&
        pumpEnabled &&
        times.length === 0
      ) {
        throw new Error("Add at least one pump time");
      }

      await updateSettings({
        secretLink,
        actingCaregiverName: selectedCaregiver,
        reminderMode,
        reminderSchedule: normalizedSchedule,
        feedRemindersEnabled: effectiveFeedEnabled,
        feedIntervalHours: parsed,
        nightFeedIntervalEnabled: nightEnabled,
        nightFeedIntervalHours: nightEnabled
          ? nightParsed
          : parseFloat(nightHours) || DEFAULT_NIGHT_FEED_INTERVAL_HOURS,
        nightFeedWindowStart: nightStart,
        nightFeedWindowEnd: nightEnd,
        notifyBeforeMinutes: lead,
        napRemindersEnabled: effectiveNapEnabled,
        wakeWindowMinutes:
          !isNaN(wakeMins) && wakeMins >= 15 && wakeMins <= 240
            ? wakeMins
            : DEFAULT_WAKE_WINDOW_MINUTES,
        medicationReminders: [],
        pumpSchedule: {
          enabled: effectivePumpEnabled,
          times: times.length > 0 ? times : [...DEFAULT_PUMP_TIMES],
          amountMl,
          timezone: pumpTimezone,
          mode: reminderMode === "schedule" ? "fixed" : pumpMode,
          intervalHours:
            pumpMode === "interval"
              ? intervalParsed
              : parseFloat(pumpIntervalHours) || DEFAULT_PUMP_INTERVAL_HOURS,
        },
      });
      setScheduleSlots(normalizedSchedule.slots);
      if (reminderMode === "schedule") {
        setFeedEnabled(effectiveFeedEnabled);
        setNapEnabled(effectiveNapEnabled);
        setPumpEnabled(effectivePumpEnabled);
      }
      if (times.length > 0) setPumpTimes(times);
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
    const times =
      reminderMode === "schedule"
        ? normalizePumpTimes(
            scheduleSlots
              .filter((s) => s.kind === "pump")
              .map((s) => s.time)
          )
        : normalizePumpTimes(pumpTimes);
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

  const scheduleHasPump = scheduleSlots.some((s) => s.kind === "pump");

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
          {t("reminderDeliveryTitle")}
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
          <p className="text-sm font-semibold text-foreground mb-3">
            {t("liveActivityTimers")}
          </p>
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
        <p className="text-sm font-semibold text-foreground mb-1">
          {t("reminderTimingMode")}
        </p>
        <p className="text-xs text-muted mb-3 leading-snug">
          {t("reminderTimingSectionHint")}
        </p>
        <ModeChoice
          mode={reminderMode}
          onChange={handleModeChange}
          intervalLabel={t("reminderModeInterval")}
          scheduleLabel={t("reminderModeSchedule")}
          intervalDesc={t("reminderModeIntervalDesc")}
          scheduleDesc={t("reminderModeScheduleDesc")}
        />
      </div>

      {reminderMode === "schedule" ? (
        <>
          <p className="text-xs text-muted mb-2 leading-snug px-0.5">
            {t("reminderScheduleHint")}
          </p>
          <div className="mb-4">
            <DayScheduleCalendar
              slots={scheduleSlots}
              onChange={setScheduleSlots}
              labels={calendarLabels}
            />
          </div>

          {deliveryMode === "notifications" && (
            <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
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
          )}

          {deliveryMode === "notifications" && scheduleHasPump && (
            <div className="bg-surface border border-border rounded-2xl p-4 card-shadow mb-4">
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
              <button
                type="button"
                onClick={handleDownloadCalendar}
                className="w-full rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary"
              >
                {t("addPumpAlarmsToCalendar")}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
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
                  className={`input-field ${deliveryMode === "notifications" ? "mb-3" : "mb-4"}`}
                />
                {deliveryMode === "notifications" && (
                  <>
                    <label className="label-field">
                      {t("notifyBeforeMinutes")}
                    </label>
                    <select
                      value={notifyBefore}
                      onChange={(e) => setNotifyBefore(e.target.value)}
                      className="input-field mb-4"
                    >
                      {NOTIFY_BEFORE_OPTIONS.map((mins) => (
                        <option key={mins} value={String(mins)}>
                          {mins === 0
                            ? t("notifyBeforeAtDue")
                            : t("notifyBeforeOption", {
                                minutes: String(mins),
                              })}
                        </option>
                      ))}
                    </select>
                  </>
                )}

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
            {pumpEnabled && (
              <>
                {deliveryMode === "notifications" && (
                  <>
                    <label className="label-field">
                      {t("pumpDefaultAmount")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="10"
                      value={pumpAmount}
                      onChange={(e) => setPumpAmount(e.target.value)}
                      className="input-field mb-3"
                    />
                  </>
                )}

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
                    <div
                      className={`flex gap-2 min-w-0 ${deliveryMode === "notifications" ? "mb-3" : ""}`}
                    >
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
                    {deliveryMode === "notifications" && (
                      <button
                        type="button"
                        onClick={handleDownloadCalendar}
                        className="w-full rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary"
                      >
                        {t("addPumpAlarmsToCalendar")}
                      </button>
                    )}
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
        </>
      )}

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
