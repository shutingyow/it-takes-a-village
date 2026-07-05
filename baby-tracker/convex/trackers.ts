import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nanoid } from "nanoid";

// Create a new tracker with a unique secret link
export const create = mutation({
  args: {
    caregiverNames: v.array(v.string()),
  },
  returns: v.object({
    trackerId: v.id("trackers"),
    secretLink: v.string(),
  }),
  handler: async (ctx, args) => {
    const secretLink = nanoid(16);
    
    const trackerId = await ctx.db.insert("trackers", {
      secretLink,
      caregiverNames: args.caregiverNames,
      createdAt: Date.now(),
    });

    return { trackerId, secretLink };
  },
});

// Get tracker by secret link
export const getBySecret = query({
  args: {
    secretLink: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("trackers"),
      secretLink: v.string(),
      caregiverNames: v.array(v.string()),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tracker = await ctx.db
      .query("trackers")
      .withIndex("by_secret", (q) => q.eq("secretLink", args.secretLink))
      .first();

    return tracker;
  },
});

// Update caregiver names
export const updateCaregivers = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverNames: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.trackerId, {
      caregiverNames: args.caregiverNames,
    });
    return null;
  },
});

// Regenerate secret link
export const regenerateSecret = mutation({
  args: {
    trackerId: v.id("trackers"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const newSecret = nanoid(16);
    
    await ctx.db.patch(args.trackerId, {
      secretLink: newSecret,
    });

    return newSecret;
  },
});
