/**
 * Établissements — Joliba
 *
 * Un établissement appartient à une organisation, et son `organizationId` ne change
 * jamais : aucune mutation ne l'accepte en argument de modification.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./lib/audit";
import { isSupportedCountry } from "./lib/countries";
import { invalid } from "./lib/errors";
import { accessibleVenues, requireOrganizationMember, requirePermission } from "./lib/guards";
import { createVenueRecords } from "./organizations";
import { venueType } from "./lib/validators";

/** Plafond technique en attendant les limites par plan (T8). */
const MAX_VENUES_PER_ORGANIZATION = 50;

function cleanVenueName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    throw invalid("Le nom de l'établissement doit contenir entre 2 et 80 caractères.");
  }
  return name;
}

/** Les établissements que l'appelant peut voir dans cette organisation. */
export const listForOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const actor = await requireOrganizationMember(ctx, args.organizationId);
    const venues = await accessibleVenues(ctx, actor);
    return venues.map((venue) => ({
      _id: venue._id,
      name: venue.name,
      slug: venue.slug,
      venueType: venue.venueType,
      status: venue.status,
      city: venue.address?.city ?? null,
      currency: venue.currency,
    }));
  },
});

export const get = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.read", { venueId: args.venueId });
    const { venue } = actor;
    return {
      _id: venue._id,
      organizationId: venue.organizationId,
      name: venue.name,
      slug: venue.slug,
      venueType: venue.venueType,
      status: venue.status,
      countryCode: venue.countryCode,
      currency: venue.currency,
      timezone: venue.timezone,
      address: venue.address ?? null,
      phone: venue.phone ?? null,
      publicEmail: venue.publicEmail ?? null,
      description: venue.description ?? null,
    };
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    venueType,
    city: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.create", {
      organizationId: args.organizationId,
    });
    const countryCode = args.countryCode ?? actor.organization.countryCode;
    if (!isSupportedCountry(countryCode)) throw invalid("Ce pays n'est pas encore pris en charge.");
    const existing = await ctx.db
      .query("venues")
      .withIndex("by_org", (q) => q.eq("organizationId", actor.organization._id))
      .collect();
    if (existing.length >= MAX_VENUES_PER_ORGANIZATION) {
      throw invalid("Nombre maximal d'établissements atteint pour cette organisation.");
    }
    const name = cleanVenueName(args.name);
    const venueId = await createVenueRecords(ctx, {
      organizationId: actor.organization._id,
      name,
      venueType: args.venueType,
      countryCode,
      ...(args.city !== undefined ? { city: args.city } : {}),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId,
      actorUserId: actor.user._id,
      action: "venue.create",
      resourceType: "venue",
      resourceId: venueId,
      after: { name, venueType: args.venueType, countryCode },
    });
    return venueId;
  },
});

const optionalText = (max: number, what: string, value: string | undefined) => {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (text.length > max) throw invalid(`${what} ne doit pas dépasser ${max} caractères.`);
  return text;
};

export const update = mutation({
  args: {
    venueId: v.id("venues"),
    name: v.optional(v.string()),
    venueType: v.optional(venueType),
    phone: v.optional(v.string()),
    publicEmail: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(
      v.object({
        line1: v.optional(v.string()),
        line2: v.optional(v.string()),
        city: v.string(),
        district: v.optional(v.string()),
        landmark: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.manage", { venueId: args.venueId });
    const { venue } = actor;
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = cleanVenueName(args.name);
    if (args.venueType !== undefined) patch.venueType = args.venueType;
    const phone = optionalText(30, "Le téléphone", args.phone);
    if (phone !== undefined) patch.phone = phone;
    const email = optionalText(120, "L'adresse e-mail", args.publicEmail);
    if (email !== undefined) {
      if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw invalid("L'adresse e-mail publique n'est pas valide.");
      }
      patch.publicEmail = email;
    }
    const description = optionalText(500, "La description", args.description);
    if (description !== undefined) patch.description = description;
    if (args.address !== undefined) {
      const city = args.address.city.trim();
      if (city.length < 2 || city.length > 80) throw invalid("La ville doit contenir entre 2 et 80 caractères.");
      const address: Record<string, string> = { city, countryCode: venue.countryCode };
      for (const key of ["line1", "line2", "district", "landmark"] as const) {
        const value = optionalText(160, "Chaque ligne d'adresse", args.address[key]);
        if (value) address[key] = value;
      }
      // La venue garde son pays : un changement de pays changerait devise et fuseau.
      patch.address = address;
    }
    if (Object.keys(patch).length === 0) return;
    const before: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) before[key] = (venue as Record<string, unknown>)[key];
    await ctx.db.patch(venue._id, patch);
    await writeAudit(ctx, {
      organizationId: venue.organizationId,
      venueId: venue._id,
      actorUserId: actor.user._id,
      action: "venue.update",
      resourceType: "venue",
      resourceId: venue._id,
      before,
      after: patch,
    });
  },
});
