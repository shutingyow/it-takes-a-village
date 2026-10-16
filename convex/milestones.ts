import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const PREDEFINED_MILESTONES = [
  { key: "first_smile", title: "First smile", category: "social", sortOrder: 1 },
  { key: "holds_head", title: "Holds head up", category: "motor", sortOrder: 2 },
  { key: "rolls_over", title: "Rolls over", category: "motor", sortOrder: 3 },
  { key: "sits_up", title: "Sits up", category: "motor", sortOrder: 4 },
  { key: "crawls", title: "Crawls", category: "motor", sortOrder: 5 },
  { key: "pulls_to_stand", title: "Pulls to stand", category: "motor", sortOrder: 6 },
  { key: "first_steps", title: "First steps", category: "motor", sortOrder: 7 },
  { key: "first_word", title: "First word", category: "language", sortOrder: 8 },
  { key: "waves_bye", title: "Waves bye-bye", category: "social", sortOrder: 9 },
  { key: "claps", title: "Claps hands", category: "motor", sortOrder: 10 },
  { key: "pincer_grasp", title: "Pincer grasp", category: "motor", sortOrder: 11 },
  { key: "sleeps_through", title: "Sleeps through the night", category: "sleep", sortOrder: 12 },
] as const;

const milestoneValidator = v.object({
  _id: v.id("milestones"),
  _creationTime: v.number(),
  trackerId: v.id("trackers"),
  title: v.string(),
  category: v.optional(v.string()),
  predefinedKey: v.optional(v.string()),
  isCustom: v.boolean(),
  achievedAt: v.optional(v.number()),
  sortOrder: v.number(),
});

export const list = query({
  args: { trackerId: v.id("trackers") },
  returns: v.array(milestoneValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("milestones")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();
  },
});

export const ensureSeeded = mutation({
  args: { trackerId: v.id("trackers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .first();

    if (existing) return null;

    for (const m of PREDEFINED_MILESTONES) {
      await ctx.db.insert("milestones", {
        trackerId: args.trackerId,
        title: m.title,
        category: m.category,
        predefinedKey: m.key,
        isCustom: false,
        sortOrder: m.sortOrder,
      });
    }

    return null;
  },
});

export const markAchieved = mutation({
  args: {
    milestoneId: v.id("milestones"),
    achievedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.milestoneId, { achievedAt: args.achievedAt });
    return null;
  },
});

export const clearAchieved = mutation({
  args: { milestoneId: v.id("milestones") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.milestoneId, { achievedAt: undefined });
    return null;
  },
});

export const addCustom = mutation({
  args: {
    trackerId: v.id("trackers"),
    title: v.string(),
  },
  returns: v.id("milestones"),
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (!title) throw new Error("Milestone title is required");

    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .collect();

    const maxOrder = existing.reduce((max, m) => Math.max(max, m.sortOrder), 0);

    return await ctx.db.insert("milestones", {
      trackerId: args.trackerId,
      title,
      isCustom: true,
      sortOrder: maxOrder + 1,
    });
  },
});
