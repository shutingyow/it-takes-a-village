/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as diaperEntries from "../diaperEntries.js";
import type * as feedEntries from "../feedEntries.js";
import type * as healthEntries from "../healthEntries.js";
import type * as history from "../history.js";
import type * as notes from "../notes.js";
import type * as pumpEntries from "../pumpEntries.js";
import type * as sleepEntries from "../sleepEntries.js";
import type * as supplyAlerts from "../supplyAlerts.js";
import type * as trackers from "../trackers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  diaperEntries: typeof diaperEntries;
  feedEntries: typeof feedEntries;
  healthEntries: typeof healthEntries;
  history: typeof history;
  notes: typeof notes;
  pumpEntries: typeof pumpEntries;
  sleepEntries: typeof sleepEntries;
  supplyAlerts: typeof supplyAlerts;
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
