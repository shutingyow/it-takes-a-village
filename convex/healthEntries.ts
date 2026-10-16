import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a health entry
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    type: v.union(v.literal("temperature"), v.literal("medication"), v.literal("weight")),
    temperature: v.optional(v.number()),
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    weight: v.optional(v.number()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("healthEntries"),
  handler: async (ctx, args) => {
    if (args.type === "temperature") {
      if (args.temperature === undefined) {
        throw new Error("Temperature is required");
      }
      if (args.temperature < 35 || args.temperature > 42) {
        throw new Error("Temperature must be between 35°C and 42°C");
      }
    }
    if (args.type === "weight") {
      if (args.weight === undefined) {
        throw new Error("Weight is required");
      }
      if (args.weight < 1 || args.weight > 30) {
        throw new Error("Weight must be between 1 kg and 30 kg");
      }
    }
    return await ctx.db.insert("healthEntries", args);
  },
});

// Get recent health entries
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

// Get recent health entries by type
export const getByType = query({
  args: {
    trackerId: v.id("trackers"),
    type: v.union(v.literal("temperature"), v.literal("medication"), v.literal("weight")),
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

// Update a health entry (full replace of editable fields)
export const update = mutation({
  args: {
    entryId: v.id("healthEntries"),
    type: v.union(
      v.literal("temperature"),
      v.literal("medication"),
      v.literal("weight")
    ),
    temperature: v.optional(v.number()),
    medicationName: v.optional(v.string()),
    dosage: v.optional(v.string()),
    weight: v.optional(v.number()),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.entryId);
    if (!existing) {
      throw new Error("Health entry not found");
    }

    if (args.type === "temperature") {
      if (args.temperature === undefined) {
        throw new Error("Temperature is required");
      }
      if (args.temperature < 35 || args.temperature > 42) {
        throw new Error("Temperature must be between 35°C and 42°C");
      }
    }
    if (args.type === "weight") {
      if (args.weight === undefined) {
        throw new Error("Weight is required");
      }
      if (args.weight < 1 || args.weight > 30) {
        throw new Error("Weight must be between 1 kg and 30 kg");
      }
    }
    if (args.type === "medication" && !args.medicationName?.trim()) {
      throw new Error("Medication name is required");
    }

    await ctx.db.replace(args.entryId, {
      trackerId: existing.trackerId,
      caregiverName: existing.caregiverName,
      type: args.type,
      temperature: args.type === "temperature" ? args.temperature : undefined,
      medicationName:
        args.type === "medication" ? args.medicationName : undefined,
      dosage: args.type === "medication" ? args.dosage : undefined,
      weight: args.type === "weight" ? args.weight : undefined,
      timestamp: args.timestamp,
      notes: args.notes,
    });
    return null;
  },
});

// Delete a health entry
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
