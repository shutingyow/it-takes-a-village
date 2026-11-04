import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwnedEntry, verifyCaregiver } from "./lib/caregivers";

// Create an appointment
export const create = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    title: v.string(),
    date: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("appointments"),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    return await ctx.db.insert("appointments", {
      trackerId: tracker._id,
      caregiverName: args.actingCaregiverName.trim(),
      title: args.title,
      date: args.date,
      location: args.location,
      notes: args.notes,
    });
  },
});

// Get upcoming appointments
export const getUpcoming = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
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
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const results = await ctx.db
      .query("appointments")
      .withIndex("by_tracker_and_date", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("asc")
      .collect();

    return results.filter((appointment) => appointment.date >= args.now);
  },
});

// Get all appointments
export const getAll = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
  },
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    return await ctx.db
      .query("appointments")
      .withIndex("by_tracker_and_date", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .collect();
  },
});

// Update an appointment
export const update = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    appointmentId: v.id("appointments"),
    title: v.optional(v.string()),
    date: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.appointmentId,
      "Appointment not found"
    );

    const cleanUpdates = Object.fromEntries(
      Object.entries({
        title: args.title,
        date: args.date,
        location: args.location,
        notes: args.notes,
      }).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(args.appointmentId, cleanUpdates);
    return null;
  },
});

// Delete an appointment
export const remove = mutation({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    appointmentId: v.id("appointments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnedEntry(
      ctx,
      args.secretLink,
      args.actingCaregiverName,
      args.appointmentId,
      "Appointment not found"
    );
    await ctx.db.delete(args.appointmentId);
    return null;
  },
});
