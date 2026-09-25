/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as availability from "../availability.js";
import type * as bills from "../bills.js";
import type * as branding from "../branding.js";
import type * as carts from "../carts.js";
import type * as cash from "../cash.js";
import type * as checks from "../checks.js";
import type * as crons from "../crons.js";
import type * as devSeed from "../devSeed.js";
import type * as devices from "../devices.js";
import type * as feedback from "../feedback.js";
import type * as floor from "../floor.js";
import type * as guest from "../guest.js";
import type * as guestService from "../guestService.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as kitchen from "../kitchen.js";
import type * as lib_allergens from "../lib/allergens.js";
import type * as lib_analytics from "../lib/analytics.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authority from "../lib/authority.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_availabilityIndex from "../lib/availabilityIndex.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_brand from "../lib/brand.js";
import type * as lib_cashCount from "../lib/cashCount.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_catalogAccess from "../lib/catalogAccess.js";
import type * as lib_countries from "../lib/countries.js";
import type * as lib_dayMetrics from "../lib/dayMetrics.js";
import type * as lib_devices from "../lib/devices.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_guestMenu from "../lib/guestMenu.js";
import type * as lib_guestPass from "../lib/guestPass.js";
import type * as lib_guestPayment from "../lib/guestPayment.js";
import type * as lib_guestTable from "../lib/guestTable.js";
import type * as lib_indexability from "../lib/indexability.js";
import type * as lib_intents from "../lib/intents.js";
import type * as lib_log from "../lib/log.js";
import type * as lib_menuImport from "../lib/menuImport.js";
import type * as lib_menuSnapshot from "../lib/menuSnapshot.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_operatorJwt from "../lib/operatorJwt.js";
import type * as lib_ordering from "../lib/ordering.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_pin from "../lib/pin.js";
import type * as lib_providers_registry from "../lib/providers/registry.js";
import type * as lib_providers_types from "../lib/providers/types.js";
import type * as lib_providers_wave from "../lib/providers/wave.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_scope from "../lib/scope.js";
import type * as lib_secretBox from "../lib/secretBox.js";
import type * as lib_service from "../lib/service.js";
import type * as lib_serviceActor from "../lib/serviceActor.js";
import type * as lib_serviceDay from "../lib/serviceDay.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_uploads from "../lib/uploads.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_venueDefaults from "../lib/venueDefaults.js";
import type * as lib_waveSignature from "../lib/waveSignature.js";
import type * as menuImport from "../menuImport.js";
import type * as menus from "../menus.js";
import type * as migrations from "../migrations.js";
import type * as modifiers from "../modifiers.js";
import type * as onlinePayments from "../onlinePayments.js";
import type * as operators from "../operators.js";
import type * as orders from "../orders.js";
import type * as organizations from "../organizations.js";
import type * as paymentAccounts from "../paymentAccounts.js";
import type * as payments from "../payments.js";
import type * as products from "../products.js";
import type * as publications from "../publications.js";
import type * as qr from "../qr.js";
import type * as reports from "../reports.js";
import type * as roles from "../roles.js";
import type * as serviceRequests from "../serviceRequests.js";
import type * as sessions from "../sessions.js";
import type * as staff from "../staff.js";
import type * as stations from "../stations.js";
import type * as team from "../team.js";
import type * as tower from "../tower.js";
import type * as users from "../users.js";
import type * as venues from "../venues.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  availability: typeof availability;
  bills: typeof bills;
  branding: typeof branding;
  carts: typeof carts;
  cash: typeof cash;
  checks: typeof checks;
  crons: typeof crons;
  devSeed: typeof devSeed;
  devices: typeof devices;
  feedback: typeof feedback;
  floor: typeof floor;
  guest: typeof guest;
  guestService: typeof guestService;
  health: typeof health;
  http: typeof http;
  kitchen: typeof kitchen;
  "lib/allergens": typeof lib_allergens;
  "lib/analytics": typeof lib_analytics;
  "lib/audit": typeof lib_audit;
  "lib/authority": typeof lib_authority;
  "lib/availability": typeof lib_availability;
  "lib/availabilityIndex": typeof lib_availabilityIndex;
  "lib/billing": typeof lib_billing;
  "lib/brand": typeof lib_brand;
  "lib/cashCount": typeof lib_cashCount;
  "lib/catalog": typeof lib_catalog;
  "lib/catalogAccess": typeof lib_catalogAccess;
  "lib/countries": typeof lib_countries;
  "lib/dayMetrics": typeof lib_dayMetrics;
  "lib/devices": typeof lib_devices;
  "lib/email": typeof lib_email;
  "lib/entitlements": typeof lib_entitlements;
  "lib/errors": typeof lib_errors;
  "lib/guards": typeof lib_guards;
  "lib/guestMenu": typeof lib_guestMenu;
  "lib/guestPass": typeof lib_guestPass;
  "lib/guestPayment": typeof lib_guestPayment;
  "lib/guestTable": typeof lib_guestTable;
  "lib/indexability": typeof lib_indexability;
  "lib/intents": typeof lib_intents;
  "lib/log": typeof lib_log;
  "lib/menuImport": typeof lib_menuImport;
  "lib/menuSnapshot": typeof lib_menuSnapshot;
  "lib/money": typeof lib_money;
  "lib/operatorJwt": typeof lib_operatorJwt;
  "lib/ordering": typeof lib_ordering;
  "lib/permissions": typeof lib_permissions;
  "lib/pin": typeof lib_pin;
  "lib/providers/registry": typeof lib_providers_registry;
  "lib/providers/types": typeof lib_providers_types;
  "lib/providers/wave": typeof lib_providers_wave;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/scope": typeof lib_scope;
  "lib/secretBox": typeof lib_secretBox;
  "lib/service": typeof lib_service;
  "lib/serviceActor": typeof lib_serviceActor;
  "lib/serviceDay": typeof lib_serviceDay;
  "lib/slug": typeof lib_slug;
  "lib/tokens": typeof lib_tokens;
  "lib/uploads": typeof lib_uploads;
  "lib/validators": typeof lib_validators;
  "lib/venueDefaults": typeof lib_venueDefaults;
  "lib/waveSignature": typeof lib_waveSignature;
  menuImport: typeof menuImport;
  menus: typeof menus;
  migrations: typeof migrations;
  modifiers: typeof modifiers;
  onlinePayments: typeof onlinePayments;
  operators: typeof operators;
  orders: typeof orders;
  organizations: typeof organizations;
  paymentAccounts: typeof paymentAccounts;
  payments: typeof payments;
  products: typeof products;
  publications: typeof publications;
  qr: typeof qr;
  reports: typeof reports;
  roles: typeof roles;
  serviceRequests: typeof serviceRequests;
  sessions: typeof sessions;
  staff: typeof staff;
  stations: typeof stations;
  team: typeof team;
  tower: typeof tower;
  users: typeof users;
  venues: typeof venues;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
