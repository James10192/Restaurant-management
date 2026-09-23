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
import { publishedFacts } from "./lib/guestMenu";

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
    const settings = await ctx.db
      .query("venueSettings")
      .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
      .unique();
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
      openingHours: venue.openingHours ?? [],
      publicMenuEnabled: venue.publicMenuEnabled,
      orderingMode: settings?.service.orderingMode ?? "staff_only",
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
    /** Horaires, en minutes locales. Une plage qui passe minuit a une fermeture < ouverture. */
    openingHours: v.optional(
      v.array(v.object({ dayOfWeek: v.number(), opensAtMinute: v.number(), closesAtMinute: v.number() })),
    ),
    /** Consentement explicite à publier la carte sur le web. Jamais activé par défaut. */
    publicMenuEnabled: v.optional(v.boolean()),
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
    if (args.openingHours !== undefined) {
      if (args.openingHours.length > 21) throw invalid("Pas plus de trois plages d'ouverture par jour.");
      for (const h of args.openingHours) {
        const ok =
          Number.isInteger(h.dayOfWeek) &&
          h.dayOfWeek >= 0 &&
          h.dayOfWeek <= 6 &&
          [h.opensAtMinute, h.closesAtMinute].every((m) => Number.isInteger(m) && m >= 0 && m <= 1440) &&
          h.opensAtMinute !== h.closesAtMinute;
        if (!ok) throw invalid("Horaires d'ouverture invalides.");
      }
      patch.openingHours = [...args.openingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.opensAtMinute - b.opensAtMinute);
    }
    if (args.publicMenuEnabled !== undefined && args.publicMenuEnabled !== venue.publicMenuEnabled) {
      patch.publicMenuEnabled = args.publicMenuEnabled;
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

/**
 * Où en est la carte publique ? Les FAITS dont dépend la porte de qualité
 * (`lib/indexability.ts`), que l'écran évalue avec l'heure courante et présente comme une
 * liste de choses à faire.
 */
export const publicMenuReadiness = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.read", { venueId: args.venueId });
    const { venue } = actor;
    return {
      slug: venue.slug,
      facts: await publishedFacts(ctx, venue),
      canManage: actor.permissions.has("venue.manage"),
    };
  },
});

/**
 * Qui saisit la commande (D-061). `staff_only` par défaut, avec le panier à montrer ;
 * `guest_with_approval` en réglage, avec ses garde-fous. `guest_direct` et `hybrid` sont
 * REFUSÉS ici, côté serveur, jusqu'à la tranche T4 : avec un QR sans friction, une photo du code
 * suffirait à envoyer des plats en cuisine depuis la rue.
 */
export const setOrderingMode = mutation({
  args: { venueId: v.id("venues"), orderingMode: v.union(v.literal("staff_only"), v.literal("guest_with_approval"), v.literal("guest_direct"), v.literal("hybrid")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "venue.settings.service", { venueId: args.venueId });
    if (args.orderingMode === "guest_direct" || args.orderingMode === "hybrid") {
      throw invalid("La commande directe par le client n'est pas encore disponible : le serveur garde la main.");
    }
    const settings = await ctx.db
      .query("venueSettings")
      .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
      .unique();
    if (!settings) throw invalid("Réglages introuvables.");
    if (settings.service.orderingMode === args.orderingMode) return;
    await ctx.db.patch(settings._id, { service: { ...settings.service, orderingMode: args.orderingMode } });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      actorMemberId: actor.member._id,
      action: "venue.settings.ordering_mode",
      resourceType: "venue",
      resourceId: actor.venue._id,
      before: { orderingMode: settings.service.orderingMode },
      after: { orderingMode: args.orderingMode },
    });
  },
});
