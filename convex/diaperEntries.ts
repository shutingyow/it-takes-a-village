import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwnedEntry, verifyCaregiver } from "./lib/caregivers";
import { assertNotFarFuture } from "./lib/entryValidation";

// Create a diaper entry
export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
    colour: v.optional(
      v.union(
        v.literal("yellow"),
        v.literal("green"),
        v.literal("brown"),
        v.literal("black"),
        v.literal("red"),
        v.literal("white"),
        v.literal("other")
      )
    ),
    consistency: v.optional(
      v.union(
        v.literal("seedy"),
        v.literal("loose"),
        v.literal("firm"),
        v.literal("watery"),
        v.literal("mucous"),
        v.literal("other")
      )
    ),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("diaperEntries"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    assertNotFarFuture(args.timestamp);
    const { secretLink: _s, actingCaregiverName: _a, ...fields } = args;
    return await ctx.db.insert("diaperEntries", {
      ...fields,
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
    });
  },
});

// Get recent diaper entries
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
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", tracker._id))
      .order("desc")
      .take(limit);
  },
});

// Get last diaper entry
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
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", tracker._id))
      .order("desc")
      .first();
  },
});

// Update a diaper entry (full replace of editable fields)
export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("diaperEntries"),
    type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
    colour: v.optional(
      v.union(
        v.literal("yellow"),
        v.literal("green"),
        v.literal("brown"),
        v.literal("black"),
        v.literal("red"),
        v.literal("white"),
        v.literal("other")
      )
    ),
    consistency: v.optional(
      v.union(
        v.literal("seedy"),
        v.literal("loose"),
        v.literal("firm"),
        v.literal("watery"),
        v.literal("mucous"),
        v.literal("other")
      )
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
      "Diaper entry not found"
    );

    const hasStool = args.type === "dirty" || args.type === "both";
    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      type: args.type,
      colour: hasStool ? args.colour : undefined,
      consistency: hasStool ? args.consistency : undefined,
      timestamp: args.timestamp,
      notes: args.notes,
      photoIds: args.photoIds,
    });
    return null;
  },
});

// Delete a diaper entry
export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    entryId: v.id("diaperEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.entryId,
      "Diaper entry not found"
    );
    await ctx.db.delete(args.entryId);
    return null;
  },
});
