import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const listLiveActivities = internalQuery({
  args: {
    trackerId: v.id("trackers"),
    /** When set, only return tokens for this Live Activity kind. */
    kind: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      pushToken: v.string(),
      activityId: v.string(),
      deviceId: v.string(),
      kind: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("liveActivityRegistrations")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();
    const wanted = args.kind?.trim();
    return rows
      .map((r) => ({
        pushToken: r.pushToken,
        activityId: r.activityId,
        deviceId: r.deviceId,
        kind: r.kind ?? "last-feed",
      }))
      .filter((r) => (wanted ? r.kind === wanted : true));
  },
});

export const listDeviceTokens = internalQuery({
  args: { trackerId: v.id("trackers") },
  returns: v.array(
    v.object({
      token: v.string(),
      deviceId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("devicePushTokens")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();
    return rows.map((r) => ({ token: r.token, deviceId: r.deviceId }));
  },
});
