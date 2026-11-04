import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertNotFarFuture,
  assertRange,
} from "./lib/entryValidation";

const healthTypeValidator = v.union(
  v.literal("temperature"),
  v.literal("medication"),
  v.literal("weight"),
  v.literal("vaccine"),
  v.literal("spitup")
);

function validateHealthFields(args: {
  type:
    | "temperature"
    | "medication"
    | "weight"
    | "vaccine"
    | "spitup";
  temperature?: number;
  medicationName?: string;
  dosage?: string;
  weight?: number;
  vaccineName?: string;
  timestamp: number;
}) {
  assertNotFarFuture(args.timestamp);
  if (args.type === "temperature") {
    if (args.temperature === undefined) {
      throw new Error("Temperature is required");
    }
    assertRange(args.temperature, 35, 42, "Temperature (°C)");
  }
  if (args.type === "weight") {
    if (args.weight === undefined) {
      throw new Error("Weight is required");
    }
    assertRange(args.weight, 1, 30, "Weight (kg)");
  }
  if (args.type === "medication" && !args.medicationName?.trim()) {
    throw new Error("Medication name is required");
  }
  if (args.type === "vaccine" && !args.vaccineName?.trim()) {
    throw new Error("Vaccine name is required");
  }
}

export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: healthTypeValidator,
    temperature: v.optional(v.number()),
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    weight: v.optional(v.number()),
    vaccineName: v.optional(v.string()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("healthEntries"),
  handler: async (ctx, args) => {
    validateHealthFields(args);
    return await ctx.db.insert("healthEntries", {
      trackerId: args.trackerId,
      caregiverName: args.caregiverName,
      type: args.type,
      temperature:
        args.type === "temperature" ? args.temperature : undefined,
      medicationName:
        args.type === "medication"
          ? args.medicationName?.trim()
          : undefined,
      dosage: args.type === "medication" ? args.dosage?.trim() : undefined,
      weight: args.type === "weight" ? args.weight : undefined,
      vaccineName:
        args.type === "vaccine" ? args.vaccineName?.trim() : undefined,
      timestamp: args.timestamp,
      notes: args.notes?.trim() || undefined,
    });
  },
});

export const getRecent = query({
  args: {
    trackerId: v.id("trackers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_time", (q) => q.eq("trackerId", args.trackerId))
      .order("desc")
      .take(limit);
  },
});

export const getByType = query({
  args: {
    trackerId: v.id("trackers"),
    type: healthTypeValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_type", (q) =>
        q.eq("trackerId", args.trackerId).eq("type", args.type)
      )
      .order("desc")
      .take(limit);
  },
});

export const update = mutation({
  args: {
    entryId: v.id("healthEntries"),
    type: healthTypeValidator,
    temperature: v.optional(v.number()),
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    weight: v.optional(v.number()),
    vaccineName: v.optional(v.string()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.entryId);
    if (!existing) {
      throw new Error("Health entry not found");
    }
    validateHealthFields(args);

    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      type: args.type,
      temperature:
        args.type === "temperature" ? args.temperature : undefined,
      medicationName:
        args.type === "medication"
          ? args.medicationName?.trim()
          : undefined,
      dosage: args.type === "medication" ? args.dosage?.trim() : undefined,
      weight: args.type === "weight" ? args.weight : undefined,
      vaccineName:
        args.type === "vaccine" ? args.vaccineName?.trim() : undefined,
      timestamp: args.timestamp,
      notes: args.notes?.trim() || undefined,
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    entryId: v.id("healthEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
    return null;
  },
});
