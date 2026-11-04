/**
 * Shared save-time checks for care log entries.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Allow small clock skew; reject clearly future stamps. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function assertIsoDate(value: string, label = "Date"): string {
  const trimmed = value.trim();
  const match = ISO_DATE_RE.exec(trimmed);
  if (!match) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() + 1 !== month ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a real calendar day`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function assertNotFarFuture(timestamp: number, now = Date.now()): void {
  if (!Number.isFinite(timestamp)) {
    throw new Error("Invalid timestamp");
  }
  if (timestamp > now + FUTURE_SKEW_MS) {
    throw new Error("Time can’t be in the future");
  }
}

export function assertNonNegative(
  value: number | undefined,
  label: string
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} can’t be negative`);
  }
}

export function assertPositive(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

export function assertRange(
  value: number,
  min: number,
  max: number,
  label: string
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
}

export function assertSleepRange(startTime: number, endTime?: number): void {
  assertNotFarFuture(startTime);
  if (endTime !== undefined) {
    assertNotFarFuture(endTime);
    if (endTime < startTime) {
      throw new Error("Sleep end can’t be before start");
    }
  }
}
