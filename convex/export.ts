import { v } from "convex/values";
import { query } from "./_generated/server";

const exportRowValidator = v.object({
  category: v.string(),
  timestamp: v.number(),
  summary: v.string(),
  caregiverName: v.string(),
  notes: v.optional(v.string()),
});

export const getData = query({
  args: {
    trackerId: v.id("trackers"),
    days: v.union(v.literal(7), v.literal(30)),
    now: v.number(),
  },
  returns: v.object({
    rows: v.array(exportRowValidator),
    babyName: v.optional(v.string()),
    exportedAt: v.number(),
    rangeDays: v.number(),
  }),
  handler: async (ctx, args) => {
    const tracker = await ctx.db.get("trackers", args.trackerId);
    const rangeStart = args.now - args.days * 24 * 60 * 60 * 1000;
    const rows: Array<{
      category: string;
      timestamp: number;
      summary: string;
      caregiverName: string;
      notes?: string;
    }> = [];

    const feeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of feeds) {
      const milkLabel =
        e.bottleMilk === "formula"
          ? " · Formula"
          : e.bottleMilk === "breastmilk"
            ? " · Breast milk"
            : (() => {
                const notes = e.notes?.toLowerCase() ?? "";
                if (
                  notes.includes("breastmilk") ||
                  notes.includes("breast milk")
                ) {
                  return " · Breast milk";
                }
                if (notes.includes("formula")) return " · Formula";
                return "";
              })();
      const durationMinutes = e.durationMinutes ?? e.duration;
      const durationLabel =
        durationMinutes !== undefined ? ` ${durationMinutes}min` : "";
      let summary =
        e.type === "breast"
          ? `Nursing${e.side ? ` (${e.side})` : ""}${durationLabel}`
          : e.type === "solids"
            ? `Solids${e.foodName ? ` · ${e.foodName}` : ""}${
                e.amountGrams != null ? ` ${e.amountGrams}g` : ""
              }`
            : `Bottle${milkLabel} ${e.amount ?? "?"}ml${durationLabel}`;
      if (e.type === "bottle" && e.bottleTemperature === "room") {
        summary += " room temp";
      } else if (e.type === "bottle" && e.bottleTemperature === "warm40") {
        summary += " 40°C";
      }
      rows.push({
        category: "feed",
        timestamp: e.timestamp,
        summary,
        caregiverName: e.caregiverName,
        notes: e.notes,
      });
    }

    const sleepEntries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q.eq("trackerId", args.trackerId).gte("startTime", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of sleepEntries) {
      const durationMin =
        e.durationMinutes ??
        (e.endTime ? Math.floor((e.endTime - e.startTime) / 60000) : null);
      rows.push({
        category: e.type === "nap" ? "nap" : "sleep",
        timestamp: e.startTime,
        summary: `${e.type}${durationMin !== null ? ` ${durationMin}min` : " (active)"}`,
        caregiverName: e.caregiverName,
        notes: e.notes,
      });
    }

    const diapers = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of diapers) {
      const parts: string[] = [e.type];
      if (e.colour) parts.push(e.colour);
      if (e.consistency) parts.push(e.consistency);
      rows.push({
        category: "diaper",
        timestamp: e.timestamp,
        summary: parts.join(", "),
        caregiverName: e.caregiverName,
        notes: e.notes,
      });
    }

    const healthEntries = await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of healthEntries) {
      let summary: string = e.type;
      if (e.type === "temperature") summary = `${e.temperature ?? "?"}°C`;
      if (e.type === "medication")
        summary = `${e.medicationName}${e.dosage ? ` ${e.dosage}` : ""}`;
      if (e.type === "weight") summary = `${e.weight} kg`;
      rows.push({
        category: "health",
        timestamp: e.timestamp,
        summary,
        caregiverName: e.caregiverName,
        notes: e.notes,
      });
    }

    const momentEntries = await ctx.db
      .query("momentEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of momentEntries) {
      rows.push({
        category: "moment",
        timestamp: e.timestamp,
        summary: e.text?.trim() || e.preset || "moment",
        caregiverName: e.caregiverName,
        notes: e.notes,
      });
    }

    const activityEntries = await ctx.db
      .query("activityEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", args.trackerId).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of activityEntries) {
      rows.push({
        category: "activity",
        timestamp: e.timestamp,
        summary: `${e.kind}${e.durationMinutes ? ` ${e.durationMinutes}min` : ""}`,
        caregiverName: e.caregiverName,
        notes: e.notes,
      });
    }

    const growthEntries = await ctx.db
      .query("growthEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", args.trackerId))
      .filter((q) => q.gte(q.field("timestamp"), rangeStart))
      .order("desc")
      .take(500);

    for (const e of growthEntries) {
      const parts: string[] = [];
      if (e.weight != null) parts.push(`${e.weight} kg`);
      if (e.length != null) parts.push(`${e.length} cm`);
      if (e.headCircumference != null) parts.push(`HC ${e.headCircumference} cm`);
      rows.push({
        category: "growth",
        timestamp: e.timestamp,
        summary: parts.join(", ") || e.date,
        caregiverName: e.caregiverName,
        notes: e.notes,
      });
    }

    rows.sort((a, b) => b.timestamp - a.timestamp);

    return {
      rows,
      babyName: tracker?.babyName,
      exportedAt: args.now,
      rangeDays: args.days,
    };
  },
});
