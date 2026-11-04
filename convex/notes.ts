import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwnedEntry, verifyCaregiver } from "./lib/caregivers";

export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    content: v.string(),
    photoIds: v.array(v.id("_storage")),
    timestamp: v.number(),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    return await ctx.db.insert("notes", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      content: args.content,
      photoIds: args.photoIds,
      timestamp: args.timestamp,
    });
  },
});

export const getRecent = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("notes")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .take(limit);
  },
});

export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    noteId: v.id("notes"),
    content: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.noteId,
      "Note not found"
    );
    const patch: { content?: string; photoIds?: typeof args.photoIds } = {};
    if (args.content !== undefined) patch.content = args.content;
    if (args.photoIds !== undefined) patch.photoIds = args.photoIds;
    await ctx.db.patch(args.noteId, patch);
    return null;
  },
});

export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    noteId: v.id("notes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.noteId,
      "Note not found"
    );
    await ctx.db.delete(args.noteId);
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await verifyCaregiver(ctx, args.secretLink, args.actingCaregiverName);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Resolve a photo URL only for caregivers on the village.
 * Storage IDs are opaque; we require a valid secret + listed caregiver.
 * (Pending uploads are not yet attached to an entry, so we don't require
 * a tracker-owned photoIds match.)
 */
export const getPhotoUrl = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await verifyCaregiver(ctx, args.secretLink, args.actingCaregiverName);
    return await ctx.storage.getUrl(args.storageId);
  },
});
