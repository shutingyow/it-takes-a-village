import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwnedEntry, verifyCaregiver } from "./lib/caregivers";

// Create a supply alert
export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    item: v.string(),
    timestamp: v.number(),
  },
  returns: v.id("supplyAlerts"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    return await ctx.db.insert("supplyAlerts", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      item: args.item,
      timestamp: args.timestamp,
      isActive: true,
    });
  },
});

// Get active supply alerts
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
    return await ctx.db
      .query("supplyAlerts")
      .withIndex("by_tracker_active", (q) =>
        q.eq("trackerId", tracker._id).eq("isActive", true)
      )
      .collect();
  },
});

// Mark alert as restocked
export const markRestocked = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    alertId: v.id("supplyAlerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.alertId,
      "Supply alert not found"
    );
    await ctx.db.patch(args.alertId, {
      isActive: false,
    });
    return null;
  },
});

// Delete an alert
export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    alertId: v.id("supplyAlerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.alertId,
      "Supply alert not found"
    );
    await ctx.db.delete(args.alertId);
    return null;
  },
});
