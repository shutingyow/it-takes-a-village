import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { verifyCaregiver } from "./lib/caregivers";

const momentPresetValidator = v.union(
  v.literal("kicked"),
  v.literal("smiled"),
  v.literal("rolled"),
  v.literal("temperature"),
  v.literal("sick")
);

function cleanNotes(notes: string | undefined): string | undefined {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 1000) {
    throw new Error("Notes are too long");
  }
  return trimmed;
}

function cleanText(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 160) {
    throw new Error("Update is too long");
  }
  return trimmed;
}

async function requireOwnedMoment(
  ctx: MutationCtx,
  secretLink: string,
  actingCaregiverName: string,
  entryId: Id<"momentEntries">
) {
  const { tracker } = await verifyCaregiver(
    ctx,
    secretLink,
    actingCaregiverName
  );
  const existing = await ctx.db.get(entryId);
  if (!existing || existing.trackerId !== tracker._id) {
    throw new Error("Moment not found");
  }
  return existing;
}

export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    preset: v.optional(momentPresetValidator),
    text: v.optional(v.string()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("momentEntries"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const text = cleanText(args.text);
    if (!args.preset && !text) {
      throw new Error("Add a preset or a short update");
    }
    const notes = cleanNotes(args.notes);
    return await ctx.db.insert("momentEntries", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      timestamp: args.timestamp,
      ...(text ? { text } : { preset: args.preset }),
      ...(notes !== undefined ? { notes } : {}),
    });
  },
});

export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("momentEntries"),
    preset: v.optional(momentPresetValidator),
    text: v.optional(v.string()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await requireOwnedMoment(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId
    );
    const text = cleanText(args.text);
    if (!args.preset && !text) {
      throw new Error("Add a preset or a short update");
    }
    const notes = cleanNotes(args.notes);
    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      timestamp: args.timestamp,
      ...(text ? { text } : { preset: args.preset }),
      ...(notes !== undefined ? { notes } : {}),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("momentEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedMoment(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId
    );
    await ctx.db.delete(args.entryId);
    return null;
  },
});
