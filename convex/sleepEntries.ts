import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireOwnedEntry, verifyCaregiver } from "./lib/caregivers";
import { deleteStorageIds } from "./lib/storageCleanup";
import { isMilkFeed } from "./lib/feeds";

const MAX_DURATION_MINUTES = 24 * 60;

async function scheduleSleepLivePush(
  ctx: MutationCtx,
  trackerId: Id<"trackers">,
  opts: {
    active: boolean;
    type: "nap" | "night";
    startTime: number;
    endTime?: number;
    caregiverName: string;
  }
) {
  const tracker = await ctx.db.get(trackerId);
  const baby = tracker?.babyName?.trim();
  if (opts.active) {
    const sleeping = opts.type === "nap" ? "Napping" : "Sleeping";
    const title = baby ? `${baby} · ${sleeping}` : sleeping;
    await ctx.scheduler.runAfter(0, internal.apns.notifyLiveActivityUpdate, {
      trackerId,
      kind: "last-nap",
      event: "update",
      title,
      subtitle: `Started by ${opts.caregiverName}`,
      dueAtMs: opts.startTime,
      silentWake: true,
    });
    // Keep feed since-last on the lock screen while sleeping — only an
    // active feed session replaces the feed timer (not nap/sleep).
    return;
  }

  // Replace in-progress sleep with since-last (awake) from the end timestamp.
  const endAt = opts.endTime ?? Date.now();
  const title = baby ? `${baby} · Awake since` : "Awake since";
  await ctx.scheduler.runAfter(0, internal.apns.notifyLiveActivityUpdate, {
    trackerId,
    kind: "last-nap",
    event: "update",
    title,
    subtitle: "Nap ended",
    dueAtMs: endAt,
    silentWake: true,
  });

  const recent = await ctx.db
    .query("feedEntries")
    .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", trackerId))
    .order("desc")
    .take(40);
  const lastMilk = recent.find((f) => isMilkFeed(f.type));
  // Restore since-last feed + silent-wake devices to resync local state.
  await ctx.scheduler.runAfter(0, internal.apns.notifyFeedChanged, {
    trackerId,
    lastFeedAt: lastMilk?.timestamp ?? null,
    babyName: tracker?.babyName,
  });
}

function cleanNotes(notes: string | undefined): string | undefined {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 1000) {
    throw new Error("Notes are too long");
  }
  return trimmed;
}

/** End time wins when both are set. Duration alone computes the end. */
function resolveNapWindow(
  startTime: number,
  endTime: number | undefined,
  durationMinutes: number | undefined
): { endTime?: number; durationMinutes?: number } {
  let end = endTime;
  let minutes =
    durationMinutes === undefined ? undefined : Math.round(durationMinutes);

  if (minutes !== undefined) {
    if (
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      minutes > MAX_DURATION_MINUTES
    ) {
      throw new Error("Duration must be between 1 and 1440 minutes");
    }
  }

  if (end === undefined && minutes !== undefined) {
    end = startTime + minutes * 60_000;
  }

  if (end !== undefined) {
    if (end <= startTime) {
      throw new Error("End time must be after start time");
    }
    if (end > Date.now() + 60_000) {
      throw new Error("End time cannot be in the future");
    }
    const fromEnd = Math.round((end - startTime) / 60_000);
    if (fromEnd < 1 || fromEnd > MAX_DURATION_MINUTES) {
      throw new Error("Duration must be between 1 and 1440 minutes");
    }
    if (endTime !== undefined || minutes === undefined) {
      minutes = fromEnd;
    }
  }

  return { endTime: end, durationMinutes: minutes };
}

async function getActiveSleepForTracker(
  ctx: QueryCtx,
  trackerId: Id<"trackers">
) {
  // Active sessions omit endTime. Prefer the dedicated index so we don't miss
  // ongoing sleep once the village has more than a page of older rows.
  const active = await ctx.db
    .query("sleepEntries")
    .withIndex("by_tracker_active", (q) =>
      q.eq("trackerId", trackerId).eq("endTime", undefined)
    )
    .collect();
  if (active.length > 0) {
    active.sort((a, b) => b.startTime - a.startTime);
    return active[0]!;
  }

  // Fallback for any rows the index might miss during rollout.
  const recent = await ctx.db
    .query("sleepEntries")
    .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", trackerId))
    .order("desc")
    .take(100);
  return recent.find((sleep) => sleep.endTime === undefined) ?? null;
}

// Start a sleep session
export const start = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    type: v.union(v.literal("nap"), v.literal("night")),
    startTime: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("sleepEntries"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const activeSleep = await getActiveSleepForTracker(ctx, tracker._id);
    if (activeSleep) {
      throw new Error(
        `A sleep session is already active (started by ${activeSleep.caregiverName}). End it before starting another.`
      );
    }

    const caregiverName = args.actingCaregiverName.trim();
    const id = await ctx.db.insert("sleepEntries", {
      trackerId: tracker._id,
      caregiverName,
      type: args.type,
      startTime: args.startTime,
      // Omit endTime while live — indexed as undefined for getActive.
      notes: args.notes,
      photoIds: args.photoIds,
    });
    await scheduleSleepLivePush(ctx, tracker._id, {
      active: true,
      type: args.type,
      startTime: args.startTime,
      caregiverName,
    });
    return id;
  },
});

// End a sleep session
export const end = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("sleepEntries"),
    endTime: v.number(),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker, entry: existing } = await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId,
      "Sleep entry not found"
    );
    const patch: { endTime: number; photoIds?: Id<"_storage">[] } = {
      endTime: args.endTime,
    };
    if (args.photoIds !== undefined) {
      const merged = [
        ...(existing.photoIds ?? []),
        ...args.photoIds,
      ];
      patch.photoIds = merged;
    }
    await ctx.db.patch(args.entryId, patch);
    await scheduleSleepLivePush(ctx, tracker._id, {
      active: false,
      type: existing.type,
      startTime: existing.startTime,
      endTime: args.endTime,
      caregiverName: args.actingCaregiverName.trim(),
    });
    return null;
  },
});

// Create a completed sleep entry (retrospective logging)
export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    type: v.union(v.literal("nap"), v.literal("night")),
    startTime: v.number(),
    endTime: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("sleepEntries"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    if (args.endTime <= args.startTime) {
      throw new Error("End time must be after start time");
    }

    const now = Date.now();
    if (args.endTime > now) {
      throw new Error("End time cannot be in the future");
    }

    const activeSleep = await getActiveSleepForTracker(ctx, tracker._id);
    if (
      activeSleep &&
      args.startTime < now &&
      args.endTime > activeSleep.startTime
    ) {
      throw new Error("This overlaps with an active sleep session");
    }

    return await ctx.db.insert("sleepEntries", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      type: args.type,
      startTime: args.startTime,
      endTime: args.endTime,
      notes: args.notes,
      photoIds: args.photoIds,
    });
  },
});

// Get active sleep session
export const getActive = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    return await getActiveSleepForTracker(ctx, tracker._id);
  },
});

// Get recent sleep entries
export const getRecent = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", tracker._id))
      .order("desc")
      .take(limit);
  },
});

// Get last completed sleep entry
export const getLast = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const entries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", tracker._id))
      .order("desc")
      .take(10);

    // Find the most recent completed sleep
    return entries.find((entry) => entry.endTime !== undefined) ?? null;
  },
});

// Update a sleep entry (full replace of editable fields)
export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("sleepEntries"),
    type: v.union(v.literal("nap"), v.literal("night")),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entry: existing } = await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId,
      "Sleep entry not found"
    );

    if (args.endTime !== undefined && args.endTime <= args.startTime) {
      throw new Error("End time must be after start time");
    }

    const durationMinutes = existing.durationMinutes;
    const nextPhotoIds =
      args.photoIds !== undefined ? args.photoIds : existing.photoIds;
    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      type: args.type,
      startTime: args.startTime,
      endTime: args.endTime,
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      notes: args.notes,
      ...(nextPhotoIds !== undefined ? { photoIds: nextPhotoIds } : {}),
    });
    return null;
  },
});

export const logNap = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("sleepEntries"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const resolved = resolveNapWindow(
      args.startTime,
      args.endTime,
      args.durationMinutes
    );
    if (resolved.endTime === undefined) {
      const activeSleep = await getActiveSleepForTracker(ctx, tracker._id);
      if (activeSleep) {
        throw new Error(
          `A sleep session is already active (started by ${activeSleep.caregiverName}). End it before starting another.`
        );
      }
    }
    const notes = cleanNotes(args.notes);
    return await ctx.db.insert("sleepEntries", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      type: "nap",
      startTime: args.startTime,
      ...(resolved.endTime !== undefined ? { endTime: resolved.endTime } : {}),
      ...(resolved.durationMinutes !== undefined
        ? { durationMinutes: resolved.durationMinutes }
        : {}),
      ...(notes !== undefined ? { notes } : {}),
    });
  },
});

export const updateNap = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("sleepEntries"),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const existing = await ctx.db.get(args.entryId);
    if (!existing || existing.trackerId !== tracker._id) {
      throw new Error("Nap not found");
    }
    if (existing.type !== "nap") {
      throw new Error("This sleep entry is not a nap");
    }
    const resolved = resolveNapWindow(
      args.startTime,
      args.endTime,
      args.durationMinutes
    );
    const notes = cleanNotes(args.notes);
    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      type: "nap",
      startTime: args.startTime,
      ...(resolved.endTime !== undefined ? { endTime: resolved.endTime } : {}),
      ...(resolved.durationMinutes !== undefined
        ? { durationMinutes: resolved.durationMinutes }
        : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(existing.photoIds !== undefined ? { photoIds: existing.photoIds } : {}),
    });
    return null;
  },
});

export const getTodayNapStatus = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    now: v.number(),
  },
  returns: v.union(
    v.object({ state: v.literal("none") }),
    v.object({
      state: v.literal("napping"),
      startTime: v.number(),
    }),
    v.object({
      state: v.literal("awake"),
      awakeSince: v.number(),
      awakeMinutes: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const recent = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .take(80);

    const latest = recent.find((entry) => entry.type === "nap");
    if (!latest) {
      return { state: "none" as const };
    }
    if (latest.endTime === undefined || latest.endTime > args.now) {
      return { state: "napping" as const, startTime: latest.startTime };
    }
    const awakeMinutes = Math.max(
      0,
      Math.round((args.now - latest.endTime) / 60_000)
    );
    return {
      state: "awake" as const,
      awakeSince: latest.endTime,
      awakeMinutes,
    };
  },
});

async function requireOwnedSleep(
  ctx: MutationCtx,
  secretLink: string,
  actingCaregiverName: string,
  entryId: Id<"sleepEntries">
) {
  const { tracker } = await verifyCaregiver(
    ctx,
    secretLink,
    actingCaregiverName
  );
  const existing = await ctx.db.get(entryId);
  if (!existing || existing.trackerId !== tracker._id) {
    throw new Error("Sleep entry not found");
  }
  return existing;
}

// Delete a sleep entry
export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("sleepEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await requireOwnedSleep(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId
    );
    await deleteStorageIds(ctx, existing.photoIds);
    await ctx.db.delete(args.entryId);
    return null;
  },
});
