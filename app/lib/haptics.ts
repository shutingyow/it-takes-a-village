import { Capacitor } from "@capacitor/core";

/** Light success tap after logging an entry. No-ops on web. */
export async function hapticSuccess(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Plugin missing or unsupported.
  }
}

/** Soft selection tick (toggles, option chips). */
export async function hapticSelection(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionChanged();
  } catch {
    // ignore
  }
}
