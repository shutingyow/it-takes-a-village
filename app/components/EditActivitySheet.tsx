"use client";

import type { ActivityEntry } from "./ActivityEntryCard";
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
  secretLink: string;
  selectedCaregiver: string;
  onClose: () => void;
  birthDate?: string;
}

export function EditActivitySheet({
  entry,
  secretLink,
  selectedCaregiver,
  onClose,
  birthDate,
}: EditActivitySheetProps) {
  if (entry.entryType === "feed") {
    return (
      <FeedModal
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        birthDate={birthDate}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "diaper") {
    return (
      <DiaperModal
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
        secretLink={secretLink}
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
        secretLink={secretLink}
        selectedCaregiver={selectedCaregiver}
        editEntry={entry}
        onClose={onClose}
      />
    );
  }

  if (entry.entryType === "sleep") {
    return (
      <SleepModal
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
    // In-progress nap → Sleep modal so caregivers get End sleep now.
    if (entry.endTime == null) {
      return (
        <SleepModal
          secretLink={secretLink}
          selectedCaregiver={selectedCaregiver}
          editEntry={entry}
          onClose={onClose}
        />
      );
    }
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
