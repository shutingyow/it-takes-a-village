import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a note
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    content: v.string(),
    photoIds: v.array(v.id("_storage")),
    timestamp: v.number(),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("notes", args);
  },
});

// Get recent notes
export const getRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("notes")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

// Update a note
export const update = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { noteId, ...updates } = args;
    
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await ctx.db.patch(noteId, cleanUpdates);
    return null;
  },
});

// Delete a note
export const remove = mutation({
  args: {
    noteId: v.id("notes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // TODO: Delete associated photos from storage
    await ctx.db.delete(args.noteId);
    return null;
  },
});

// Generate upload URL for photos
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Get photo URL
export const getPhotoUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
