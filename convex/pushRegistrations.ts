import { v } from "convex/values";
import { mutation } from "./_generated/server";

/** Register / refresh an ActivityKit push token for Live Activity updates. */
export const upsertLiveActivity = mutation({
  args: {
    trackerId: v.id("trackers"),
    activityId: v.string(),
    pushToken: v.string(),
    deviceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = args.pushToken.trim().toLowerCase();
    const activityId = args.activityId.trim();
    const deviceId = args.deviceId.trim();
    if (!token || !activityId || !deviceId) {
      throw new Error("Missing Live Activity registration fields");
    }

    const byActivity = await ctx.db
      .query("liveActivityRegistrations")
      .withIndex("by_activity", (q) => q.eq("activityId", activityId))
      .unique();

    const now = Date.now();
    if (byActivity) {
      await ctx.db.patch(byActivity._id, {
        trackerId: args.trackerId,
        pushToken: token,
        deviceId,
        updatedAt: now,
      });
      return null;
    }

    const byDevice = await ctx.db
      .query("liveActivityRegistrations")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .collect();
    for (const row of byDevice) {
      if (row.trackerId === args.trackerId) {
        await ctx.db.delete(row._id);
      }
    }

    await ctx.db.insert("liveActivityRegistrations", {
      trackerId: args.trackerId,
      activityId,
      pushToken: token,
      deviceId,
      updatedAt: now,
    });
    return null;
  },
});

export const removeLiveActivity = mutation({
  args: {
    activityId: v.optional(v.string()),
    deviceId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.activityId) {
      const row = await ctx.db
        .query("liveActivityRegistrations")
        .withIndex("by_activity", (q) => q.eq("activityId", args.activityId!))
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
    if (args.deviceId) {
      const rows = await ctx.db
        .query("liveActivityRegistrations")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId!))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    return null;
  },
});

/** Register APNs device token for silent wakes. */
export const upsertDevicePushToken = mutation({
  args: {
    trackerId: v.id("trackers"),
    token: v.string(),
    deviceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = args.token.trim();
    const deviceId = args.deviceId.trim();
    if (!token || !deviceId) throw new Error("Missing device push fields");

    const existing = await ctx.db
      .query("devicePushTokens")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .collect();

    const now = Date.now();
    const sameTracker = existing.find((r) => r.trackerId === args.trackerId);
    if (sameTracker) {
      await ctx.db.patch(sameTracker._id, { token, updatedAt: now });
      return null;
    }
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.insert("devicePushTokens", {
      trackerId: args.trackerId,
      token,
      deviceId,
      updatedAt: now,
    });
    return null;
  },
});
