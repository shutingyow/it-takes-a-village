import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwnedEntry, verifyCaregiver } from "./lib/caregivers";
import {
  assertIsoDate,
  assertNotFarFuture,
  assertPositive,
} from "./lib/entryValidation";

const statusValidator = v.union(
  v.literal("available"),
  v.literal("used"),
  v.literal("discarded")
);

const bagReturn = v.object({
  _id: v.id("milkStashBags"),
  _creationTime: v.number(),
  trackerId: v.id("trackers"),
  caregiverName: v.string(),
  amountMl: v.number(),
  status: statusValidator,
  createdAt: v.number(),
  pumpedAt: v.optional(v.number()),
  pumpEntryId: v.optional(v.id("pumpEntries")),
  frozenOn: v.optional(v.string()),
  label: v.optional(v.string()),
  usedAt: v.optional(v.number()),
  usedByCaregiverName: v.optional(v.string()),
  notes: v.optional(v.string()),
});

function isoFromTimestamp(ms: number): string {
  const d = new Date(ms);
  // Asia/Singapore day for consistency with tracker defaults
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

export const listAvailable = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  returns: v.array(bagReturn),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const bags = await ctx.db
      .query("milkStashBags")
      .withIndex("by_tracker_and_status", (q) =>
        q.eq("trackerId", tracker._id).eq("status", "available")
      )
      .collect();
    return bags.sort((a, b) => {
      const aKey = a.frozenOn ?? a.label ?? String(a.createdAt);
      const bKey = b.frozenOn ?? b.label ?? String(b.createdAt);
      return aKey.localeCompare(bKey);
    });
  },
});

export const listRecent = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(bagReturn),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const limit = args.limit ?? 40;
    return await ctx.db
      .query("milkStashBags")
      .withIndex("by_tracker_and_created", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .take(limit);
  },
});

export const availableTotalMl = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const bags = await ctx.db
      .query("milkStashBags")
      .withIndex("by_tracker_and_status", (q) =>
        q.eq("trackerId", tracker._id).eq("status", "available")
      )
      .collect();
    return bags.reduce((sum, b) => sum + b.amountMl, 0);
  },
});

export const addBag = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    amountMl: v.number(),
    pumpedAt: v.optional(v.number()),
    pumpEntryId: v.optional(v.id("pumpEntries")),
    /** YYYY-MM-DD freeze date. Defaults from pumpedAt / today. */
    frozenOn: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  returns: v.id("milkStashBags"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    assertPositive(args.amountMl, "Bag amount");
    if (args.amountMl > 500) {
      throw new Error("Bag amount looks too high (max 500 ml)");
    }
    const createdAt = args.createdAt ?? Date.now();
    assertNotFarFuture(createdAt);
    if (args.pumpedAt !== undefined) assertNotFarFuture(args.pumpedAt);

    const frozenOn = assertIsoDate(
      args.frozenOn ??
        isoFromTimestamp(args.pumpedAt ?? createdAt),
      "Freeze date"
    );

    if (args.pumpEntryId !== undefined) {
      await requireOwnedEntry(
        ctx,
        args.secretLink,
        args.actingCaregiverName,
        args.pumpEntryId,
        "Pump entry not found"
      );
    }

    return await ctx.db.insert("milkStashBags", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      amountMl: args.amountMl,
      status: "available",
      createdAt,
      pumpedAt: args.pumpedAt,
      pumpEntryId: args.pumpEntryId,
      frozenOn,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const markUsed = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    bagId: v.id("milkStashBags"),
    usedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entry: bag } = await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.bagId,
      "Bag not found"
    );
    if (bag.status !== "available") {
      throw new Error("Bag is already used or discarded");
    }
    const usedAt = args.usedAt ?? Date.now();
    assertNotFarFuture(usedAt);
    await ctx.db.patch(args.bagId, {
      status: "used",
      usedAt,
      usedByCaregiverName: args.actingCaregiverName.trim(),
    });
    return null;
  },
});

export const discard = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    bagId: v.id("milkStashBags"),
    usedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entry: bag } = await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.bagId,
      "Bag not found"
    );
    if (bag.status !== "available") {
      throw new Error("Bag is already used or discarded");
    }
    const usedAt = args.usedAt ?? Date.now();
    assertNotFarFuture(usedAt);
    await ctx.db.patch(args.bagId, {
      status: "discarded",
      usedAt,
      usedByCaregiverName: args.actingCaregiverName.trim(),
    });
    return null;
  },
});

export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    bagId: v.id("milkStashBags"),
    amountMl: v.optional(v.number()),
    frozenOn: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entry: bag } = await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.bagId,
      "Bag not found"
    );
    if (bag.status !== "available") {
      throw new Error("Only available bags can be edited");
    }
    const patch: {
      amountMl?: number;
      frozenOn?: string;
      notes?: string;
    } = {};
    if (args.amountMl !== undefined) {
      assertPositive(args.amountMl, "Bag amount");
      if (args.amountMl > 500) {
        throw new Error("Bag amount looks too high (max 500 ml)");
      }
      patch.amountMl = args.amountMl;
    }
    if (args.frozenOn !== undefined) {
      patch.frozenOn = assertIsoDate(args.frozenOn, "Freeze date");
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    await ctx.db.patch(args.bagId, patch);
    return null;
  },
});
