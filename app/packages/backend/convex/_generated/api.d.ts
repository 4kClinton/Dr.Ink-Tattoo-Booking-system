/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as availability from "../availability.js";
import type * as bookings from "../bookings.js";
import type * as clients from "../clients.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as digest from "../digest.js";
import type * as expenses from "../expenses.js";
import type * as exports from "../exports.js";
import type * as http from "../http.js";
import type * as leads from "../leads.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bookingLogic from "../lib/bookingLogic.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_messaging from "../lib/messaging.js";
import type * as lib_passwordHash from "../lib/passwordHash.js";
import type * as lib_payments from "../lib/payments.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_seed from "../lib/seed.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as messages from "../messages.js";
import type * as payments from "../payments.js";
import type * as promos from "../promos.js";
import type * as public_ from "../public.js";
import type * as reports from "../reports.js";
import type * as settings from "../settings.js";
import type * as sms from "../sms.js";
import type * as smsAdmin from "../smsAdmin.js";
import type * as staff from "../staff.js";
import type * as tasks from "../tasks.js";
import type * as tattoos from "../tattoos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  availability: typeof availability;
  bookings: typeof bookings;
  clients: typeof clients;
  crons: typeof crons;
  dashboard: typeof dashboard;
  digest: typeof digest;
  expenses: typeof expenses;
  exports: typeof exports;
  http: typeof http;
  leads: typeof leads;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/bookingLogic": typeof lib_bookingLogic;
  "lib/errors": typeof lib_errors;
  "lib/messaging": typeof lib_messaging;
  "lib/passwordHash": typeof lib_passwordHash;
  "lib/payments": typeof lib_payments;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/seed": typeof lib_seed;
  "lib/settings": typeof lib_settings;
  "lib/tokens": typeof lib_tokens;
  messages: typeof messages;
  payments: typeof payments;
  promos: typeof promos;
  public: typeof public_;
  reports: typeof reports;
  settings: typeof settings;
  sms: typeof sms;
  smsAdmin: typeof smsAdmin;
  staff: typeof staff;
  tasks: typeof tasks;
  tattoos: typeof tattoos;
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
