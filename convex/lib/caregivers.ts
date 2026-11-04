import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DbCtx = QueryCtx | MutationCtx;

export const caregiverRoleValidator = v.union(
  v.literal("admin"),
  v.literal("caregiver")
);

export const caregiverValidator = v.object({
  name: v.string(),
  role: caregiverRoleValidator,
});

export type Caregiver = {
  name: string;
  role: "admin" | "caregiver";
};

/**
 * Legacy name lists → caregivers. First name is admin; real admin power for
 * settings is SSO ownership (`verifyAdmin` / ownerUserId), not this label.
 */
export function assignRoles(names: string[]): Caregiver[] {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];

  return trimmed.map((name, index) => ({
    name,
    role: index === 0 ? "admin" : "caregiver",
  }));
}

export function migrateCaregiverNames(names: string[]): Caregiver[] {
  return assignRoles(names);
}

export function getCaregivers(tracker: Doc<"trackers">): Caregiver[] {
  if (tracker.caregivers && tracker.caregivers.length > 0) {
    return tracker.caregivers;
  }
  if (tracker.caregiverNames && tracker.caregiverNames.length > 0) {
    return migrateCaregiverNames(tracker.caregiverNames);
  }
  return [];
}

export function caregiverNames(caregivers: Caregiver[]): string[] {
  return caregivers.map((c) => c.name);
}

export function countAdmins(caregivers: Caregiver[]): number {
  return caregivers.filter((c) => c.role === "admin").length;
}

export async function getTrackerBySecret(
  ctx: DbCtx,
  secretLink: string
): Promise<Doc<"trackers"> | null> {
  return await ctx.db
    .query("trackers")
    .withIndex("by_secret", (q) => q.eq("secretLink", secretLink))
    .first();
}

export async function verifyCaregiver(
  ctx: DbCtx,
  secretLink: string,
  actingCaregiverName: string
): Promise<{ tracker: Doc<"trackers">; caregivers: Caregiver[] }> {
  const tracker = await getTrackerBySecret(ctx, secretLink);
  if (!tracker) {
    throw new Error("Tracker not found");
  }

  const caregivers = getCaregivers(tracker);
  const actor = caregivers.find((c) => c.name === actingCaregiverName.trim());
  if (!actor) {
    throw new Error("Caregiver not found on this tracker");
  }

  return { tracker, caregivers };
}

/**
 * Resolve the village from the secret link and ensure the actor is listed.
 * If trackerId is also passed, it must match (stops IDOR with a stolen id).
 */
export async function requireTrackerAccess(
  ctx: DbCtx,
  secretLink: string,
  actingCaregiverName: string,
  trackerId?: Id<"trackers">
): Promise<{ tracker: Doc<"trackers">; caregivers: Caregiver[] }> {
  const result = await verifyCaregiver(ctx, secretLink, actingCaregiverName);
  if (trackerId !== undefined && result.tracker._id !== trackerId) {
    throw new Error("Tracker not found");
  }
  return result;
}

/**
 * Load an entry and prove it belongs to the village identified by secretLink.
 */
export async function requireOwnedEntry<TableName extends TableNames>(
  ctx: DbCtx,
  secretLink: string,
  actingCaregiverName: string,
  entryId: Id<TableName>,
  notFoundMessage = "Entry not found"
): Promise<{
  tracker: Doc<"trackers">;
  caregivers: Caregiver[];
  entry: Doc<TableName>;
}> {
  const { tracker, caregivers } = await verifyCaregiver(
    ctx,
    secretLink,
    actingCaregiverName
  );
  const entry = await ctx.db.get(entryId);
  if (
    !entry ||
    !("trackerId" in entry) ||
    entry.trackerId !== tracker._id
  ) {
    throw new Error(notFoundMessage);
  }
  return { tracker, caregivers, entry };
}

/**
 * Admin power comes from SSO ownership of the village, not from picking an
 * admin caregiver name on the shared lock screen.
 */
export async function verifyAdmin(
  ctx: QueryCtx | MutationCtx,
  secretLink: string,
  actingCaregiverName: string
): Promise<{ tracker: Doc<"trackers">; caregivers: Caregiver[] }> {
  const { tracker, caregivers } = await verifyCaregiver(
    ctx,
    secretLink,
    actingCaregiverName
  );

  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Sign in required for admin actions");
  }
  if (tracker.ownerUserId === undefined) {
    throw new Error("Claim this village on the home screen to manage it");
  }
  if (tracker.ownerUserId !== userId) {
    throw new Error("Admin access required");
  }

  return { tracker, caregivers };
}

export function normalizeTrackerForClient(tracker: Doc<"trackers">) {
  const caregivers = getCaregivers(tracker);
  return {
    _id: tracker._id,
    _creationTime: tracker._creationTime,
    secretLink: tracker.secretLink,
    ownerUserId: tracker.ownerUserId,
    babyName: tracker.babyName,
    birthDate: tracker.birthDate,
    sex: tracker.sex,
    photoStorageId: tracker.photoStorageId,
    timezone: tracker.timezone,
    caregivers,
    feedIntervalHours: tracker.feedIntervalHours,
    nightFeedIntervalEnabled: tracker.nightFeedIntervalEnabled,
    nightFeedIntervalHours: tracker.nightFeedIntervalHours,
    nightFeedWindowStart: tracker.nightFeedWindowStart,
    nightFeedWindowEnd: tracker.nightFeedWindowEnd,
    notifyBeforeMinutes: tracker.notifyBeforeMinutes,
    feedRemindersEnabled: tracker.feedRemindersEnabled,
    wakeWindowMinutes: tracker.wakeWindowMinutes,
    napRemindersEnabled: tracker.napRemindersEnabled,
    medicationReminders: tracker.medicationReminders,
    pumpSchedule: tracker.pumpSchedule,
    createdAt: tracker.createdAt,
  };
}
