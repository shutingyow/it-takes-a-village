import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyCaregiver } from "./lib/caregivers";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isMilkFeed } from "./lib/feeds";

async function scheduleFeedLiveRestore(
  ctx: MutationCtx,
  trackerId: Id<"trackers">
) {
  const tracker = await ctx.db.get(trackerId);
  const recent = await ctx.db
    .query("feedEntries")
    .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", trackerId))
    .order("desc")
    .take(40);
  const lastMilk = recent.find((f) => isMilkFeed(f.type));
  await ctx.scheduler.runAfter(0, internal.apns.notifyFeedChanged, {
    trackerId,
    lastFeedAt: lastMilk?.timestamp ?? null,
    babyName: tracker?.babyName,
  });
}

async function scheduleFeedOngoingPush(
  ctx: MutationCtx,
  trackerId: Id<"trackers">,
  startedAt: number,
  caregiverName: string
) {
  const tracker = await ctx.db.get(trackerId);
  const baby = tracker?.babyName?.trim();
  const title = baby ? `${baby} · Feed ongoing` : "Feed ongoing";
  await ctx.scheduler.runAfter(0, internal.apns.notifyLiveActivityUpdate, {
    trackerId,
    kind: "last-feed",
    event: "update",
    title,
    subtitle: `Started by ${caregiverName}`,
    dueAtMs: startedAt,
    silentWake: true,
  });
}

/** Active live feed timer for the village, if any. */
export const getActive = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      caregiverName: v.string(),
      startedAt: v.number(),
      status: v.union(v.literal("running"), v.literal("paused")),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    return tracker.activeFeedSession ?? null;
  },
});

/** Start or refresh the shared live feed timer. */
export const setActive = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    startedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("paused")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const caregiverName = args.actingCaregiverName.trim();
    const existing = tracker.activeFeedSession;
    // Another caregiver already timing — don't steal the session.
    if (
      existing &&
      existing.caregiverName !== caregiverName &&
      Date.now() - existing.updatedAt < 6 * 60 * 60_000
    ) {
      return null;
    }

    const next = {
      caregiverName,
      startedAt: args.startedAt,
      status: args.status,
      updatedAt: Date.now(),
    };
    const unchanged =
      existing &&
      existing.caregiverName === next.caregiverName &&
      existing.startedAt === next.startedAt &&
      existing.status === next.status;
    if (unchanged) return null;

    await ctx.db.patch(tracker._id, { activeFeedSession: next });
    await scheduleFeedOngoingPush(
      ctx,
      tracker._id,
      next.startedAt,
      caregiverName
    );
    return null;
  },
});

/** Clear the shared live feed timer (reset / save). */
export const clearActive = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    /** When true, skip APNs restore (caller already scheduled feed push). */
    skipPush: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    if (!tracker.activeFeedSession) return null;

    const caregiverName = args.actingCaregiverName.trim();
    // Only the caregiver who started it (or an admin name) may clear.
    // Any village caregiver can clear a stale session after 6h.
    const owned =
      tracker.activeFeedSession.caregiverName === caregiverName ||
      Date.now() - tracker.activeFeedSession.updatedAt > 6 * 60 * 60_000;
    if (!owned) return null;

    await ctx.db.patch(tracker._id, { activeFeedSession: undefined });
    if (!args.skipPush) {
      await scheduleFeedLiveRestore(ctx, tracker._id);
    }
    return null;
  },
});
