import {
  clearLockedCaregiver,
  saveLastVisitedTracker,
  setLockedCaregiver,
} from "@/app/lib/trackerStorage";

/**
 * After removing a caregiver, optionally rotate the village link and move
 * local lock-screen state to the new URL.
 */
export async function rotateVillageLinkAfterRemove(opts: {
  confirmRotate: boolean;
  regenerate: () => Promise<string>;
  oldSecretLink: string;
  selectedCaregiver: string;
  babyName?: string;
  navigate: (newSecret: string) => void;
}): Promise<"rotated" | "kept"> {
  if (!opts.confirmRotate) return "kept";
  const newSecret = await opts.regenerate();
  clearLockedCaregiver(opts.oldSecretLink);
  saveLastVisitedTracker(newSecret, opts.babyName);
  setLockedCaregiver(newSecret, opts.selectedCaregiver);
  opts.navigate(newSecret);
  return "rotated";
}
