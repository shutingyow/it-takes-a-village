import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { nanoid } from "nanoid";
import {
  caregiverValidator,
  countAdmins,
  getCaregivers,
  getTrackerBySecret,
  migrateCaregiverNames,
  normalizeTrackerForClient,
  verifyAdmin,
  verifyCaregiver,
} from "./lib/caregivers";
import {
  DEFAULT_NIGHT_FEED_INTERVAL_HOURS,
  normalizeHhMm,
} from "./lib/feedSchedule";
import {
  DEFAULT_PUMP_AMOUNT_ML,
  DEFAULT_PUMP_INTERVAL_HOURS,
  DEFAULT_PUMP_TIMES,
  DEFAULT_PUMP_TIMEZONE,
  normalizePumpTimes,
} from "./lib/pumpSchedule";

const medicationReminderValidator = v.object({
  name: v.string(),
  intervalHours: v.number(),
  lastLoggedAt: v.optional(v.number()),
});

const pumpScheduleValidator = v.object({
  enabled: v.boolean(),
  times: v.array(v.string()),
  amountMl: v.optional(v.number()),
  timezone: v.optional(v.string()),
  mode: v.optional(v.union(v.literal("fixed"), v.literal("interval"))),
  intervalHours: v.optional(v.number()),
});

const NOTIFY_BEFORE_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

const trackerReturnValidator = v.object({
  _id: v.id("trackers"),
  _creationTime: v.number(),
  secretLink: v.string(),
  ownerUserId: v.optional(v.id("users")),
  babyName: v.optional(v.string()),
  birthDate: v.optional(v.string()),
  photoStorageId: v.optional(v.id("_storage")),
  caregivers: v.array(caregiverValidator),
  feedIntervalHours: v.optional(v.number()),
  nightFeedIntervalEnabled: v.optional(v.boolean()),
  nightFeedIntervalHours: v.optional(v.number()),
  nightFeedWindowStart: v.optional(v.string()),
  nightFeedWindowEnd: v.optional(v.string()),
  notifyBeforeMinutes: v.optional(v.number()),
  wakeWindowMinutes: v.optional(v.number()),
  medicationReminders: v.optional(v.array(medicationReminderValidator)),
  pumpSchedule: v.optional(pumpScheduleValidator),
  createdAt: v.number(),
});

const trackerClientValidator = v.object({
  ...trackerReturnValidator.fields,
  /** True when the signed-in user owns this village (SSO admin). */
  viewerIsOwner: v.boolean(),
});

// Create a new tracker with a unique secret link (signed-in admin only)
export const create = mutation({
  args: {
    caregivers: v.array(caregiverValidator),
    babyName: v.optional(v.string()),
  },
  returns: v.object({
    trackerId: v.id("trackers"),
    secretLink: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Sign in to create a village");
    }

    const caregivers = args.caregivers
      .map((c) => ({ name: c.name.trim(), role: c.role }))
      .filter((c) => c.name.length > 0);

    if (caregivers.length === 0) {
      throw new Error("Add at least one caregiver");
    }
    if (countAdmins(caregivers) === 0) {
      throw new Error("At least one admin caregiver is required");
    }

    const secretLink = nanoid(16);
    const babyName = args.babyName?.trim() || undefined;

    const trackerId = await ctx.db.insert("trackers", {
      secretLink,
      ownerUserId: userId,
      babyName,
      caregivers,
      feedIntervalHours: 2.5,
      createdAt: Date.now(),
    });

    return { trackerId, secretLink };
  },
});

/** Villages owned by the signed-in user (for home “My villages”). */
export const listMine = query({
  args: {},
  returns: v.array(trackerReturnValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const mine = await ctx.db
      .query("trackers")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
      .collect();

    return mine
      .map(normalizeTrackerForClient)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Attach an unowned (legacy) tracker to the signed-in user via secret link.
 * Safe: only when ownerUserId is missing, or already this user. Never steals.
 */
export const claim = mutation({
  args: {
    secretLink: v.string(),
  },
  returns: trackerReturnValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Sign in to add this village to your account");
    }

    const tracker = await getTrackerBySecret(ctx, args.secretLink);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    if (tracker.ownerUserId !== undefined && tracker.ownerUserId !== userId) {
      throw new Error("This village already belongs to another account");
    }

    if (tracker.ownerUserId === userId) {
      return normalizeTrackerForClient(tracker);
    }

    await ctx.db.patch(tracker._id, { ownerUserId: userId });
    const updated = await ctx.db.get(tracker._id);
    if (!updated) {
      throw new Error("Tracker not found");
    }
    return normalizeTrackerForClient(updated);
  },
});

// Migrate legacy caregiverNames to caregivers (idempotent)
export const ensureMigrated = mutation({
  args: {
    secretLink: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tracker = await getTrackerBySecret(ctx, args.secretLink);
    if (!tracker) return null;

    if (tracker.caregivers && tracker.caregivers.length > 0) {
      return null;
    }

    if (tracker.caregiverNames && tracker.caregiverNames.length > 0) {
      await ctx.db.patch(tracker._id, {
        caregivers: migrateCaregiverNames(tracker.caregiverNames),
      });
    }

    return null;
  },
});

// Get tracker by secret link
export const getBySecret = query({
  args: {
    secretLink: v.string(),
  },
  returns: v.union(trackerClientValidator, v.null()),
  handler: async (ctx, args) => {
    const tracker = await getTrackerBySecret(ctx, args.secretLink);
    if (!tracker) return null;
    const userId = await getAuthUserId(ctx);
    const viewerIsOwner = Boolean(
      userId && tracker.ownerUserId !== undefined && tracker.ownerUserId === userId
    );
    return {
      ...normalizeTrackerForClient(tracker),
      viewerIsOwner,
    };
  },
});

// Update baby name
export const updateBabyName = mutation({
  args: {
    trackerId: v.id("trackers"),
    babyName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trimmed = args.babyName.trim();
    await ctx.db.patch(args.trackerId, {
      babyName: trimmed || undefined,
    });
    return null;
  },
});

// Add a caregiver (admin only)
export const addCaregiver = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    name: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("caregiver"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker, caregivers } = await verifyAdmin(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );

    const name = args.name.trim();
    if (!name) {
      throw new Error("Caregiver name is required");
    }
    if (caregivers.some((c) => c.name === name)) {
      throw new Error("Caregiver already exists");
    }

    const role = args.role ?? "caregiver";
    await ctx.db.patch(tracker._id, {
      caregivers: [...caregivers, { name, role }],
    });
    return null;
  },
});

// Remove a caregiver (admin only; cannot remove last admin)
export const removeCaregiver = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker, caregivers } = await verifyAdmin(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );

    const target = caregivers.find((c) => c.name === args.name);
    if (!target) {
      throw new Error("Caregiver not found");
    }
    if (target.role === "admin" && countAdmins(caregivers) <= 1) {
      throw new Error("Cannot remove the last admin");
    }

    const updated = caregivers.filter((c) => c.name !== args.name);
    if (updated.length === 0) {
      throw new Error("At least one caregiver is required");
    }

    await ctx.db.patch(tracker._id, { caregivers: updated });
    return null;
  },
});

// Update reminder settings (any caregiver — family shared tracker)
export const updateReminderSettings = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    feedIntervalHours: v.optional(v.number()),
    nightFeedIntervalEnabled: v.optional(v.boolean()),
    nightFeedIntervalHours: v.optional(v.number()),
    nightFeedWindowStart: v.optional(v.string()),
    nightFeedWindowEnd: v.optional(v.string()),
    notifyBeforeMinutes: v.optional(v.number()),
    wakeWindowMinutes: v.optional(v.number()),
    medicationReminders: v.optional(
      v.array(
        v.object({
          name: v.string(),
          intervalHours: v.number(),
          lastLoggedAt: v.optional(v.number()),
        })
      )
    ),
    pumpSchedule: v.optional(pumpScheduleValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );

    const updates: {
      feedIntervalHours?: number;
      nightFeedIntervalEnabled?: boolean;
      nightFeedIntervalHours?: number;
      nightFeedWindowStart?: string;
      nightFeedWindowEnd?: string;
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
    } = {};

    if (args.feedIntervalHours !== undefined) {
      if (args.feedIntervalHours < 0.5 || args.feedIntervalHours > 24) {
        throw new Error("Feed interval must be between 0.5 and 24 hours");
      }
      updates.feedIntervalHours = args.feedIntervalHours;
    }

    if (args.nightFeedIntervalEnabled !== undefined) {
      updates.nightFeedIntervalEnabled = args.nightFeedIntervalEnabled;
    }

    if (args.nightFeedIntervalHours !== undefined) {
      if (
        args.nightFeedIntervalHours < 0.5 ||
        args.nightFeedIntervalHours > 24
      ) {
        throw new Error("Night feed interval must be between 0.5 and 24 hours");
      }
      updates.nightFeedIntervalHours = args.nightFeedIntervalHours;
    } else if (
      args.nightFeedIntervalEnabled === true &&
      tracker.nightFeedIntervalHours === undefined
    ) {
      updates.nightFeedIntervalHours = DEFAULT_NIGHT_FEED_INTERVAL_HOURS;
    }

    if (args.nightFeedWindowStart !== undefined) {
      const start = normalizeHhMm(args.nightFeedWindowStart);
      if (!start) throw new Error("Invalid night window start time");
      updates.nightFeedWindowStart = start;
    }

    if (args.nightFeedWindowEnd !== undefined) {
      const end = normalizeHhMm(args.nightFeedWindowEnd);
      if (!end) throw new Error("Invalid night window end time");
      updates.nightFeedWindowEnd = end;
    }

    if (args.notifyBeforeMinutes !== undefined) {
      if (
        !(NOTIFY_BEFORE_OPTIONS as readonly number[]).includes(
          args.notifyBeforeMinutes
        )
      ) {
        throw new Error(
          "Notify-before must be 0, 5, 10, 15, 20, or 30 minutes"
        );
      }
      updates.notifyBeforeMinutes = args.notifyBeforeMinutes;
    }

    if (args.wakeWindowMinutes !== undefined) {
      if (
        !Number.isFinite(args.wakeWindowMinutes) ||
        args.wakeWindowMinutes < 15 ||
        args.wakeWindowMinutes > 240
      ) {
        throw new Error("Wake window must be between 15 and 240 minutes");
      }
      updates.wakeWindowMinutes = Math.round(args.wakeWindowMinutes);
    }

    if (args.medicationReminders !== undefined) {
      updates.medicationReminders = args.medicationReminders
        .map((r) => ({
          name: r.name.trim(),
          intervalHours: r.intervalHours,
          lastLoggedAt: r.lastLoggedAt,
        }))
        .filter((r) => r.name.length > 0);
    }

    if (args.pumpSchedule !== undefined) {
      const mode = args.pumpSchedule.mode ?? "fixed";
      const times = normalizePumpTimes(args.pumpSchedule.times);
      if (mode === "fixed") {
        if (times.length === 0) {
          throw new Error("Add at least one pump time (HH:mm)");
        }
        if (times.length > 24) {
          throw new Error("Too many pump times (max 24)");
        }
      }
      const intervalHours =
        args.pumpSchedule.intervalHours ?? DEFAULT_PUMP_INTERVAL_HOURS;
      if (mode === "interval") {
        if (intervalHours < 0.5 || intervalHours > 24) {
          throw new Error("Pump interval must be between 0.5 and 24 hours");
        }
      }
      const amountMl = args.pumpSchedule.amountMl;
      if (
        amountMl !== undefined &&
        (amountMl < 0 || amountMl > 1000 || !Number.isFinite(amountMl))
      ) {
        throw new Error("Pump amount must be between 0 and 1000 ml");
      }
      updates.pumpSchedule = {
        enabled: args.pumpSchedule.enabled,
        times: times.length > 0 ? times : [...DEFAULT_PUMP_TIMES],
        amountMl: amountMl ?? DEFAULT_PUMP_AMOUNT_ML,
        timezone: args.pumpSchedule.timezone?.trim() || DEFAULT_PUMP_TIMEZONE,
        mode,
        intervalHours,
      };
    }

    await ctx.db.patch(tracker._id, updates);
    return null;
  },
});

function normalizeBirthDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Birth date must be YYYY-MM-DD");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1990 || year > 2100) {
    throw new Error("Birth date is out of range");
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error("Birth date is not a real calendar day");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Admin only — birth date drives age bands and Insights age labels.
export const updateBirthDate = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    birthDate: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker } = await verifyAdmin(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const birthDate = normalizeBirthDate(args.birthDate);
    await ctx.db.patch(tracker._id, { birthDate });
    return null;
  },
});

// Generate upload URL for baby photo
export const generatePhotoUploadUrl = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await verifyCaregiver(ctx, args.secretLink, args.actingCaregiverName);
    return await ctx.storage.generateUploadUrl();
  },
});

// Generate upload URL for entry photos (diaper, sleep, pump, feed)
export const generateEntryPhotoUploadUrl = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await verifyCaregiver(ctx, args.secretLink, args.actingCaregiverName);
    return await ctx.storage.generateUploadUrl();
  },
});

// Update baby photo
export const updatePhoto = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    photoStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    await ctx.db.patch(tracker._id, {
      photoStorageId: args.photoStorageId,
    });
    return null;
  },
});

// Regenerate secret link
export const regenerateSecret = mutation({
  args: {
    trackerId: v.id("trackers"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const newSecret = nanoid(16);

    await ctx.db.patch(args.trackerId, {
      secretLink: newSecret,
    });

    return newSecret;
  },
});
