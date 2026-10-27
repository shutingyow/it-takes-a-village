import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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

const ADMIN_NAME = "Mommy (Shuting)";

export function isAdminName(name: string): boolean {
  return name.trim().toLowerCase() === ADMIN_NAME.toLowerCase();
}

export function assignRoles(names: string[]): Caregiver[] {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];

  const hasNamedAdmin = trimmed.some(isAdminName);
  return trimmed.map((name, index) => ({
    name,
    role:
      isAdminName(name) || (!hasNamedAdmin && index === 0) ? "admin" : "caregiver",
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
  ctx: QueryCtx | MutationCtx,
  secretLink: string
): Promise<Doc<"trackers"> | null> {
  return await ctx.db
    .query("trackers")
    .withIndex("by_secret", (q) => q.eq("secretLink", secretLink))
    .first();
}

export async function verifyCaregiver(
  ctx: QueryCtx | MutationCtx,
  secretLink: string,
  actingCaregiverName: string
): Promise<{ tracker: Doc<"trackers">; caregivers: Caregiver[] }> {
  const tracker = await getTrackerBySecret(ctx, secretLink);
  if (!tracker) {
    throw new Error("Tracker not found");
  }

  const caregivers = getCaregivers(tracker);
  const actor = caregivers.find((c) => c.name === actingCaregiverName);
  if (!actor) {
    throw new Error("Caregiver not found on this tracker");
  }

  return { tracker, caregivers };
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
    photoStorageId: tracker.photoStorageId,
    caregivers,
    feedIntervalHours: tracker.feedIntervalHours,
    nightFeedIntervalEnabled: tracker.nightFeedIntervalEnabled,
    nightFeedIntervalHours: tracker.nightFeedIntervalHours,
    nightFeedWindowStart: tracker.nightFeedWindowStart,
    nightFeedWindowEnd: tracker.nightFeedWindowEnd,
    notifyBeforeMinutes: tracker.notifyBeforeMinutes,
    wakeWindowMinutes: tracker.wakeWindowMinutes,
    medicationReminders: tracker.medicationReminders,
    pumpSchedule: tracker.pumpSchedule,
    createdAt: tracker.createdAt,
  };
}
