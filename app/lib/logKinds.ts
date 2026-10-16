import type { TranslationKey } from "@/app/lib/i18n/en";

export const ACTIVITY_KINDS = ["tummy", "playmat", "shower", "massage"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const MOMENT_PRESETS = [
  "kicked",
  "smiled",
  "rolled",
  "temperature",
  "sick",
] as const;
export type MomentPreset = (typeof MOMENT_PRESETS)[number];

export const activityKindKey: Record<ActivityKind, TranslationKey> = {
  tummy: "activityTummy",
  playmat: "activityPlaymat",
  shower: "activityShower",
  massage: "activityMassage",
};

export const momentPresetKey: Record<MomentPreset, TranslationKey> = {
  kicked: "momentKicked",
  smiled: "momentSmiled",
  rolled: "momentRolled",
  temperature: "momentTemperature",
  sick: "momentSick",
};
