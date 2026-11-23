import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireOwnedEntry,
  verifyCaregiver,
} from "./lib/caregivers";
import {
  assertNotFarFuture,
  assertPositive,
} from "./lib/entryValidation";
import { deleteStorageIds } from "./lib/storageCleanup";

async function schedulePumpPush(
  ctx: MutationCtx,
  trackerId: Id<"trackers">
) {
  const tracker = await ctx.db.get(trackerId);
  const last = await ctx.db
    .query("pumpEntries")
    .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", trackerId))
    .order("desc")
    .first();
  const baby = tracker?.babyName?.trim();
  const title = baby ? `${baby} · Last pump` : "Last pump";
  if (!last) {
    await ctx.scheduler.runAfter(0, internal.apns.notifyLiveActivityUpdate, {
      trackerId,
      kind: "last-pump",
      event: "end",
      title,
      subtitle: "No pump yet",
      dueAtMs: Date.now(),
      silentWake: true,
    });
    return;
  }
  await ctx.scheduler.runAfter(0, internal.apns.notifyLiveActivityUpdate, {
    trackerId,
    kind: "last-pump",
    event: "update",
    title,
    subtitle: "Time since last pump",
    dueAtMs: last.timestamp,
    silentWake: true,
  });
}

export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    amount: v.number(),
    side: v.optional(
      v.union(v.literal("left"), v.literal("right"), v.literal("both"))
    ),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("pumpEntries"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    assertNotFarFuture(args.timestamp);
    assertPositive(args.amount, "Pump amount");
    if (args.amount > 500) {
      throw new Error("Pump amount looks too high (max 500 ml)");
    }
    const id = await ctx.db.insert("pumpEntries", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      amount: args.amount,
      side: args.side,
      timestamp: args.timestamp,
      notes: args.notes,
      photoIds: args.photoIds,
    });
    await schedulePumpPush(ctx, tracker._id);
    return id;
  },
});

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
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .take(limit);
  },
});

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
    return await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .first();
  },
});

export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("pumpEntries"),
    amount: v.number(),
    side: v.optional(
      v.union(v.literal("left"), v.literal("right"), v.literal("both"))
    ),
    timestamp: v.number(),
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
      "Pump entry not found"
    );
    assertNotFarFuture(args.timestamp);
    assertPositive(args.amount, "Pump amount");
    if (args.amount > 500) {
      throw new Error("Pump amount looks too high (max 500 ml)");
    }

    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      amount: args.amount,
      side: args.side,
      timestamp: args.timestamp,
      notes: args.notes,
      photoIds: args.photoIds,
    });
    await schedulePumpPush(ctx, existing.trackerId);
    return null;
  },
});

export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("pumpEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entry } = await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId,
      "Pump entry not found"
    );
    await deleteStorageIds(ctx, entry.photoIds);
    await ctx.db.delete(args.entryId);
    await schedulePumpPush(ctx, entry.trackerId);
    return null;
  },
});
