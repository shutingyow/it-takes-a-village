/**
 * Dismissible “Got it” for an overdue What’s due *guide* row (schedule clock).
 * Keyed by kind + dueAt so the same overdue clears until a new log changes
 * dueAt. Device-local only — does not change interval delivery / lock screen.
 * Same pattern as feedScheduleAck.
 */

export type OverdueAckKind = "feed" | "nap" | "pump" | "sleep";

const PREFIX = "overdueAckDismissed:";

function storageKey(kind: OverdueAckKind, dueAt: number): string {
  return `${PREFIX}${kind}:${dueAt}`;
}

export function isOverdueAckDismissed(
  kind: OverdueAckKind,
  dueAt: number
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey(kind, dueAt)) === "1";
  } catch {
    return false;
  }
}

export function dismissOverdueAck(
  kind: OverdueAckKind,
  dueAt: number
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(kind, dueAt), "1");
    window.dispatchEvent(new Event("overdueAckChanged"));
  } catch {
    // ignore quota / private mode
  }
}

/** Map a due item to the ack kind used for localStorage. */
export function overdueAckKindForItem(item: {
  type: "feed" | "medication" | "pump" | "sleep";
  label: string;
}): OverdueAckKind | null {
  if (item.type === "feed") return "feed";
  if (item.type === "pump") return "pump";
  if (item.type === "sleep") {
    return item.label === "sleep" ? "sleep" : "nap";
  }
  return null;
}
