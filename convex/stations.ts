/**
 * Postes de préparation — Joliba
 *
 * Un poste, c'est un écran de production : la cuisine, le bar, les grillades. Chaque produit
 * est routé vers un poste ; une commande se découpe en autant de bons qu'elle touche de postes
 * (R11) — le bar ne voit jamais le poulet, la cuisine ne voit jamais le bissap.
 *
 * Un produit sans poste va au PREMIER poste actif. Un établissement sans aucun poste en reçoit
 * un, « Cuisine », au premier envoi de commande (`ensureDefaultStation`) : on ne bloque pas un
 * service parce qu'un réglage n'a pas été fait.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { assertSamePermutation, getInVenue } from "./lib/catalogAccess";
import { cleanName } from "./lib/catalog";
import { conflict, invalid } from "./lib/errors";
import { requirePermission, type MutationCtx, type ReadCtx } from "./lib/guards";

export const MAX_STATIONS = 12;

const stationType = v.union(v.literal("kitchen"), v.literal("bar"), v.literal("grill"), v.literal("pastry"), v.literal("other"));

export async function stationsOf(ctx: ReadCtx, venueId: Id<"venues">): Promise<Doc<"prepStations">[]> {
  return ctx.db
    .query("prepStations")
    .withIndex("by_venue_sort", (q) => q.eq("venueId", venueId))
    .collect();
}

/** Le poste de repli, créé s'il n'en existe aucun. */
export async function ensureDefaultStation(ctx: MutationCtx, venueId: Id<"venues">): Promise<Doc<"prepStations">> {
  const active = (await stationsOf(ctx, venueId)).filter((s) => s.isActive);
  if (active.length > 0) return active[0]!;
  const id = await ctx.db.insert("prepStations", {
    venueId,
    name: "Cuisine",
    type: "kitchen",
    sortOrder: 0,
    targetPrepMinutes: 15,
    lateThresholdMinutes: 20,
    soundEnabled: true,
    isActive: true,
  });
  return (await ctx.db.get(id))!;
}

function assertMinutes(value: number, what: string) {
  if (!Number.isInteger(value) || value < 1 || value > 180) throw invalid(`${what} : de 1 à 180 minutes.`);
}

/** Les postes et, pour chacun, le nombre de produits qui y sont routés. */
export const list = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.read", { venueId: args.venueId });
    const stations = await stationsOf(ctx, actor.venue._id);
    const firstActive = stations.find((s) => s.isActive)?._id ?? null;
    const products = await ctx.db
      .query("products")
      .withIndex("by_venue_active", (q) => q.eq("venueId", actor.venue._id).eq("isActive", true))
      .collect();
    return stations.map((s) => ({
      _id: s._id,
      name: s.name,
      type: s.type,
      targetPrepMinutes: s.targetPrepMinutes,
      lateThresholdMinutes: s.lateThresholdMinutes,
      soundEnabled: s.soundEnabled,
      isActive: s.isActive,
      isDefault: s._id === firstActive,
      productCount: products.filter((p) => p.prepStationId === s._id || (p.prepStationId === undefined && s._id === firstActive)).length,
    }));
  },
});

export const create = mutation({
  args: { venueId: v.id("venues"), name: v.string(), type: stationType },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.manage", { venueId: args.venueId });
    const stations = await stationsOf(ctx, actor.venue._id);
    if (stations.filter((s) => s.isActive).length >= MAX_STATIONS) throw conflict(`${MAX_STATIONS} postes au plus.`);
    const name = cleanName(args.name, "Le nom du poste");
    if (stations.some((s) => s.isActive && s.name.toLowerCase() === name.toLowerCase())) throw conflict("Un poste porte déjà ce nom.");
    const id = await ctx.db.insert("prepStations", {
      venueId: actor.venue._id,
      name,
      type: args.type,
      sortOrder: stations.length,
      targetPrepMinutes: args.type === "bar" ? 5 : 15,
      lateThresholdMinutes: args.type === "bar" ? 10 : 20,
      soundEnabled: true,
      isActive: true,
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "station.create",
      resourceType: "prepStation",
      resourceId: id,
      after: { name, type: args.type },
    });
    return id;
  },
});

export const update = mutation({
  args: {
    venueId: v.id("venues"),
    stationId: v.id("prepStations"),
    name: v.optional(v.string()),
    targetPrepMinutes: v.optional(v.number()),
    lateThresholdMinutes: v.optional(v.number()),
    soundEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.manage", { venueId: args.venueId });
    const station = await getInVenue(ctx, args.stationId, actor.venue._id, "Ce poste");
    const patch: Partial<Doc<"prepStations">> = {};
    if (args.name !== undefined) {
      const name = cleanName(args.name, "Le nom du poste");
      const others = (await stationsOf(ctx, actor.venue._id)).filter((s) => s._id !== station._id && s.isActive);
      if (others.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw conflict("Un poste porte déjà ce nom.");
      patch.name = name;
    }
    const target = args.targetPrepMinutes ?? station.targetPrepMinutes;
    const late = args.lateThresholdMinutes ?? station.lateThresholdMinutes;
    assertMinutes(target, "Le temps visé");
    assertMinutes(late, "Le seuil de retard");
    if (late < target) throw invalid("Le seuil de retard ne peut pas précéder le temps visé.");
    patch.targetPrepMinutes = target;
    patch.lateThresholdMinutes = late;
    if (args.soundEnabled !== undefined) patch.soundEnabled = args.soundEnabled;
    await ctx.db.patch(station._id, patch);
  },
});

/**
 * Retirer un poste. Refusé tant que des bons y sont en cours : les faire disparaître d'un
 * écran en plein service, c'est perdre des plats. Ses produits reviennent au poste par défaut.
 */
export const archive = mutation({
  args: { venueId: v.id("venues"), stationId: v.id("prepStations") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.manage", { venueId: args.venueId });
    const station = await getInVenue(ctx, args.stationId, actor.venue._id, "Ce poste");
    for (const status of ["held", "queued", "started", "recalled", "ready"] as const) {
      const pending = await ctx.db
        .query("kitchenTickets")
        .withIndex("by_station_status_queued", (q) => q.eq("prepStationId", station._id).eq("status", status))
        .first();
      if (pending) throw conflict("Ce poste a encore des bons en cours. Terminez le service avant de le retirer.");
    }
    await ctx.db.patch(station._id, { isActive: false });
    const routed = await ctx.db
      .query("products")
      .withIndex("by_venue_station", (q) => q.eq("venueId", actor.venue._id).eq("prepStationId", station._id))
      .collect();
    for (const product of routed) await ctx.db.patch(product._id, { prepStationId: undefined });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "station.archive",
      resourceType: "prepStation",
      resourceId: station._id,
      before: { name: station.name },
    });
  },
});

export const reorder = mutation({
  args: { venueId: v.id("venues"), stationIds: v.array(v.id("prepStations")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.manage", { venueId: args.venueId });
    const active = (await stationsOf(ctx, actor.venue._id)).filter((s) => s.isActive);
    assertSamePermutation(
      active.map((s) => s._id),
      args.stationIds,
    );
    for (const [i, id] of args.stationIds.entries()) await ctx.db.patch(id, { sortOrder: i });
  },
});

/**
 * Router une section entière vers un poste : « Boissons → Bar » en un geste. `null` renvoie
 * vers le poste par défaut. Le routage n'est PAS une donnée publiée : il vaut dès maintenant,
 * pour les commandes suivantes seulement (les bons déjà envoyés gardent leur poste, R6).
 */
export const routeSection = mutation({
  args: { venueId: v.id("venues"), sectionId: v.id("menuSections"), stationId: v.union(v.id("prepStations"), v.null()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.manage", { venueId: args.venueId });
    const section = await getInVenue(ctx, args.sectionId, actor.venue._id, "Cette section");
    if (args.stationId !== null) {
      const station = await getInVenue(ctx, args.stationId, actor.venue._id, "Ce poste");
      if (!station.isActive) throw invalid("Ce poste est retiré.");
    }
    const products = await ctx.db
      .query("products")
      .withIndex("by_venue_section_sort", (q) => q.eq("venueId", actor.venue._id).eq("menuSectionId", section._id))
      .collect();
    for (const p of products) await ctx.db.patch(p._id, { prepStationId: args.stationId ?? undefined });
    return products.length;
  },
});

/** Router un seul produit. */
export const routeProduct = mutation({
  args: { venueId: v.id("venues"), productId: v.id("products"), stationId: v.union(v.id("prepStations"), v.null()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.manage", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    if (args.stationId !== null) {
      const station = await getInVenue(ctx, args.stationId, actor.venue._id, "Ce poste");
      if (!station.isActive) throw invalid("Ce poste est retiré.");
    }
    await ctx.db.patch(product._id, { prepStationId: args.stationId ?? undefined });
  },
});

/** Pour l'écran de routage : chaque section de chaque carte, avec le poste de ses produits. */
export const routing = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "kitchen.manage", { venueId: args.venueId });
    const menus = (
      await ctx.db
        .query("menus")
        .withIndex("by_venue", (q) => q.eq("venueId", actor.venue._id))
        .collect()
    )
      .filter((m) => m.status !== "archived")
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const result = [];
    for (const menu of menus) {
      const sections = await ctx.db
        .query("menuSections")
        .withIndex("by_menu_sort", (q) => q.eq("menuId", menu._id))
        .collect();
      for (const section of sections.filter((s) => s.isActive)) {
        const products = (
          await ctx.db
            .query("products")
            .withIndex("by_venue_section_sort", (q) => q.eq("venueId", actor.venue._id).eq("menuSectionId", section._id))
            .collect()
        ).filter((p) => p.isActive);
        const stationIds = [...new Set(products.map((p) => p.prepStationId ?? null))];
        result.push({
          menuName: menu.name,
          sectionId: section._id,
          sectionName: section.name,
          productCount: products.length,
          /** Un seul poste pour toute la section, ou `"mixed"` si ses produits diffèrent. */
          stationId: stationIds.length === 1 ? stationIds[0]! : products.length === 0 ? null : ("mixed" as const),
          /** Le poste de chaque produit (`null` : le poste par défaut), pour les exceptions. */
          products: products.map((p) => ({ _id: p._id, name: p.name, stationId: p.prepStationId ?? null })),
        });
      }
    }
    return result;
  },
});
