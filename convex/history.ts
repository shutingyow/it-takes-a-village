import { v } from "convex/values";
import { query } from "./_generated/server";

// Get all recent activity for history view
export const getActivity = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
    type: v.optional(v.union(
      v.literal("all"),
      v.literal("feed"),
      v.literal("sleep"),
      v.literal("diaper"),
      v.literal("pump"),
      v.literal("health")
    )),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const filterType = args.type ?? "all";
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Fetch all entry types
    const feedEntries = filterType === "all" || filterType === "feed"
      ? await ctx.db
          .query("feedEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const sleepEntries = filterType === "all" || filterType === "sleep"
      ? await ctx.db
          .query("sleepEntries")
          .withIndex("by_tracker_and_start", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("startTime"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const diaperEntries = filterType === "all" || filterType === "diaper"
      ? await ctx.db
          .query("diaperEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const pumpEntries = filterType === "all" || filterType === "pump"
      ? await ctx.db
          .query("pumpEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    const healthEntries = filterType === "all" || filterType === "health"
      ? await ctx.db
          .query("healthEntries")
          .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
          .filter((q) => q.gte(q.field("timestamp"), sevenDaysAgo))
          .order("desc")
          .take(limit)
      : [];

    // Combine and sort by timestamp
    const allEntries = [
      ...feedEntries.map(e => ({ ...e, entryType: "feed" as const, time: e.timestamp })),
      ...sleepEntries.map(e => ({ ...e, entryType: "sleep" as const, time: e.startTime })),
      ...diaperEntries.map(e => ({ ...e, entryType: "diaper" as const, time: e.timestamp })),
      ...pumpEntries.map(e => ({ ...e, entryType: "pump" as const, time: e.timestamp })),
      ...healthEntries.map(e => ({ ...e, entryType: "health" as const, time: e.timestamp })),
    ];

    // Sort by time descending
    allEntries.sort((a, b) => b.time - a.time);

    return allEntries.slice(0, limit);
  },
});
