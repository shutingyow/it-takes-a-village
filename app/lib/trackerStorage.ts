const LAST_TRACKER_KEY = "lastVisitedTracker";

export type LastVisitedTracker = {
  secretLink: string;
  babyName?: string;
  visitedAt: number;
};

/**
 * Accept a full tracker URL, a /tracker/... path, or just the path segment
 * after /tracker/ (unguessable id). IDs are nanoid(16) URL-safe strings.
 */
export function parseTrackerSecretInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromPath = trimmed.match(/\/tracker\/([A-Za-z0-9_-]+)/i);
  if (fromPath?.[1]) {
    return fromPath[1];
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://x.invalid/${trimmed}`
    );
    const parts = url.pathname.split("/").filter(Boolean);
    const trackerIdx = parts.findIndex((p) => p.toLowerCase() === "tracker");
    if (trackerIdx >= 0 && parts[trackerIdx + 1]) {
      return parts[trackerIdx + 1];
    }
  } catch {
    // not a URL
  }

  if (/^[A-Za-z0-9_-]{10,32}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function getLastVisitedTracker(): LastVisitedTracker | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_TRACKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastVisitedTracker;
    if (typeof parsed.secretLink !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLastVisitedTracker(
  secretLink: string,
  babyName?: string
): void {
  if (typeof window === "undefined") return;
  const entry: LastVisitedTracker = {
    secretLink,
    babyName,
    visitedAt: Date.now(),
  };
  localStorage.setItem(LAST_TRACKER_KEY, JSON.stringify(entry));
}

export function lockedCaregiverKey(secretLink: string): string {
  return `lockedCaregiver:${secretLink}`;
}

/** @deprecated Use lockedCaregiverKey */
export function caregiverStorageKey(secretLink: string): string {
  return lockedCaregiverKey(secretLink);
}

export function getLockedCaregiver(secretLink: string): string | null {
  if (typeof window === "undefined") return null;
  const key = lockedCaregiverKey(secretLink);
  const locked = localStorage.getItem(key);
  if (locked) return locked;

  // Migrate from legacy key
  const legacy = localStorage.getItem(`caregiver:${secretLink}`);
  if (legacy) {
    localStorage.setItem(key, legacy);
    localStorage.removeItem(`caregiver:${secretLink}`);
    return legacy;
  }
  return null;
}

/** @deprecated Use getLockedCaregiver */
export function getSavedCaregiver(secretLink: string): string | null {
  return getLockedCaregiver(secretLink);
}

export function setLockedCaregiver(secretLink: string, caregiver: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(lockedCaregiverKey(secretLink), caregiver);
}

/** @deprecated Use setLockedCaregiver */
export function saveCaregiver(secretLink: string, caregiver: string): void {
  setLockedCaregiver(secretLink, caregiver);
}

export function clearLockedCaregiver(secretLink: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(lockedCaregiverKey(secretLink));
  localStorage.removeItem(`caregiver:${secretLink}`);
}

export type CaregiverInfo = {
  name: string;
  role: "admin" | "caregiver";
};

export function isAdminCaregiver(
  caregivers: CaregiverInfo[],
  name: string
): boolean {
  return caregivers.some((c) => c.name === name && c.role === "admin");
}
