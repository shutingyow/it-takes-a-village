#!/usr/bin/env node
/**
 * Import fixed pump schedule into Russell's tracker (production).
 *
 * Every day 23 Aug 2026 – 5 Sep 2026, Asia/Singapore:
 *   00:00, 04:00, 08:00, 12:00, 16:00, 20:00 — 90 ml, side both
 *
 * Usage:
 *   node scripts/import-pump-schedule.mjs --dry-run
 *   node scripts/import-pump-schedule.mjs
 *   node scripts/import-pump-schedule.mjs --dev
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const IMPORT_TAG = "import:pump_schedule_23aug_5sep";
const CAREGIVER = "Mommy (Shuting)";
const AMOUNT_ML = 90;
const TZ_OFFSET_HOURS = 8; // Asia/Singapore
const HOURS = [0, 4, 8, 12, 16, 20];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const prod = !args.includes("--dev");
const secretLinkIdx = args.indexOf("--secretLink");
const SECRET_LINK =
  secretLinkIdx >= 0 ? args[secretLinkIdx + 1] : "g5eW8YStz7GApEmz";
const trackerIdArgIdx = args.indexOf("--trackerId");
const TRACKER_ID_ARG =
  trackerIdArgIdx >= 0 ? args[trackerIdArgIdx + 1] : null;

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
  try {
    return JSON.parse(out);
  } catch {
    const match = out.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
    if (!match) {
      console.error("Raw output:", out);
      throw new Error(`Could not parse convex run output for ${fn}`);
    }
    return JSON.parse(match[1]);
  }
}

/** Local wall time in Asia/Singapore → epoch ms. */
function toEpochMs(year, month, day, hour, minute) {
  return Date.UTC(year, month - 1, day, hour - TZ_OFFSET_HOURS, minute, 0, 0);
}

function* eachDay(startY, startM, startD, endY, endM, endD) {
  let d = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));
  while (d <= end) {
    yield {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  }
}

function buildPumps() {
  const pumps = [];
  for (const { year, month, day } of eachDay(2026, 8, 23, 2026, 9, 5)) {
    for (const hour of HOURS) {
      pumps.push({
        amount: AMOUNT_ML,
        side: "both",
        timestamp: toEpochMs(year, month, day, hour, 0),
        notes: IMPORT_TAG,
        caregiverName: CAREGIVER,
      });
    }
  }
  return pumps;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatSgt(ms) {
  return new Date(ms).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function main() {
  const pumps = buildPumps();
  console.log(`Generated ${pumps.length} pump entries`);
  console.log(`Date range: ${formatSgt(pumps[0].timestamp)} → ${formatSgt(pumps[pumps.length - 1].timestamp)}`);
  console.log("Sample timestamps (first day):");
  for (const p of pumps.slice(0, 6)) {
    console.log(`  ${p.timestamp}  ${formatSgt(p.timestamp)}  ${p.amount}ml`);
  }

  if (dryRun) {
    console.log("\nDry run — not writing to Convex.");
    return;
  }

  let trackerId = TRACKER_ID_ARG;
  let trackerLabel = trackerId;
  if (!trackerId) {
    const tracker = convexRun("trackers:getBySecret", {
      secretLink: SECRET_LINK,
    });
    if (!tracker) {
      throw new Error(`No tracker for secretLink ${SECRET_LINK}`);
    }
    trackerId = tracker._id;
    trackerLabel = `${tracker.babyName ?? "(unnamed)"} (${trackerId})`;
  }
  console.log(`\nTracker: ${trackerLabel}`);

  const totals = { pumpsInserted: 0, pumpsSkipped: 0 };
  for (const batch of chunk(pumps, 84)) {
    const r = convexRun("importBabyLog:importBatch", {
      trackerId,
      pumps: batch,
    });
    totals.pumpsInserted += r.pumpsInserted;
    totals.pumpsSkipped += r.pumpsSkipped;
    console.log("  batch", r);
  }

  console.log("\nImport totals:", totals);

  const verified = convexRun("importBabyLog:verifyImport", {
    trackerId,
    pumpImportTag: IMPORT_TAG,
  });
  console.log("Verify:", verified);
  if (verified.samplePumpTimestamps?.length) {
    console.log("Sample verified timestamps (SGT):");
    for (const ts of verified.samplePumpTimestamps) {
      console.log(`  ${ts}  ${formatSgt(ts)}`);
    }
  }
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
