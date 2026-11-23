const LAST_TRACKER_KEY = "lastVisitedTracker";

export type LastVisitedTracker = {
  secretLink: string;
  /** Personal invite token for this device’s caregiver identity. */
  inviteToken?: string;
  babyName?: string;
  visitedAt: number;
};

export type ParsedTrackerLink = {
  secretLink: string;
  inviteToken?: string;
};

/**
 * Accept a full tracker URL (with optional ?invite=), a /tracker/... path,
 * or just the path segment after /tracker/ (unguessable id).
 */
export function parseTrackerLinkInput(raw: string): ParsedTrackerLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://x.invalid/${trimmed}`
    );
    const parts = url.pathname.split("/").filter(Boolean);
    const trackerIdx = parts.findIndex((p) => p.toLowerCase() === "tracker");
    if (trackerIdx >= 0 && parts[trackerIdx + 1]) {
      const invite =
        url.searchParams.get("invite")?.trim() ||
        url.searchParams.get("cg")?.trim() ||
        undefined;
      return {
        secretLink: parts[trackerIdx + 1]!,
        inviteToken: invite || undefined,
      };
    }
  } catch {
    // not a URL
  }

  const fromPath = trimmed.match(
    /\/tracker\/([A-Za-z0-9_-]+)(?:\?([^#]*))?/i
  );
  if (fromPath?.[1]) {
    let invite: string | undefined;
    if (fromPath[2]) {
      const params = new URLSearchParams(fromPath[2]);
      invite =
        params.get("invite")?.trim() || params.get("cg")?.trim() || undefined;
    }
    return { secretLink: fromPath[1], inviteToken: invite };
  }

  if (/^[A-Za-z0-9_-]{10,32}$/.test(trimmed)) {
    return { secretLink: trimmed };
  }

  return null;
}

/** @deprecated Prefer parseTrackerLinkInput — invite tokens are ignored. */
export function parseTrackerSecretInput(raw: string): string | null {
  return parseTrackerLinkInput(raw)?.secretLink ?? null;
}

export function trackerPath(
  secretLink: string,
  inviteToken?: string | null
): string {
  const base = `/tracker/${secretLink}`;
  if (!inviteToken) return base;
  return `${base}?invite=${encodeURIComponent(inviteToken)}`;
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
  babyName?: string,
  inviteToken?: string | null
): void {
  if (typeof window === "undefined") return;
  const prev = getLastVisitedTracker();
  const entry: LastVisitedTracker = {
    secretLink,
    babyName,
    visitedAt: Date.now(),
    inviteToken:
      inviteToken !== undefined && inviteToken !== null
        ? inviteToken || undefined
        : prev?.secretLink === secretLink
          ? prev.inviteToken
          : undefined,
  };
  localStorage.setItem(LAST_TRACKER_KEY, JSON.stringify(entry));
}

export function lockedCaregiverKey(secretLink: string): string {
  return `lockedCaregiver:${secretLink}`;
}

function inviteTokenKey(secretLink: string): string {
  return `inviteToken:${secretLink}`;
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

export function getSavedInviteToken(secretLink: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(inviteTokenKey(secretLink));
}

/** @deprecated Use getLockedCaregiver */
export function getSavedCaregiver(secretLink: string): string | null {
  return getLockedCaregiver(secretLink);
}

export function setLockedCaregiver(
  secretLink: string,
  caregiver: string,
  inviteToken?: string | null
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(lockedCaregiverKey(secretLink), caregiver);
  if (inviteToken) {
    localStorage.setItem(inviteTokenKey(secretLink), inviteToken);
  }
}

/** @deprecated Use setLockedCaregiver */
export function saveCaregiver(secretLink: string, caregiver: string): void {
  setLockedCaregiver(secretLink, caregiver);
}

export function clearLockedCaregiver(secretLink: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(lockedCaregiverKey(secretLink));
  localStorage.removeItem(`caregiver:${secretLink}`);
  localStorage.removeItem(inviteTokenKey(secretLink));
}

export type CaregiverInfo = {
  name: string;
  role: "admin" | "caregiver";
  inviteToken?: string;
};

export function isAdminCaregiver(
  caregivers: CaregiverInfo[],
  name: string
): boolean {
  return caregivers.some((c) => c.name === name && c.role === "admin");
}

/**
 * Names the SSO village owner may lock to for logging.
 * Owners use admin caregiver identities only — not the full caregiver list.
 */
export function ownerLoggingCaregivers(
  caregivers: CaregiverInfo[]
): CaregiverInfo[] {
  const admins = caregivers.filter((c) => c.role === "admin");
  return admins.length > 0 ? admins : caregivers.slice(0, 1);
}

export function caregiverInviteUrl(
  secretLink: string,
  inviteToken: string,
  origin?: string
): string {
  const base =
    origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://takesavillage.co");
  return `${base}${trackerPath(secretLink, inviteToken)}`;
}
