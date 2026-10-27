/**
 * Dismissible “timing pushed” acknowledgment after a late feed.
 * Keyed by feed entry id so the tip shows once per late feed.
 */

const PREFIX = "feedLateAckDismissed:";

export function isLateFeedAckDismissed(feedEntryId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(PREFIX + feedEntryId) === "1";
  } catch {
    return false;
  }
}

export function dismissLateFeedAck(feedEntryId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + feedEntryId, "1");
  } catch {
    // ignore quota / private mode
  }
}
