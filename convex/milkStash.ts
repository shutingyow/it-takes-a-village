import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
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
  label: v.optional(v.string()),
  usedAt: v.optional(v.number()),
  usedByCaregiverName: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const listAvailable = query({
  args: { trackerId: v.id("trackers") },
  returns: v.array(bagReturn),
  handler: async (ctx, args) => {
    const bags = await ctx.db
      .query("milkStashBags")
      .withIndex("by_tracker_and_status", (q) =>
        q.eq("trackerId", args.trackerId).eq("status", "available")
      )
      .collect();
    return bags.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const listRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  returns: v.array(bagReturn),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 40;
    return await ctx.db
      .query("milkStashBags")
      .withIndex("by_tracker_and_created", (q) =>
        q.eq("trackerId", args.trackerId)
      )
      .order("desc")
      .take(limit);
  },
});

export const availableTotalMl = query({
  args: { trackerId: v.id("trackers") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const bags = await ctx.db
      .query("milkStashBags")
      .withIndex("by_tracker_and_status", (q) =>
        q.eq("trackerId", args.trackerId).eq("status", "available")
      )
      .collect();
    return bags.reduce((sum, b) => sum + b.amountMl, 0);
  },
});

export const addBag = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    amountMl: v.number(),
    pumpedAt: v.optional(v.number()),
    pumpEntryId: v.optional(v.id("pumpEntries")),
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  returns: v.id("milkStashBags"),
  handler: async (ctx, args) => {
    assertPositive(args.amountMl, "Bag amount");
    if (args.amountMl > 500) {
      throw new Error("Bag amount looks too high (max 500 ml)");
    }
    const createdAt = args.createdAt ?? Date.now();
    assertNotFarFuture(createdAt);
    if (args.pumpedAt !== undefined) assertNotFarFuture(args.pumpedAt);

    return await ctx.db.insert("milkStashBags", {
      trackerId: args.trackerId,
      caregiverName: args.caregiverName.trim(),
      amountMl: args.amountMl,
      status: "available",
      createdAt,
      pumpedAt: args.pumpedAt,
      pumpEntryId: args.pumpEntryId,
      label: args.label?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const markUsed = mutation({
  args: {
    bagId: v.id("milkStashBags"),
    caregiverName: v.string(),
    usedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bag = await ctx.db.get(args.bagId);
    if (!bag) throw new Error("Bag not found");
    if (bag.status !== "available") {
      throw new Error("Bag is already used or discarded");
    }
    const usedAt = args.usedAt ?? Date.now();
    assertNotFarFuture(usedAt);
    await ctx.db.patch(args.bagId, {
      status: "used",
      usedAt,
      usedByCaregiverName: args.caregiverName.trim(),
    });
    return null;
  },
});

export const discard = mutation({
  args: {
    bagId: v.id("milkStashBags"),
    caregiverName: v.string(),
    usedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bag = await ctx.db.get(args.bagId);
    if (!bag) throw new Error("Bag not found");
    if (bag.status !== "available") {
      throw new Error("Bag is already used or discarded");
    }
    const usedAt = args.usedAt ?? Date.now();
    assertNotFarFuture(usedAt);
    await ctx.db.patch(args.bagId, {
      status: "discarded",
      usedAt,
      usedByCaregiverName: args.caregiverName.trim(),
    });
    return null;
  },
});

export const update = mutation({
  args: {
    bagId: v.id("milkStashBags"),
    amountMl: v.optional(v.number()),
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bag = await ctx.db.get(args.bagId);
    if (!bag) throw new Error("Bag not found");
    if (bag.status !== "available") {
      throw new Error("Only available bags can be edited");
    }
    const patch: {
      amountMl?: number;
      label?: string;
      notes?: string;
    } = {};
    if (args.amountMl !== undefined) {
      assertPositive(args.amountMl, "Bag amount");
      if (args.amountMl > 500) {
        throw new Error("Bag amount looks too high (max 500 ml)");
      }
      patch.amountMl = args.amountMl;
    }
    if (args.label !== undefined) {
      patch.label = args.label.trim() || undefined;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    await ctx.db.patch(args.bagId, patch);
    return null;
  },
});
