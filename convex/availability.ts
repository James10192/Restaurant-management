/**
 * Disponibilité — Joliba
 *
 * Deux choses différentes, qu'on ne mélange pas :
 *  - l'INTERRUPTEUR, geste de service (« plus de poisson ce soir »), permission
 *    `menu.availability.toggle` SEULE. Il ne passe pas par la publication : il vaut tout de
 *    suite, pour tous les clients à table (IA §4.11) ;
 *  - les PLAGES programmées (petit déjeuner 7 h – 11 h), qui relèvent de l'édition de la
 *    carte : `menu.edit`.
 *
 * Une bascule est idempotente par construction (on POSE un état, on ne l'inverse pas) :
 * rejouée après une coupure réseau, elle ne produit rien de plus (cercle 2 de A4).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { getInVenue } from "./lib/catalogAccess";
import { invalid } from "./lib/errors";
import { requirePermission, type ReadCtx } from "./lib/guards";

const MAX_UNAVAILABLE_DAYS = 31;
const MAX_RULES_PER_VENUE = 200;

const targetType = v.union(v.literal("product"), v.literal("section"), v.literal("menu"));

/** Le tableau de service : tous les produits en ligne ou non, et ce qui les rend indisponibles. */
export const board = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.availability.toggle", { venueId: args.venueId });
    const products = await ctx.db
      .query("products")
      .withIndex("by_venue_active", (q) => q.eq("venueId", actor.venue._id).eq("isActive", true))
      .collect();
    const sections = new Map<string, Doc<"menuSections"> | null>();
    const rows = [];
    for (const p of products) {
      if (!sections.has(p.menuSectionId)) sections.set(p.menuSectionId, await ctx.db.get(p.menuSectionId));
      const section = sections.get(p.menuSectionId);
      rows.push({
        _id: p._id,
        name: p.name,
        sectionId: p.menuSectionId,
        sectionName: section?.name ?? "",
        menuId: section?.menuId ?? null,
        isAvailable: p.isAvailable,
        unavailableUntil: p.unavailableUntil ?? null,
      });
    }
    return {
      timezone: actor.venue.timezone,
      products: rows.sort((a, b) => a.name.localeCompare(b.name, "fr")),
      rules: await rulesOf(ctx, actor.venue._id),
      canEditRules: actor.permissions.has("menu.edit"),
    };
  },
});

async function rulesOf(ctx: ReadCtx, venueId: Id<"venues">) {
  const rules = await ctx.db
    .query("availabilityRules")
    .withIndex("by_venue_active", (q) => q.eq("venueId", venueId).eq("isActive", true))
    .collect();
  return rules.map((r) => ({
    _id: r._id,
    targetType: r.targetType,
    targetId: r.targetId,
    ruleType: r.ruleType,
    daysOfWeek: r.daysOfWeek,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    effectiveFrom: r.effectiveFrom ?? null,
    effectiveTo: r.effectiveTo ?? null,
  }));
}

/**
 * Rend un produit disponible ou non. `until` : jusqu'à quand (ce soir, demain) ; absent,
 * jusqu'à nouvel ordre. Rendu disponible, la rupture datée est effacée.
 */
export const setProduct = mutation({
  args: {
    venueId: v.id("venues"),
    productId: v.id("products"),
    isAvailable: v.boolean(),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.availability.toggle", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    let unavailableUntil: number | undefined;
    if (!args.isAvailable && args.until !== undefined) {
      const now = Date.now();
      if (args.until <= now) throw invalid("L'échéance est déjà passée.");
      if (args.until > now + MAX_UNAVAILABLE_DAYS * 86_400_000) {
        throw invalid(`Une rupture datée ne dépasse pas ${MAX_UNAVAILABLE_DAYS} jours. Au-delà, choisissez « jusqu'à nouvel ordre ».`);
      }
      unavailableUntil = args.until;
    }
    await ctx.db.patch(product._id, { isAvailable: args.isAvailable, unavailableUntil });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: args.isAvailable ? "product.available" : "product.unavailable",
      resourceType: "product",
      resourceId: product._id,
      ...(unavailableUntil !== undefined ? { after: { unavailableUntil } } : {}),
    });
  },
});

export const setVariant = mutation({
  args: { venueId: v.id("venues"), variantId: v.id("productVariants"), isAvailable: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.availability.toggle", { venueId: args.venueId });
    const variant = await getInVenue(ctx, args.variantId, actor.venue._id, "Cette variante");
    await ctx.db.patch(variant._id, { isAvailable: args.isAvailable });
  },
});

export const setOption = mutation({
  args: { venueId: v.id("venues"), optionId: v.id("modifierOptions"), isAvailable: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.availability.toggle", { venueId: args.venueId });
    const option = await getInVenue(ctx, args.optionId, actor.venue._id, "Cette option");
    await ctx.db.patch(option._id, { isAvailable: args.isAvailable });
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Plages programmées
 * ──────────────────────────────────────────────────────────────────────────── */

async function assertTarget(ctx: ReadCtx, venueId: Id<"venues">, type: "product" | "section" | "menu", id: string) {
  const normalized =
    type === "product"
      ? ctx.db.normalizeId("products", id)
      : type === "section"
        ? ctx.db.normalizeId("menuSections", id)
        : ctx.db.normalizeId("menus", id);
  if (!normalized) throw invalid("Cible de la plage inconnue.");
  const doc = (await ctx.db.get(normalized)) as { venueId: Id<"venues"> } | null;
  if (!doc || doc.venueId !== venueId) throw invalid("Cible de la plage inconnue.");
  return normalized as string;
}

function cleanWindow(args: { daysOfWeek: number[]; startMinute: number; endMinute: number }) {
  const days = [...new Set(args.daysOfWeek)].sort();
  if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw invalid("Choisissez au moins un jour de la semaine.");
  }
  for (const m of [args.startMinute, args.endMinute]) {
    if (!Number.isInteger(m) || m < 0 || m > 1440) throw invalid("Heure invalide.");
  }
  if (args.startMinute === args.endMinute) throw invalid("La plage horaire est vide.");
  return { daysOfWeek: days, startMinute: args.startMinute, endMinute: args.endMinute };
}

export const createRule = mutation({
  args: {
    venueId: v.id("venues"),
    targetType,
    targetId: v.string(),
    ruleType: v.union(v.literal("available"), v.literal("unavailable")),
    daysOfWeek: v.array(v.number()),
    startMinute: v.number(),
    endMinute: v.number(),
    effectiveFrom: v.optional(v.number()),
    effectiveTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const targetId = await assertTarget(ctx, actor.venue._id, args.targetType, args.targetId);
    if (args.effectiveFrom !== undefined && args.effectiveTo !== undefined && args.effectiveTo <= args.effectiveFrom) {
      throw invalid("La date de fin doit suivre la date de début.");
    }
    const count = (
      await ctx.db
        .query("availabilityRules")
        .withIndex("by_venue_active", (q) => q.eq("venueId", actor.venue._id).eq("isActive", true))
        .collect()
    ).length;
    if (count >= MAX_RULES_PER_VENUE) throw invalid(`Pas plus de ${MAX_RULES_PER_VENUE} plages actives.`);
    return ctx.db.insert("availabilityRules", {
      venueId: actor.venue._id,
      targetType: args.targetType,
      targetId,
      ruleType: args.ruleType,
      ...cleanWindow(args),
      ...(args.effectiveFrom !== undefined ? { effectiveFrom: args.effectiveFrom } : {}),
      ...(args.effectiveTo !== undefined ? { effectiveTo: args.effectiveTo } : {}),
      isActive: true,
    });
  },
});

export const deleteRule = mutation({
  args: { venueId: v.id("venues"), ruleId: v.id("availabilityRules") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const rule = await getInVenue(ctx, args.ruleId, actor.venue._id, "Cette plage");
    await ctx.db.delete(rule._id);
  },
});
