import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create an appointment
export const create = mutation({
  args: {
    trackerId: v.id("trackers"),
    caregiverName: v.string(),
    title: v.string(),
    date: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("appointments"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("appointments", args);
  },
});

// Get upcoming appointments
export const getUpcoming = query({
  args: {
    trackerId: v.id("trackers"),
    now: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id("appointments"),
      _creationTime: v.number(),
      trackerId: v.id("trackers"),
      caregiverName: v.string(),
      title: v.string(),
      date: v.number(),
      location: v.optional(v.string()),
      notes: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("appointments")
      .withIndex("by_tracker_and_date", (q) =>
        q.eq("trackerId", args.trackerId)
      )
      .order("asc")
      .collect();

    return results.filter((appointment) => appointment.date >= args.now);
  },
});

// Get all appointments
export const getAll = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appointments")
      .withIndex("by_tracker_and_date", (q) => 
        q.eq("trackerId", args.trackerId)
      )
      .order("desc")
      .collect();
  },
});

// Update an appointment
export const update = mutation({
  args: {
    appointmentId: v.id("appointments"),
    title: v.optional(v.string()),
    date: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appointmentId, ...updates } = args;
    
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await ctx.db.patch(appointmentId, cleanUpdates);
    return null;
  },
});

// Delete an appointment
export const remove = mutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.appointmentId);
    return null;
  },
});
