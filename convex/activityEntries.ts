import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { verifyCaregiver } from "./lib/caregivers";

const MAX_DURATION_MINUTES = 24 * 60;

const activityKindValidator = v.union(
  v.literal("tummy"),
  v.literal("playmat"),
  v.literal("shower"),
  v.literal("massage")
);

function cleanNotes(notes: string | undefined): string | undefined {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 1000) {
    throw new Error("Notes are too long");
  }
  return trimmed;
}

function cleanDuration(minutes: number | undefined): number | undefined {
  if (minutes === undefined) return undefined;
  const rounded = Math.round(minutes);
  if (
    !Number.isFinite(rounded) ||
    rounded < 1 ||
    rounded > MAX_DURATION_MINUTES
  ) {
    throw new Error("Duration must be between 1 and 1440 minutes");
  }
  return rounded;
}

async function requireOwnedActivity(
  ctx: MutationCtx,
  secretLink: string,
  actingCaregiverName: string,
  entryId: Id<"activityEntries">
) {
  const { tracker } = await verifyCaregiver(
    ctx,
    secretLink,
    actingCaregiverName
  );
  const existing = await ctx.db.get(entryId);
  if (!existing || existing.trackerId !== tracker._id) {
    throw new Error("Activity not found");
  }
  return existing;
}

export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    kind: activityKindValidator,
    timestamp: v.number(),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("activityEntries"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const durationMinutes = cleanDuration(args.durationMinutes);
    const notes = cleanNotes(args.notes);
    return await ctx.db.insert("activityEntries", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      kind: args.kind,
      timestamp: args.timestamp,
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });
  },
});

export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("activityEntries"),
    kind: activityKindValidator,
    timestamp: v.number(),
    durationMinutes: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await requireOwnedActivity(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId
    );
    const durationMinutes =
      args.durationMinutes === null
        ? undefined
        : cleanDuration(args.durationMinutes);
    const notes = cleanNotes(args.notes);
    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      kind: args.kind,
      timestamp: args.timestamp,
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("activityEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedActivity(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId
    );
    await ctx.db.delete(args.entryId);
    return null;
  },
});
