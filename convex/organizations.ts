/**
 * Organisations — Joliba
 *
 * L'organisation est le tenant : elle possède les établissements, les rôles et l'équipe.
 * Sa création est ATOMIQUE avec celle de son premier établissement — un propriétaire
 * n'est jamais laissé devant une organisation vide, et aucun état intermédiaire n'est
 * observable si l'une des écritures échoue.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { COUNTRIES, isSupportedCountry } from "./lib/countries";
import { invalid } from "./lib/errors";
import {
  accessibleVenues,
  requireOrganizationMember,
  requirePermission,
  requireUser,
  resolvePermissions,
  requireVenueAccess,
  type MutationCtx,
} from "./lib/guards";
import { ROLE_TEMPLATES } from "./lib/permissions";
import { uniqueSlug } from "./lib/slug";
import { defaultVenueSettings } from "./lib/venueDefaults";
import { venueType, type VenueType } from "./lib/validators";

/** Garde-fou contre la création en rafale : aucun restaurateur n'en possède autant. */
const MAX_OWNED_ORGANIZATIONS = 10;

function cleanName(value: string, what: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    throw invalid(`${what} doit contenir entre 2 et 80 caractères.`);
  }
  return name;
}

/** Mes organisations, pour le sélecteur. Portée : l'utilisateur lui-même. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const result = [];
    for (const m of memberships) {
      if (m.status !== "active") continue;
      const org = await ctx.db.get(m.organizationId);
      if (!org || org.status !== "active") continue;
      result.push({ _id: org._id, name: org.name, slug: org.slug, isOwner: org.ownerUserId === user._id });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },
});

/** L'organisation, et ce que l'appelant peut y faire au niveau de l'organisation. */
export const get = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const actor = await requireOrganizationMember(ctx, args.organizationId);
    const permissions = await resolvePermissions(ctx, actor, null);
    const venues = await accessibleVenues(ctx, actor);
    return {
      _id: actor.organization._id,
      name: actor.organization.name,
      slug: actor.organization.slug,
      countryCode: actor.organization.countryCode,
      defaultCurrency: actor.organization.defaultCurrency,
      isOwner: actor.isOwner,
      permissions: [...permissions],
      venues: venues.map((v) => ({ _id: v._id, name: v.name, slug: v.slug, status: v.status })),
    };
  },
});

/**
 * Ce que l'appelant peut faire DANS un établissement. Le frontend s'en sert pour
 * masquer les actions ; la barrière reste dans chaque mutation.
 */
export const venueAccess = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireVenueAccess(ctx, args.venueId);
    const permissions = await resolvePermissions(ctx, actor, actor.venue);
    return { venueId: actor.venue._id, permissions: [...permissions] };
  },
});

export async function createVenueRecords(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    name: string;
    venueType: VenueType;
    countryCode: keyof typeof COUNTRIES;
    city?: string;
  },
): Promise<Id<"venues">> {
  const country = COUNTRIES[args.countryCode];
  const slug = await uniqueSlug(args.name, async (candidate) =>
    Boolean(
      await ctx.db
        .query("venues")
        .withIndex("by_slug", (q) => q.eq("slug", candidate))
        .first(),
    ),
  );
  const city = args.city?.trim();
  if (city && city.length > 80) throw invalid("Le nom de la ville ne doit pas dépasser 80 caractères.");
  const venueId = await ctx.db.insert("venues", {
    organizationId: args.organizationId,
    name: args.name,
    slug,
    countryCode: args.countryCode,
    currency: country.currency,
    timezone: country.timezone,
    locales: ["fr"],
    venueType: args.venueType,
    status: "setup",
    publicMenuEnabled: false,
    onboardingCompletedSteps: [],
    ...(city ? { address: { city, countryCode: args.countryCode } } : {}),
    isSimulation: false,
  });
  await ctx.db.insert("venueSettings", defaultVenueSettings(venueId));
  return venueId;
}

/**
 * Ouvre une organisation avec son premier établissement. L'appelant en devient le
 * propriétaire, les modèles de rôles y sont COPIÉS (l'organisation les modifiera
 * librement), et il reçoit le rôle « Propriétaire » au niveau de l'organisation.
 */
export const create = mutation({
  args: {
    name: v.string(),
    countryCode: v.string(),
    venue: v.object({ name: v.string(), venueType, city: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = cleanName(args.name, "Le nom de l'organisation");
    const venueName = cleanName(args.venue.name, "Le nom de l'établissement");
    if (!isSupportedCountry(args.countryCode)) throw invalid("Ce pays n'est pas encore pris en charge.");
    const owned = await ctx.db
      .query("organizations")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", user._id))
      .collect();
    if (owned.length >= MAX_OWNED_ORGANIZATIONS) {
      throw invalid("Vous avez atteint le nombre maximal d'organisations. Contactez le support.");
    }

    const country = COUNTRIES[args.countryCode];
    const slug = await uniqueSlug(name, async (candidate) =>
      Boolean(
        await ctx.db
          .query("organizations")
          .withIndex("by_slug", (q) => q.eq("slug", candidate))
          .first(),
      ),
    );
    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      ownerUserId: user._id,
      countryCode: args.countryCode,
      defaultCurrency: country.currency,
      defaultLocale: "fr",
      status: "active",
    });

    const now = Date.now();
    const memberId = await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: user._id,
      status: "active",
      joinedAt: now,
    });

    let ownerRoleId: Id<"roles"> | null = null;
    for (const [key, template] of Object.entries(ROLE_TEMPLATES)) {
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        key,
        label: template.label,
        permissions: [...template.permissions],
        isCustom: false,
      });
      if (key === "owner") ownerRoleId = roleId;
    }
    if (ownerRoleId) {
      await ctx.db.insert("memberRoleAssignments", {
        organizationId,
        memberId,
        roleId: ownerRoleId,
        scopeType: "organization",
        grantedByUserId: user._id,
        grantedAt: now,
      });
    }

    const venueId = await createVenueRecords(ctx, {
      organizationId,
      name: venueName,
      venueType: args.venue.venueType,
      countryCode: args.countryCode,
      ...(args.venue.city !== undefined ? { city: args.venue.city } : {}),
    });

    await writeAudit(ctx, {
      organizationId,
      actorUserId: user._id,
      action: "organization.create",
      resourceType: "organization",
      resourceId: organizationId,
      after: { name, countryCode: args.countryCode, firstVenueId: venueId },
    });
    return { organizationId, venueId };
  },
});

export const update = mutation({
  args: { organizationId: v.id("organizations"), name: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "organization.manage", {
      organizationId: args.organizationId,
    });
    const name = cleanName(args.name, "Le nom de l'organisation");
    if (name === actor.organization.name) return;
    await ctx.db.patch(actor.organization._id, { name });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      actorUserId: actor.user._id,
      action: "organization.update",
      resourceType: "organization",
      resourceId: actor.organization._id,
      before: { name: actor.organization.name },
      after: { name },
    });
  },
});
