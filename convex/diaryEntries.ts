import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyCaregiver } from "./lib/caregivers";

const moodValidator = v.union(
  v.literal("happy"),
  v.literal("calm"),
  v.literal("tired"),
  v.literal("stressed"),
  v.literal("grateful")
);

const diaryEntryValidator = v.object({
  _id: v.id("diaryEntries"),
  _creationTime: v.number(),
  trackerId: v.id("trackers"),
  dateKey: v.string(),
  content: v.string(),
  mood: v.optional(moodValidator),
  caregiverName: v.string(),
  updatedAt: v.number(),
});

export const getForDay = query({
  args: {
    trackerId: v.id("trackers"),
    dateKey: v.string(),
  },
  returns: v.union(diaryEntryValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("diaryEntries")
      .withIndex("by_tracker_and_date", (q) =>
        q.eq("trackerId", args.trackerId).eq("dateKey", args.dateKey)
      )
      .unique();
  },
});

export const upsert = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    dateKey: v.string(),
    content: v.string(),
    mood: v.optional(moodValidator),
  },
  returns: v.union(v.id("diaryEntries"), v.null()),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );

    const content = args.content.trim();
    const mood = args.mood;
    const existing = await ctx.db
      .query("diaryEntries")
      .withIndex("by_tracker_and_date", (q) =>
        q.eq("trackerId", tracker._id).eq("dateKey", args.dateKey)
      )
      .unique();

    // Empty content + no mood → clear that day's diary
    if (!content && !mood) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }

    const now = Date.now();
    const payload = {
      trackerId: tracker._id,
      dateKey: args.dateKey,
      content,
      ...(mood ? { mood } : {}),
      caregiverName: args.actingCaregiverName,
      updatedAt: now,
    };

    if (existing) {
      // replace so clearing mood removes the field
      await ctx.db.replace(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("diaryEntries", payload);
  },
});
