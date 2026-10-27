import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const medicationReminderValidator = v.object({
  name: v.string(),
  intervalHours: v.number(),
  lastLoggedAt: v.optional(v.number()),
});

const pumpScheduleValidator = v.object({
  enabled: v.boolean(),
  times: v.array(v.string()), // "HH:mm" wall-clock times (fixed mode)
  amountMl: v.optional(v.number()),
  timezone: v.optional(v.string()), // e.g. "Asia/Singapore"
  /** Fixed clock slots (default) or every N hours after last pump. */
  mode: v.optional(v.union(v.literal("fixed"), v.literal("interval"))),
  /** Hours between pumps when mode is "interval" (e.g. 4). */
  intervalHours: v.optional(v.number()),
});

const diaperColourValidator = v.union(
  v.literal("yellow"),
  v.literal("green"),
  v.literal("brown"),
  v.literal("black"),
  v.literal("red"),
  v.literal("white"),
  v.literal("other")
);

const diaperConsistencyValidator = v.union(
  v.literal("seedy"),
  v.literal("loose"),
  v.literal("firm"),
  v.literal("watery"),
  v.literal("mucous"),
  v.literal("other")
);

export default defineSchema({
  ...authTables,

  // Tracker configuration
  trackers: defineTable({
    secretLink: v.string(), // Unique secret for access
    /** Convex Auth user who created the tracker (admin owner). Optional for legacy. */
    ownerUserId: v.optional(v.id("users")),
    babyName: v.optional(v.string()), // Optional baby name for personalization
    birthDate: v.optional(v.string()), // YYYY-MM-DD for age display
    photoStorageId: v.optional(v.id("_storage")),
    caregivers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          role: v.union(v.literal("admin"), v.literal("caregiver")),
        })
      )
    ),
    caregiverNames: v.optional(v.array(v.string())), // legacy — migrated on read
    feedIntervalHours: v.optional(v.number()),
    /**
     * Longer overnight feed gap. When enabled, feeds logged inside the night
     * window (local Asia/Singapore by default) use nightFeedIntervalHours.
     * Defaults applied in feedSchedule when unset.
     */
    nightFeedIntervalEnabled: v.optional(v.boolean()),
    nightFeedIntervalHours: v.optional(v.number()),
    /** Local HH:mm inclusive start, e.g. "22:00". */
    nightFeedWindowStart: v.optional(v.string()),
    /** Local HH:mm exclusive end, e.g. "07:00". */
    nightFeedWindowEnd: v.optional(v.string()),
    /** Minutes before due time to fire device notifications (0 = at due). Default 10. */
    notifyBeforeMinutes: v.optional(v.number()),
    /** Typical awake time after a nap ends before the next nap is due (minutes). */
    wakeWindowMinutes: v.optional(v.number()),
    medicationReminders: v.optional(v.array(medicationReminderValidator)),
    pumpSchedule: v.optional(pumpScheduleValidator),
    createdAt: v.number(),
  })
    .index("by_secret", ["secretLink"])
    .index("by_owner", ["ownerUserId"]),

  // Feed entries
  feedEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(
      v.literal("breast"),
      v.literal("bottle"),
      v.literal("solids")
    ),
    // Nursing (at-breast) fields
    side: v.optional(v.union(v.literal("left"), v.literal("right"))),
    duration: v.optional(v.number()), // minutes (kept in sync with durationMinutes)
    // How long this feed lasted. Optional so older rows stay valid. Both breast and bottle.
    durationMinutes: v.optional(v.number()),
    // Bottle feeding fields
    amount: v.optional(v.number()), // ml
    bottleMilk: v.optional(
      v.union(v.literal("formula"), v.literal("breastmilk"))
    ),
    bottleTemperature: v.optional(
      v.union(v.literal("room"), v.literal("warm40"))
    ),
    // Solids fields (food name + optional grams; does not move milk due)
    foodName: v.optional(v.string()),
    amountGrams: v.optional(v.number()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Sleep entries
  sleepEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()), // null if sleep is ongoing
    // Typed minutes, kept in sync with endTime when the caregiver enters a duration.
    durationMinutes: v.optional(v.number()),
    type: v.union(v.literal("nap"), v.literal("night")),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_start", ["trackerId", "startTime"])
    .index("by_tracker_active", ["trackerId", "endTime"]), // for finding active sleep

  // Diaper entries
  diaperEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("wet"), v.literal("dirty"), v.literal("both")),
    colour: v.optional(diaperColourValidator),
    consistency: v.optional(diaperConsistencyValidator),
    timestamp: v.number(),
    notes: v.optional(v.string()),
    photoIds: v.optional(v.array(v.id("_storage"))),
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
    photoIds: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Health entries
  healthEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("temperature"), v.literal("medication"), v.literal("weight")),
    // Temperature
    temperature: v.optional(v.number()), // Celsius
    // Medication
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    // Weight
    weight: v.optional(v.number()), // kg
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

  // One diary / feelings entry per calendar day (Asia/Singapore dateKey)
  diaryEntries: defineTable({
    trackerId: v.id("trackers"),
    dateKey: v.string(), // YYYY-MM-DD in Asia/Singapore
    content: v.string(),
    mood: v.optional(
      v.union(
        v.literal("happy"),
        v.literal("calm"),
        v.literal("tired"),
        v.literal("stressed"),
        v.literal("grateful")
      )
    ),
    caregiverName: v.string(),
    updatedAt: v.number(),
  }).index("by_tracker_and_date", ["trackerId", "dateKey"]),

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

  // Growth measurements — weight kg; height (length) & head circumference in cm
  growthEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    date: v.string(), // YYYY-MM-DD
    weight: v.optional(v.number()), // kg
    length: v.optional(v.number()), // height/length in cm
    headCircumference: v.optional(v.number()), // cm
    notes: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_date", ["trackerId", "date"]),

  // Timed play / care activities (tummy, playmat, shower, massage)
  activityEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    kind: v.union(
      v.literal("tummy"),
      v.literal("playmat"),
      v.literal("shower"),
      v.literal("massage")
    ),
    timestamp: v.number(),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Short ad-hoc moments — separate from the daily diary and handover notes
  momentEntries: defineTable({
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    preset: v.optional(
      v.union(
        v.literal("kicked"),
        v.literal("smiled"),
        v.literal("rolled"),
        v.literal("temperature"),
        v.literal("sick")
      )
    ),
    text: v.optional(v.string()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_and_time", ["trackerId", "timestamp"]),

  // Development milestones
  milestones: defineTable({
    trackerId: v.id("trackers"),
    title: v.string(),
    category: v.optional(v.string()),
    predefinedKey: v.optional(v.string()),
    isCustom: v.boolean(),
    achievedAt: v.optional(v.number()),
    sortOrder: v.number(),
  }).index("by_tracker", ["trackerId"]),
});
