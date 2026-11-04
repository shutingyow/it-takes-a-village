import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifyCaregiver } from "./lib/caregivers";
import { DEFAULT_TRACKER_TIMEZONE } from "./lib/dayBounds";

const exportRowValidator = v.object({
  occurredAtUtc: v.string(),
  occurredLocalIso: v.string(),
  loggedAtUtc: v.string(),
  loggedLocalIso: v.string(),
  timezone: v.string(),
  category: v.string(),
  subcategory: v.string(),
  amount: v.optional(v.number()),
  unit: v.optional(v.string()),
  durationMinutes: v.optional(v.number()),
  milkType: v.optional(v.string()),
  side: v.optional(v.string()),
  stoolType: v.optional(v.string()),
  stoolColour: v.optional(v.string()),
  stoolTexture: v.optional(v.string()),
  measurementSource: v.optional(v.string()),
  /** YYYY-MM-DD freeze / expression date for stash bags. */
  expressedDate: v.optional(v.string()),
  caregiverName: v.string(),
  notes: v.optional(v.string()),
  /** Short preview line for the in-app list only. */
  summary: v.string(),
});

type ExportRow = {
  occurredAtUtc: string;
  occurredLocalIso: string;
  loggedAtUtc: string;
  loggedLocalIso: string;
  timezone: string;
  category: string;
  subcategory: string;
  amount?: number;
  unit?: string;
  durationMinutes?: number;
  milkType?: string;
  side?: string;
  stoolType?: string;
  stoolColour?: string;
  stoolTexture?: string;
  measurementSource?: string;
  expressedDate?: string;
  caregiverName: string;
  notes?: string;
  summary: string;
  sortAt: number;
};

function formatLocalIso(ms: number, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Midday UTC for a YYYY-MM-DD calendar date (stable sort key). */
function msFromIsoDate(isoDate: string): number {
  const ms = Date.parse(`${isoDate}T12:00:00.000Z`);
  return Number.isFinite(ms) ? ms : Date.now();
}

function stamps(occurredAt: number, loggedAt: number, timeZone: string) {
  return {
    occurredAtUtc: new Date(occurredAt).toISOString(),
    occurredLocalIso: formatLocalIso(occurredAt, timeZone),
    loggedAtUtc: new Date(loggedAt).toISOString(),
    loggedLocalIso: formatLocalIso(loggedAt, timeZone),
    timezone: timeZone,
    sortAt: occurredAt,
  };
}

export const getData = query({
  args: {
    secretLink: v.string(),
    actingCaregiverName: v.string(),
    days: v.union(v.literal(7), v.literal(30)),
    now: v.number(),
  },
  returns: v.object({
    rows: v.array(exportRowValidator),
    babyName: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    sex: v.optional(v.string()),
    timezone: v.string(),
    stashAvailableMl: v.number(),
    exportedAt: v.number(),
    exportedAtUtc: v.string(),
    rangeDays: v.number(),
  }),
  handler: async (ctx, args) => {
    const { tracker } = await verifyCaregiver(
      ctx,
      args.secretLink,
      args.actingCaregiverName
    );
    const timeZone =
      tracker?.pumpSchedule?.timezone ?? DEFAULT_TRACKER_TIMEZONE;
    const rangeStart = args.now - args.days * 24 * 60 * 60 * 1000;
    const rows: ExportRow[] = [];

    const feeds = await ctx.db
      .query("feedEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of feeds) {
      const durationMinutes = e.durationMinutes ?? e.duration;
      const milkType =
        e.type === "bottle"
          ? e.bottleMilk === "formula"
            ? "formula"
            : e.bottleMilk === "breastmilk"
              ? "breastmilk"
              : undefined
          : undefined;
      const summary =
        e.type === "breast"
          ? `Nursing${e.side ? ` (${e.side})` : ""}${
              durationMinutes != null ? ` ${durationMinutes}min` : ""
            }`
          : e.type === "solids"
            ? `Solids${e.foodName ? ` · ${e.foodName}` : ""}${
                e.amountGrams != null ? ` ${e.amountGrams}g` : ""
              }`
            : `Bottle${milkType ? ` · ${milkType}` : ""}${
                e.amount != null ? ` ${e.amount}ml` : ""
              }${durationMinutes != null ? ` ${durationMinutes}min` : ""}`;
      rows.push({
        ...stamps(e.timestamp, e._creationTime, timeZone),
        category: "feed",
        subcategory: e.type,
        amount:
          e.type === "bottle"
            ? e.amount
            : e.type === "solids"
              ? e.amountGrams
              : undefined,
        unit:
          e.type === "bottle" ? "ml" : e.type === "solids" ? "g" : undefined,
        durationMinutes,
        milkType,
        side: e.side,
        caregiverName: e.caregiverName,
        notes: e.notes,
        summary,
      });
    }

    const pumps = await ctx.db
      .query("pumpEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of pumps) {
      rows.push({
        ...stamps(e.timestamp, e._creationTime, timeZone),
        category: "pump",
        subcategory: "pump",
        amount: e.amount,
        unit: "ml",
        caregiverName: e.caregiverName,
        notes: e.notes,
        summary: `Pump ${e.amount}ml`,
      });
    }

    const sleepEntries = await ctx.db
      .query("sleepEntries")
      .withIndex("by_tracker_and_start", (q) =>
        q.eq("trackerId", tracker._id).gte("startTime", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of sleepEntries) {
      const durationMin =
        e.durationMinutes ??
        (e.endTime
          ? Math.floor((e.endTime - e.startTime) / 60000)
          : undefined);
      rows.push({
        ...stamps(e.startTime, e._creationTime, timeZone),
        category: "sleep",
        subcategory: e.type === "nap" ? "nap" : "night",
        durationMinutes: durationMin,
        caregiverName: e.caregiverName,
        notes: e.notes,
        summary: `${e.type === "nap" ? "Nap" : "Night sleep"}${
          durationMin != null ? ` ${durationMin}min` : " (active)"
        }`,
      });
    }

    const diapers = await ctx.db
      .query("diaperEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of diapers) {
      rows.push({
        ...stamps(e.timestamp, e._creationTime, timeZone),
        category: "diaper",
        subcategory: e.type,
        stoolType: e.type,
        stoolColour: e.colour,
        stoolTexture: e.consistency,
        caregiverName: e.caregiverName,
        notes: e.notes,
        summary: [e.type, e.colour, e.consistency].filter(Boolean).join(", "),
      });
    }

    const healthEntries = await ctx.db
      .query("healthEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of healthEntries) {
      let amount: number | undefined;
      let unit: string | undefined;
      let summary: string = e.type;
      if (e.type === "temperature") {
        amount = e.temperature;
        unit = "celsius";
        summary = `${e.temperature ?? "?"}°C`;
      } else if (e.type === "medication") {
        summary = `${e.medicationName ?? "med"}${
          e.dosage ? ` ${e.dosage}` : ""
        }`;
      } else if (e.type === "weight") {
        amount = e.weight;
        unit = "kg";
        summary = `${e.weight} kg`;
      } else if (e.type === "vaccine") {
        summary = e.vaccineName ?? "vaccine";
      } else if (e.type === "spitup") {
        summary = "Spit-up";
      }
      rows.push({
        ...stamps(e.timestamp, e._creationTime, timeZone),
        category: "health",
        subcategory: e.type,
        amount,
        unit,
        caregiverName: e.caregiverName,
        notes: e.notes,
        summary,
      });
    }

    const momentEntries = await ctx.db
      .query("momentEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of momentEntries) {
      rows.push({
        ...stamps(e.timestamp, e._creationTime, timeZone),
        category: "moment",
        subcategory: e.preset ?? "moment",
        caregiverName: e.caregiverName,
        notes: e.notes,
        summary: e.text?.trim() || e.preset || "moment",
      });
    }

    const activityEntries = await ctx.db
      .query("activityEntries")
      .withIndex("by_tracker_and_time", (q) =>
        q.eq("trackerId", tracker._id).gte("timestamp", rangeStart)
      )
      .order("desc")
      .take(500);

    for (const e of activityEntries) {
      rows.push({
        ...stamps(e.timestamp, e._creationTime, timeZone),
        category: "activity",
        subcategory: e.kind,
        durationMinutes: e.durationMinutes,
        caregiverName: e.caregiverName,
        notes: e.notes,
        summary: `${e.kind}${
          e.durationMinutes ? ` ${e.durationMinutes}min` : ""
        }`,
      });
    }

    const growthEntries = await ctx.db
      .query("growthEntries")
      .withIndex("by_tracker", (q) => q.eq("trackerId", tracker._id))
      .filter((q) => q.gte(q.field("timestamp"), rangeStart))
      .order("desc")
      .take(500);

    for (const e of growthEntries) {
      const parts: string[] = [];
      if (e.weight != null) parts.push(`${e.weight} kg`);
      if (e.length != null) parts.push(`${e.length} cm`);
      if (e.headCircumference != null) {
        parts.push(`HC ${e.headCircumference} cm`);
      }
      if (e.weight != null) {
        rows.push({
          ...stamps(e.timestamp, e._creationTime, timeZone),
          category: "growth",
          subcategory: "weight",
          amount: e.weight,
          unit: "kg",
          measurementSource: e.measurementSource,
          caregiverName: e.caregiverName,
          notes: e.notes,
          summary: parts.join(", ") || e.date,
        });
      }
      if (e.length != null) {
        rows.push({
          ...stamps(e.timestamp, e._creationTime, timeZone),
          category: "growth",
          subcategory: "length",
          amount: e.length,
          unit: "cm",
          measurementSource: e.measurementSource,
          caregiverName: e.caregiverName,
          notes: e.notes,
          summary: parts.join(", ") || e.date,
        });
      }
      if (e.headCircumference != null) {
        rows.push({
          ...stamps(e.timestamp, e._creationTime, timeZone),
          category: "growth",
          subcategory: "head",
          amount: e.headCircumference,
          unit: "cm",
          measurementSource: e.measurementSource,
          caregiverName: e.caregiverName,
          notes: e.notes,
          summary: parts.join(", ") || e.date,
        });
      }
      if (e.weight == null && e.length == null && e.headCircumference == null) {
        rows.push({
          ...stamps(e.timestamp, e._creationTime, timeZone),
          category: "growth",
          subcategory: "growth",
          measurementSource: e.measurementSource,
          caregiverName: e.caregiverName,
          notes: e.notes,
          summary: e.date,
        });
      }
    }

    const stashBags = await ctx.db
      .query("milkStashBags")
      .withIndex("by_tracker_and_created", (q) =>
        q.eq("trackerId", tracker._id)
      )
      .order("desc")
      .take(500);

    let stashAvailableMl = 0;
    for (const e of stashBags) {
      if (e.status === "available") stashAvailableMl += e.amountMl;
      const inRange =
        e.createdAt >= rangeStart ||
        (e.usedAt !== undefined && e.usedAt >= rangeStart);
      if (!inRange) continue;

      const expressedDate = e.frozenOn ?? e.label;
      const occurredAt =
        e.status === "available"
          ? (e.pumpedAt ??
            (expressedDate ? msFromIsoDate(expressedDate) : e.createdAt))
          : (e.usedAt ?? e.createdAt);
      const loggedAt =
        e.status === "available" ? e.createdAt : (e.usedAt ?? e.createdAt);

      rows.push({
        ...stamps(occurredAt, loggedAt, timeZone),
        category: "stash",
        subcategory:
          e.status === "available"
            ? "bag_add"
            : e.status === "used"
              ? "bag_used"
              : "bag_discarded",
        amount: e.amountMl,
        unit: "ml",
        expressedDate,
        caregiverName:
          e.status === "available"
            ? e.caregiverName
            : (e.usedByCaregiverName ?? e.caregiverName),
        notes: e.notes,
        summary: `${e.status} bag ${e.amountMl}ml${
          expressedDate ? ` expressed ${expressedDate}` : ""
        }`,
      });
    }

    rows.sort((a, b) => b.sortAt - a.sortAt);

    return {
      rows: rows.map(({ sortAt: _s, ...row }) => row),
      babyName: tracker?.babyName,
      birthDate: tracker?.birthDate,
      sex: tracker?.sex,
      timezone: timeZone,
      stashAvailableMl,
      exportedAt: args.now,
      exportedAtUtc: new Date(args.now).toISOString(),
      rangeDays: args.days,
    };
  },
});
