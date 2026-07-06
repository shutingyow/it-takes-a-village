import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a supply alert
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    item: v.string(),
    timestamp: v.number(),
  },
  returns: v.id("supplyAlerts"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("supplyAlerts", {
      ...args,
      isActive: true,
    });
  },
});

// Get active supply alerts
export const getActive = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("supplyAlerts")
      .withIndex("by_tracker_active", (q) => 
        q.eq("trackerId", args.trackerId).eq("isActive", true)
      )
      .collect();
  },
});

// Mark alert as restocked
export const markRestocked = mutation({
  args: {
    alertId: v.id("supplyAlerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      isActive: false,
    });
    return null;
  },
});

// Delete an alert
export const remove = mutation({
  args: {
    alertId: v.id("supplyAlerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.alertId);
    return null;
  },
});
