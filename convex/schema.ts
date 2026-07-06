import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tracker configuration
  trackers: defineTable({
    secretLink: v.string(), // Unique secret for access
    caregiverNames: v.array(v.string()), // Up to 4 caregiver names
    createdAt: v.number(),
  }).index("by_secret", ["secretLink"]),

  // Feed entries
  feedEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("breast"), v.literal("bottle")),
    // Breast feeding fields
    side: v.optional(v.union(v.literal("left"), v.literal("right"))),
    duration: v.optional(v.number()), // minutes
    // Bottle feeding fields
    amount: v.optional(v.number()), // ml
    timestamp: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Sleep entries
  sleepEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()), // null if sleep is ongoing
    type: v.union(v.literal("nap"), v.literal("night")),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_start", ["trackerId", "startTime"])
    .index("by_tracker_active", ["trackerId", "endTime"]), // for finding active sleep

  // Diaper entries
  diaperEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Pump entries
  pumpEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    amount: v.number(), // ml
    side: v.optional(v.union(v.literal("left"), v.literal("right"), v.literal("both"))),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Health entries
  healthEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("temperature"), v.literal("medication"), v.literal("weight")),
    // Temperature
    temperature: v.optional(v.number()), // Fahrenheit
    // Medication
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    // Weight
    weight: v.optional(v.number()), // lbs
    timestamp: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"])
    .index("by_tracker_and_type", ["trackerId", "type"]),

  // Handover notes
  notes: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    content: v.string(),
    photoIds: v.array(v.id("_storage")), // Convex file storage IDs
    timestamp: v.number(),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Supply alerts
  supplyAlerts: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    item: v.string(),
    isActive: v.boolean(), // false when marked as restocked
    timestamp: v.number(),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_active", ["trackerId", "isActive"]),

  // Appointments
  appointments: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    title: v.string(),
    date: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_date", ["trackerId", "date"]),
});
