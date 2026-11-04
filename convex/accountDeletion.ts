import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function deleteTrackerRows(
  ctx: MutationCtx,
  trackerId: Id<"trackers">
) {
  const feeds = await ctx.db
    .query("feedEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of feeds) await ctx.db.delete(row._id);

  const sleep = await ctx.db
    .query("sleepEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of sleep) await ctx.db.delete(row._id);

  const diapers = await ctx.db
    .query("diaperEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of diapers) await ctx.db.delete(row._id);

  const pumps = await ctx.db
    .query("pumpEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of pumps) await ctx.db.delete(row._id);

  const health = await ctx.db
    .query("healthEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of health) await ctx.db.delete(row._id);

  const notes = await ctx.db
    .query("notes")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of notes) await ctx.db.delete(row._id);

  const diary = await ctx.db
    .query("diaryEntries")
    .withIndex("by_tracker_and_date", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of diary) await ctx.db.delete(row._id);

  const supply = await ctx.db
    .query("supplyAlerts")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of supply) await ctx.db.delete(row._id);

  const appointments = await ctx.db
    .query("appointments")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of appointments) await ctx.db.delete(row._id);

  const growth = await ctx.db
    .query("growthEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of growth) await ctx.db.delete(row._id);

  const stash = await ctx.db
    .query("milkStashBags")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of stash) await ctx.db.delete(row._id);

  const live = await ctx.db
    .query("liveActivityRegistrations")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of live) await ctx.db.delete(row._id);

  const devices = await ctx.db
    .query("devicePushTokens")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of devices) await ctx.db.delete(row._id);

  const activities = await ctx.db
    .query("activityEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of activities) await ctx.db.delete(row._id);

  const moments = await ctx.db
    .query("momentEntries")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of moments) await ctx.db.delete(row._id);

  const milestones = await ctx.db
    .query("milestones")
    .withIndex("by_tracker", (q) => q.eq("trackerId", trackerId))
    .collect();
  for (const row of milestones) await ctx.db.delete(row._id);
}

async function deleteOwnedTrackers(ctx: MutationCtx, userId: Id<"users">) {
  const mine = await ctx.db
    .query("trackers")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
    .collect();

  for (const tracker of mine) {
    if (tracker.photoStorageId) {
      try {
        await ctx.storage.delete(tracker.photoStorageId);
      } catch {
        // Storage may already be gone
      }
    }
    await deleteTrackerRows(ctx, tracker._id);
    await ctx.db.delete(tracker._id);
  }
}

async function deleteAuthData(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(session._id);
  }

  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  for (const account of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) {
      await ctx.db.delete(code._id);
    }
    await ctx.db.delete(account._id);
  }
}

/**
 * Apple/Google App Store requirement: signed-in users can delete their account
 * in-app. Deletes owned villages + related care data, then auth rows + user.
 */
export const deleteAccount = mutation({
  args: {
    confirm: v.literal("DELETE"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    void args;
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Sign in to delete your account");
    }

    await deleteOwnedTrackers(ctx, userId);
    await deleteAuthData(ctx, userId);
    await ctx.db.delete(userId);
    return null;
  },
});
