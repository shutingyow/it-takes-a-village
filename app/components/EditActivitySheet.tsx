"use client";

import type { ActivityEntry } from "./ActivityEntryCard";
import { Id } from "@/convex/_generated/dataModel";
import { FeedModal } from "./modals/FeedModal";
import { DiaperModal } from "./modals/DiaperModal";
import { PumpModal } from "./modals/PumpModal";
import { HealthModal } from "./modals/HealthModal";
import { GrowthModal } from "./modals/GrowthModal";
import { SleepModal } from "./modals/SleepModal";
import { ActivityModal } from "./modals/ActivityModal";
import { MomentModal } from "./modals/MomentModal";
import { NapModal } from "./modals/NapModal";

interface EditActivitySheetProps {
  entry: ActivityEntry;
  trackerId: Id<"trackers">;
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
}

export function EditActivitySheet({
  entry,
  trackerId,
  secretLink,
  selectedCaregiver,
  onClose,
}: EditActivitySheetProps) {
  if (entry.entryType === "feed") {
    return (
      <FeedModal
        trackerId={trackerId}
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "diaper") {
    return (
      <DiaperModal
        trackerId={trackerId}
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "pump") {
    return (
      <PumpModal
        trackerId={trackerId}
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "health") {
    return (
      <HealthModal
        trackerId={trackerId}
        selectedCaregiver={selectedCaregiver}
        healthType={
          entry.type === "weight" ? "weight" : entry.type === "medication" ? "medication" : "temperature"
        }
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "growth") {
    return (
      <GrowthModal
        trackerId={trackerId}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "sleep") {
    return (
      <SleepModal
        trackerId={trackerId}
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "activity") {
    return (
      <ActivityModal
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "moment") {
    return (
      <MomentModal
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "nap") {
    return (
      <NapModal
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  return null;
}
