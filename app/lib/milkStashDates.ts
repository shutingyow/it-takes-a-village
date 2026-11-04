const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar YYYY-MM-DD for a timestamp (or today). */
export function toLocalIsoDate(ms: number = Date.now()): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Start of local day for an ISO date, or null if invalid. */
export function parseIsoDateLocal(iso: string): number | null {
  const match = ISO_DATE_RE.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const local = new Date(year, month - 1, day);
  if (
    local.getFullYear() !== year ||
    local.getMonth() + 1 !== month ||
    local.getDate() !== day
  ) {
    return null;
  }
  return local.getTime();
}

/**
 * Resolve freeze date for a bag: frozenOn → ISO label → pumpedAt/createdAt day.
 */
export function resolveFrozenOn(bag: {
  frozenOn?: string;
  label?: string;
  pumpedAt?: number;
  createdAt: number;
}): string {
  if (bag.frozenOn && ISO_DATE_RE.test(bag.frozenOn)) return bag.frozenOn;
  if (bag.label && ISO_DATE_RE.test(bag.label.trim())) return bag.label.trim();
  return toLocalIsoDate(bag.pumpedAt ?? bag.createdAt);
}

/** Whole days from freeze date through today (0 if same day). */
export function daysFrozen(
  frozenOn: string,
  nowMs: number = Date.now()
): number {
  const start = parseIsoDateLocal(frozenOn);
  if (start == null) return 0;
  const today = parseIsoDateLocal(toLocalIsoDate(nowMs));
  if (today == null) return 0;
  const diff = Math.floor((today - start) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}
