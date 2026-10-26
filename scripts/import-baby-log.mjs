#!/usr/bin/env node
/**
 * Parse baby_log CSV and import into a Convex tracker (production).
 *
 * Usage:
 *   node scripts/import-baby-log.mjs --dry-run
 *   node scripts/import-baby-log.mjs --create-tracker   # create Russell tracker, print id/link
 *   node scripts/import-baby-log.mjs --trackerId <id>   # import into existing tracker
 *   node scripts/import-baby-log.mjs --fix-diaper-types --secretLink <link>
 *   node scripts/import-baby-log.mjs --fix-diaper-types --trackerId <id>
 *
 * Timezone: Asia/Singapore (UTC+8). Year: 2026.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CSV_PATH =
  process.env.BABY_LOG_CSV ??
  "/Users/shutingyow/Downloads/baby_log - baby_log_23aug_5sep.csv.csv";
const IMPORT_TAG = "import:baby_log_23aug_5sep";
const CAREGIVER = "Mommy (Shuting)";
const YEAR = 2026;
const TZ_OFFSET_HOURS = 8; // Asia/Singapore

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const createTracker = args.includes("--create-tracker");
const fixDiaperTypes = args.includes("--fix-diaper-types");
const trackerIdIdx = args.indexOf("--trackerId");
const trackerId = trackerIdIdx >= 0 ? args[trackerIdIdx + 1] : null;
const secretLinkIdx = args.indexOf("--secretLink");
const secretLink = secretLinkIdx >= 0 ? args[secretLinkIdx + 1] : null;
const prod = !args.includes("--dev");

function convexRun(fn, jsonArgs) {
  const cmdArgs = ["convex", "run", fn, JSON.stringify(jsonArgs)];
  if (prod) cmdArgs.push("--prod");
  const result = spawnSync("npx", cmdArgs, {
    cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`convex run ${fn} failed (exit ${result.status})`);
  }
  const out = (result.stdout || "").trim();
  // convex run prints JSON result
  try {
    return JSON.parse(out);
  } catch {
    // Sometimes prefixed with logs — find last JSON object/array
    const match = out.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
    if (!match) {
      console.error("Raw output:", out);
      throw new Error(`Could not parse convex run output for ${fn}`);
    }
    return JSON.parse(match[1]);
  }
}

function parseHourBucket(hourStr) {
  const m = hourStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const ap = m[3].toUpperCase();
  if (ap === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return h;
}

function parseMinuteOffset(timeStr) {
  const m = timeStr.trim().match(/^:(\d{1,2})$/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function parseDate(dateStr) {
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  return { day: parseInt(m[1], 10), month: parseInt(m[2], 10), year: YEAR };
}

/** Local wall time in Asia/Singapore → epoch ms. */
function toEpochMs(year, month, day, hour, minute) {
  return Date.UTC(year, month - 1, day, hour - TZ_OFFSET_HOURS, minute, 0, 0);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split(",");
    rows.push({
      line: i + 1,
      Date: parts[0] ?? "",
      Hour: parts[1] ?? "",
      Category: parts[2] ?? "",
      Time: parts[3] ?? "",
      Amount_mL: parts[4] ?? "",
      Flag: parts[5] ?? "",
    });
  }
  return rows;
}

function buildPayload(rows) {
  const feeds = [];
  const diaperEvents = [];
  const temps = [];
  const weird = [];

  for (const r of rows) {
    const cat = r.Category.trim();

    if (
      cat === "Formula Milk" ||
      cat === "Bottle Breastmilk" ||
      cat === "Direct Breastfeeding"
    ) {
      const date = parseDate(r.Date);
      const hour = parseHourBucket(r.Hour);
      const mins = parseMinuteOffset(r.Time);
      if (!date || hour === null || mins === null) {
        weird.push({ reason: "bad datetime feed", line: r.line, row: r });
        continue;
      }
      const timestamp = toEpochMs(
        date.year,
        date.month,
        date.day,
        hour,
        mins
      );

      if (cat === "Direct Breastfeeding") {
        feeds.push({
          type: "breast",
          timestamp,
          notes: IMPORT_TAG,
          caregiverName: CAREGIVER,
          _meta: { line: r.line, iso: new Date(timestamp).toISOString() },
        });
      } else {
        const amount = Number(r.Amount_mL);
        if (Number.isNaN(amount)) {
          weird.push({ reason: "bad amount", line: r.line, row: r });
          continue;
        }
        const milkNote = cat === "Formula Milk" ? "Formula" : "Breastmilk";
        const bottleMilk =
          cat === "Formula Milk" ? "formula" : "breastmilk";
        feeds.push({
          type: "bottle",
          amount,
          bottleMilk,
          timestamp,
          notes: `${milkNote} | ${IMPORT_TAG}`,
          caregiverName: CAREGIVER,
          _meta: {
            line: r.line,
            iso: new Date(timestamp).toISOString(),
            tiny: amount > 0 && amount < 5,
          },
        });
      }
    } else if (cat === "Diaper Change" || cat === "Poop") {
      const date = parseDate(r.Date);
      const hour = parseHourBucket(r.Hour);
      const mins = parseMinuteOffset(r.Time);
      if (!date || hour === null || mins === null) {
        weird.push({ reason: "bad datetime diaper", line: r.line, row: r });
        continue;
      }
      const timestamp = toEpochMs(
        date.year,
        date.month,
        date.day,
        hour,
        mins
      );
      diaperEvents.push({
        cat,
        timestamp,
        key: `${r.Date}|${r.Hour}|${r.Time}`,
        line: r.line,
      });
    } else if (cat === "Temperature") {
      const date = parseDate(r.Date);
      if (!date) {
        weird.push({ reason: "bad date temp", line: r.line, row: r });
        continue;
      }
      const temperature = Number(r.Amount_mL);
      if (Number.isNaN(temperature)) {
        weird.push({ reason: "bad temp", line: r.line, row: r });
        continue;
      }
      // Noon Asia/Singapore that day
      const timestamp = toEpochMs(date.year, date.month, date.day, 12, 0);
      temps.push({
        temperature,
        timestamp,
        notes: IMPORT_TAG,
        caregiverName: CAREGIVER,
        _meta: { line: r.line, iso: new Date(timestamp).toISOString() },
      });
    } else {
      weird.push({ reason: "unknown category", line: r.line, row: r });
    }
  }

  // Deduplicate exact duplicate diaper rows (same category + Date+Hour+Time)
  const seen = new Set();
  let diaperDupes = 0;
  const deduped = [];
  for (const e of diaperEvents) {
    const sig = `${e.cat}|${e.key}`;
    if (seen.has(sig)) {
      diaperDupes += 1;
      continue;
    }
    seen.add(sig);
    deduped.push(e);
  }

  // Merge Diaper Change + Poop at same key → both; diaper-only → wet; poop-only → dirty
  const byKey = new Map();
  for (const e of deduped) {
    if (!byKey.has(e.key)) {
      byKey.set(e.key, {
        timestamp: e.timestamp,
        cats: new Set(),
        lines: [],
      });
    }
    const g = byKey.get(e.key);
    g.cats.add(e.cat);
    g.lines.push(e.line);
  }

  const diapers = [];
  let mergedBoth = 0;
  let diaperOnly = 0;
  let poopOnly = 0;
  for (const [, g] of byKey) {
    const hasD = g.cats.has("Diaper Change");
    const hasP = g.cats.has("Poop");
    let type;
    let merge;
    if (hasD && hasP) {
      type = "both";
      merge = "both";
      mergedBoth += 1;
    } else if (hasD) {
      type = "wet";
      merge = "diaper-only";
      diaperOnly += 1;
    } else {
      type = "dirty";
      merge = "poop-only";
      poopOnly += 1;
    }
    diapers.push({
      type,
      timestamp: g.timestamp,
      notes: IMPORT_TAG,
      caregiverName: CAREGIVER,
      _meta: {
        lines: g.lines,
        merge,
        iso: new Date(g.timestamp).toISOString(),
      },
    });
  }

  return {
    feeds,
    diapers,
    temps,
    weird,
    stats: {
      rawRows: rows.length,
      feeds: feeds.length,
      bottle: feeds.filter((f) => f.type === "bottle").length,
      breast: feeds.filter((f) => f.type === "breast").length,
      diapers: diapers.length,
      mergedBoth,
      diaperOnly,
      poopOnly,
      diaperDupes,
      temps: temps.length,
      tinyBottles: feeds.filter((f) => f._meta?.tiny).length,
      weird: weird.length,
    },
  };
}

function stripMeta(entries) {
  return entries.map(({ _meta, ...rest }) => rest);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const text = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(text);
  const payload = buildPayload(rows);

  console.log("Dry-run / parse stats:");
  console.log(JSON.stringify(payload.stats, null, 2));
  if (payload.weird.length) {
    console.log("Weird rows:", payload.weird);
  }
  console.log(
    "Sample timestamps (SGT wall → UTC):",
    payload.feeds.slice(0, 2).map((f) => ({
      notes: f.notes,
      iso: f._meta.iso,
      ts: f.timestamp,
    })),
    payload.temps.slice(0, 1).map((t) => ({
      temp: t.temperature,
      iso: t._meta.iso,
    }))
  );

  if (fixDiaperTypes) {
    let tid = trackerId;
    if (!tid && secretLink) {
      const meta = convexRun("importBabyLog:countDiaperTypesBySecret", {
        secretLink,
      });
      if (!meta) {
        console.error(`No tracker found for secretLink ${secretLink}`);
        process.exit(1);
      }
      tid = meta.trackerId;
      console.log("\nBefore:", meta);
    }
    if (!tid) {
      console.error("Need --trackerId or --secretLink with --fix-diaper-types");
      process.exit(1);
    }
    if (dryRun) {
      console.log("\n--dry-run: would patch", payload.diapers.length, "diapers");
      return;
    }
    const corrections = payload.diapers.map((d) => ({
      timestamp: d.timestamp,
      type: d.type,
    }));
    // Chunk to stay under arg size limits
    const chunks = chunk(corrections, 80);
    let totals = {
      updated: 0,
      alreadyCorrect: 0,
      missing: 0,
      ambiguous: 0,
      byType: null,
      secretLink: null,
    };
    for (const c of chunks) {
      const r = convexRun("importBabyLog:fixDiaperTypes", {
        trackerId: tid,
        corrections: c,
      });
      totals.updated += r.updated;
      totals.alreadyCorrect += r.alreadyCorrect;
      totals.missing += r.missing;
      totals.ambiguous += r.ambiguous;
      totals.byType = r.byType;
      totals.secretLink = r.secretLink;
      if (r.missingTimestamps?.length) {
        console.log("  missing sample:", r.missingTimestamps);
      }
      console.log("  batch", r);
    }
    console.log("\nFix totals:", totals);
    const after = convexRun("importBabyLog:countDiaperTypesBySecret", {
      secretLink: totals.secretLink,
    });
    console.log("After counts:", after);
    return;
  }

  if (dryRun && !createTracker && !trackerId) {
    console.log("\n--dry-run only; no Convex writes.");
    return;
  }

  let tid = trackerId;

  if (createTracker) {
    console.log("\nCreating tracker: Russell / Mommy (Shuting) admin...");
    const created = convexRun("trackers:create", {
      babyName: "Russell",
      caregivers: [{ name: CAREGIVER, role: "admin" }],
    });
    tid = created.trackerId;
    console.log("Created:", created);
    console.log(
      `URL: https://it-takes-a-village.vercel.app/tracker/${created.secretLink}`
    );
  }

  if (!tid) {
    console.error("Need --trackerId <id> or --create-tracker to import.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("\nTracker ready; skipping import because --dry-run.");
    return;
  }

  const feeds = stripMeta(payload.feeds);
  const diapers = stripMeta(payload.diapers);
  const temps = stripMeta(payload.temps);

  // Import in chunks to stay under mutation limits
  const feedChunks = chunk(feeds, 80);
  const diaperChunks = chunk(diapers, 80);
  const tempChunks = chunk(temps, 80);

  const totals = {
    feedsInserted: 0,
    feedsSkipped: 0,
    diapersInserted: 0,
    diapersSkipped: 0,
    tempsInserted: 0,
    tempsSkipped: 0,
  };

  console.log("\nImporting feeds...");
  for (const c of feedChunks) {
    const r = convexRun("importBabyLog:importBatch", {
      trackerId: tid,
      feeds: c,
    });
    totals.feedsInserted += r.feedsInserted;
    totals.feedsSkipped += r.feedsSkipped;
    console.log("  batch", r);
  }

  console.log("Importing diapers...");
  for (const c of diaperChunks) {
    const r = convexRun("importBabyLog:importBatch", {
      trackerId: tid,
      diapers: c,
    });
    totals.diapersInserted += r.diapersInserted;
    totals.diapersSkipped += r.diapersSkipped;
    console.log("  batch", r);
  }

  console.log("Importing temps...");
  for (const c of tempChunks) {
    const r = convexRun("importBabyLog:importBatch", {
      trackerId: tid,
      temps: c,
    });
    totals.tempsInserted += r.tempsInserted;
    totals.tempsSkipped += r.tempsSkipped;
    console.log("  batch", r);
  }

  console.log("\nImport totals:", totals);

  const verified = convexRun("importBabyLog:verifyImport", {
    trackerId: tid,
  });
  console.log("Verify:", verified);
  console.log(
    `URL: https://it-takes-a-village.vercel.app/tracker/${verified.secretLink}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
