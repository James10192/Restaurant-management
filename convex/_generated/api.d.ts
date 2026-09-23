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
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_allergens from "../lib/allergens.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authority from "../lib/authority.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_catalogAccess from "../lib/catalogAccess.js";
import type * as lib_countries from "../lib/countries.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_log from "../lib/log.js";
import type * as lib_menuSnapshot from "../lib/menuSnapshot.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_scope from "../lib/scope.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_venueDefaults from "../lib/venueDefaults.js";
import type * as menus from "../menus.js";
import type * as modifiers from "../modifiers.js";
import type * as organizations from "../organizations.js";
import type * as products from "../products.js";
import type * as publications from "../publications.js";
import type * as roles from "../roles.js";
import type * as team from "../team.js";
import type * as users from "../users.js";
import type * as venues from "../venues.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  availability: typeof availability;
  health: typeof health;
  http: typeof http;
  "lib/allergens": typeof lib_allergens;
  "lib/audit": typeof lib_audit;
  "lib/authority": typeof lib_authority;
  "lib/availability": typeof lib_availability;
  "lib/catalog": typeof lib_catalog;
  "lib/catalogAccess": typeof lib_catalogAccess;
  "lib/countries": typeof lib_countries;
  "lib/email": typeof lib_email;
  "lib/entitlements": typeof lib_entitlements;
  "lib/errors": typeof lib_errors;
  "lib/guards": typeof lib_guards;
  "lib/log": typeof lib_log;
  "lib/menuSnapshot": typeof lib_menuSnapshot;
  "lib/money": typeof lib_money;
  "lib/permissions": typeof lib_permissions;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/scope": typeof lib_scope;
  "lib/slug": typeof lib_slug;
  "lib/tokens": typeof lib_tokens;
  "lib/validators": typeof lib_validators;
  "lib/venueDefaults": typeof lib_venueDefaults;
  menus: typeof menus;
  modifiers: typeof modifiers;
  organizations: typeof organizations;
  products: typeof products;
  publications: typeof publications;
  roles: typeof roles;
  team: typeof team;
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
