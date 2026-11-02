import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** Noticeable tap after logging an entry. No-ops on web. */
export async function hapticSuccess(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Medium is easier to feel than Light on a phone in hand.
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Plugin missing or unsupported.
  }
}

/** Soft selection tick (toggles, option chips). */
export async function hapticSelection(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.selectionChanged();
  } catch {
    // ignore
  }
}
