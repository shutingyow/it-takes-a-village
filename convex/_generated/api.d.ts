/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityEntries from "../activityEntries.js";
import type * as appointments from "../appointments.js";
import type * as auth from "../auth.js";
import type * as dailySummary from "../dailySummary.js";
import type * as diaperEntries from "../diaperEntries.js";
import type * as diaryEntries from "../diaryEntries.js";
import type * as export_ from "../export.js";
import type * as feedEntries from "../feedEntries.js";
import type * as growthEntries from "../growthEntries.js";
import type * as healthEntries from "../healthEntries.js";
import type * as history from "../history.js";
import type * as homeDashboard from "../homeDashboard.js";
import type * as http from "../http.js";
import type * as importBabyLog from "../importBabyLog.js";
import type * as lib_caregivers from "../lib/caregivers.js";
import type * as lib_dayBounds from "../lib/dayBounds.js";
import type * as lib_feedSchedule from "../lib/feedSchedule.js";
import type * as lib_pumpSchedule from "../lib/pumpSchedule.js";
import type * as milestones from "../milestones.js";
import type * as momentEntries from "../momentEntries.js";
import type * as notes from "../notes.js";
import type * as pumpEntries from "../pumpEntries.js";
import type * as reminders from "../reminders.js";
import type * as sleepEntries from "../sleepEntries.js";
import type * as stats from "../stats.js";
import type * as supplyAlerts from "../supplyAlerts.js";
import type * as timetable from "../timetable.js";
import type * as trackers from "../trackers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityEntries: typeof activityEntries;
  appointments: typeof appointments;
  auth: typeof auth;
  dailySummary: typeof dailySummary;
  diaperEntries: typeof diaperEntries;
  diaryEntries: typeof diaryEntries;
  export: typeof export_;
  feedEntries: typeof feedEntries;
  growthEntries: typeof growthEntries;
  healthEntries: typeof healthEntries;
  history: typeof history;
  homeDashboard: typeof homeDashboard;
  http: typeof http;
  importBabyLog: typeof importBabyLog;
  "lib/caregivers": typeof lib_caregivers;
  "lib/dayBounds": typeof lib_dayBounds;
  "lib/feedSchedule": typeof lib_feedSchedule;
  "lib/pumpSchedule": typeof lib_pumpSchedule;
  milestones: typeof milestones;
  momentEntries: typeof momentEntries;
  notes: typeof notes;
  pumpEntries: typeof pumpEntries;
  reminders: typeof reminders;
  sleepEntries: typeof sleepEntries;
  stats: typeof stats;
  supplyAlerts: typeof supplyAlerts;
  timetable: typeof timetable;
  trackers: typeof trackers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
