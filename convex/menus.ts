/**
 * Cartes et sections — Joliba
 *
 * Une carte (« Midi », « Soir », « Boissons ») regroupe des sections, qui regroupent des
 * produits. Tout ce qui est modifié ici est un BROUILLON : le client ne voit que la
 * dernière publication (R22, `publications.ts`). Y compris le nom de la carte, son ordre et
 * sa plage horaire — sinon une modification en cours d'édition apparaîtrait à table.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { assertSamePermutation, getInVenue } from "./lib/catalogAccess";
import { cleanDescription, cleanI18n, cleanName } from "./lib/catalog";
import { invalid } from "./lib/errors";
import { requirePermission, type MutationCtx, type ReadCtx } from "./lib/guards";
import { uniqueSlug } from "./lib/slug";

const MAX_MENUS_PER_VENUE = 12;
const MAX_SECTIONS_PER_MENU = 40;

const i18nArg = v.optional(
  v.record(v.string(), v.object({ name: v.optional(v.string()), description: v.optional(v.string()) })),
);

const scheduleArg = v.object({
  daysOfWeek: v.array(v.number()),
  startMinute: v.number(),
  endMinute: v.number(),
});

function cleanSchedule(schedule: { daysOfWeek: number[]; startMinute: number; endMinute: number }) {
  const days = [...new Set(schedule.daysOfWeek)].sort();
  if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw invalid("Choisissez au moins un jour de la semaine.");
  }
  for (const m of [schedule.startMinute, schedule.endMinute]) {
    if (!Number.isInteger(m) || m < 0 || m > 1440) throw invalid("Heure invalide.");
  }
  // Une plage qui passe minuit (22 h – 2 h) est permise : fin < début.
  if (schedule.startMinute === schedule.endMinute) throw invalid("La plage horaire est vide.");
  return { daysOfWeek: days, startMinute: schedule.startMinute, endMinute: schedule.endMinute };
}

async function menusOf(ctx: ReadCtx, venueId: Id<"venues">): Promise<Doc<"menus">[]> {
  return ctx.db
    .query("menus")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .collect();
}

export async function sectionsOf(ctx: ReadCtx, menuId: Id<"menus">): Promise<Doc<"menuSections">[]> {
  return ctx.db
    .query("menuSections")
    .withIndex("by_menu_sort", (q) => q.eq("menuId", menuId))
    .collect();
}

/** Les cartes de l'établissement, avec de quoi répondre à « ma carte est-elle à jour ? ». */
export const list = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.read", { venueId: args.venueId });
    const menus = (await menusOf(ctx, actor.venue._id))
      .filter((m) => m.status !== "archived")
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const result = [];
    for (const menu of menus) {
      const sections = await sectionsOf(ctx, menu._id);
      let productCount = 0;
      for (const section of sections) {
        const products = await ctx.db
          .query("products")
          .withIndex("by_venue_section_sort", (q) => q.eq("venueId", actor.venue._id).eq("menuSectionId", section._id))
          .collect();
        productCount += products.filter((p) => p.isActive).length;
      }
      const publication = menu.publishedVersionId ? await ctx.db.get(menu.publishedVersionId) : null;
      result.push({
        _id: menu._id,
        name: menu.name,
        status: menu.status,
        sectionCount: sections.filter((s) => s.isActive).length,
        productCount,
        publishedVersion: publication?.version ?? null,
        publishedAt: publication?.publishedAt ?? null,
      });
    }
    return result;
  },
});

/**
 * L'arbre complet d'une carte, pour l'écran d'édition : sections, produits (archivés
 * compris, marqués), variantes et groupes d'options rattachés.
 */
export const editor = query({
  args: { venueId: v.id("venues"), menuId: v.id("menus") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.read", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    if (menu.status === "archived") throw invalid("Cette carte est archivée.");
    const sections = await sectionsOf(ctx, menu._id);
    const tree = [];
    for (const section of sections) {
      const products = await ctx.db
        .query("products")
        .withIndex("by_venue_section_sort", (q) => q.eq("venueId", actor.venue._id).eq("menuSectionId", section._id))
        .collect();
      const rows = [];
      for (const p of products) {
        const variants = await ctx.db
          .query("productVariants")
          .withIndex("by_product_sort", (q) => q.eq("productId", p._id))
          .collect();
        const thumb = p.images[0] ? await ctx.storage.getUrl(p.images[0].thumbStorageId) : null;
        rows.push({
          _id: p._id,
          name: p.name,
          description: p.description ?? null,
          basePrice: p.basePrice,
          currency: p.currency,
          isActive: p.isActive,
          isAvailable: p.isAvailable,
          unavailableUntil: p.unavailableUntil ?? null,
          variantCount: variants.length,
          thumbUrl: thumb,
        });
      }
      tree.push({
        _id: section._id,
        name: section.name,
        description: section.description ?? null,
        i18n: section.i18n ?? null,
        isActive: section.isActive,
        products: rows,
      });
    }
    return {
      menu: {
        _id: menu._id,
        name: menu.name,
        status: menu.status,
        activeSchedule: menu.activeSchedule ?? null,
      },
      currency: actor.venue.currency,
      sections: tree,
      canEdit: actor.permissions.has("menu.edit"),
      canEditPrice: actor.permissions.has("menu.price.edit"),
      canPublish: actor.permissions.has("menu.publish"),
      canToggleAvailability: actor.permissions.has("menu.availability.toggle"),
    };
  },
});

export const create = mutation({
  args: { venueId: v.id("venues"), name: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const name = cleanName(args.name, "Le nom de la carte");
    const existing = await menusOf(ctx, actor.venue._id);
    if (existing.filter((m) => m.status !== "archived").length >= MAX_MENUS_PER_VENUE) {
      throw invalid(`Pas plus de ${MAX_MENUS_PER_VENUE} cartes par établissement.`);
    }
    const slug = await uniqueSlug(name, async (candidate) => existing.some((m) => m.slug === candidate));
    const menuId = await ctx.db.insert("menus", {
      venueId: actor.venue._id,
      name,
      slug,
      status: "draft",
      sortOrder: existing.reduce((max, m) => Math.max(max, m.sortOrder + 1), 0),
    });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "menu.create",
      resourceType: "menu",
      resourceId: menuId,
      after: { name },
    });
    return menuId;
  },
});

export const update = mutation({
  args: {
    venueId: v.id("venues"),
    menuId: v.id("menus"),
    name: v.optional(v.string()),
    /** `null` retire la plage : la carte vaut à toute heure. */
    activeSchedule: v.optional(v.union(scheduleArg, v.null())),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    if (menu.status === "archived") throw invalid("Cette carte est archivée.");
    const patch: Partial<Doc<"menus">> = {};
    if (args.name !== undefined) patch.name = cleanName(args.name, "Le nom de la carte");
    if (args.activeSchedule !== undefined) {
      patch.activeSchedule = args.activeSchedule === null ? undefined : cleanSchedule(args.activeSchedule);
    }
    await ctx.db.patch(menu._id, patch);
  },
});

/**
 * Archive une carte. Si elle est publiée, elle DISPARAÎT de la table des clients : c'est
 * un acte de publication, qui exige `menu.publish` en plus de `menu.edit`.
 */
export const archive = mutation({
  args: { venueId: v.id("venues"), menuId: v.id("menus") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    if (menu.status === "archived") return;
    if (menu.status === "published" && !actor.permissions.has("menu.publish")) {
      throw invalid("Cette carte est en ligne : seule une personne habilitée à publier peut la retirer.");
    }
    await unpublishMenu(ctx, menu);
    await ctx.db.patch(menu._id, { status: "archived" });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "menu.archive",
      resourceType: "menu",
      resourceId: menu._id,
      before: { status: menu.status },
    });
  },
});

async function unpublishMenu(ctx: MutationCtx, menu: Doc<"menus">) {
  const current = await ctx.db
    .query("menuPublications")
    .withIndex("by_menu_version", (q) => q.eq("menuId", menu._id))
    .collect();
  for (const publication of current) {
    if (publication.isCurrent) await ctx.db.patch(publication._id, { isCurrent: false });
  }
}

export const reorder = mutation({
  args: { venueId: v.id("venues"), menuIds: v.array(v.id("menus")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const menus = (await menusOf(ctx, actor.venue._id)).filter((m) => m.status !== "archived");
    assertSamePermutation(
      menus.map((m) => m._id),
      args.menuIds,
    );
    for (const [index, id] of args.menuIds.entries()) await ctx.db.patch(id, { sortOrder: index });
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Sections
 * ──────────────────────────────────────────────────────────────────────────── */

/** Crée une ou plusieurs sections d'un coup (« Entrées, Plats, Boissons »). */
export const createSections = mutation({
  args: { venueId: v.id("venues"), menuId: v.id("menus"), names: v.array(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    if (menu.status === "archived") throw invalid("Cette carte est archivée.");
    if (args.names.length === 0 || args.names.length > 10) throw invalid("Entre 1 et 10 sections à la fois.");
    const existing = await sectionsOf(ctx, menu._id);
    if (existing.length + args.names.length > MAX_SECTIONS_PER_MENU) {
      throw invalid(`Pas plus de ${MAX_SECTIONS_PER_MENU} sections par carte.`);
    }
    let sortOrder = existing.reduce((max, s) => Math.max(max, s.sortOrder + 1), 0);
    const ids: Id<"menuSections">[] = [];
    for (const raw of args.names) {
      ids.push(
        await ctx.db.insert("menuSections", {
          venueId: actor.venue._id,
          menuId: menu._id,
          name: cleanName(raw, "Le nom de la section"),
          sortOrder: sortOrder++,
          isActive: true,
        }),
      );
    }
    return ids;
  },
});

export const updateSection = mutation({
  args: {
    venueId: v.id("venues"),
    sectionId: v.id("menuSections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    i18n: i18nArg,
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const section = await getInVenue(ctx, args.sectionId, actor.venue._id, "Cette section");
    const patch: Partial<Doc<"menuSections">> = {};
    if (args.name !== undefined) patch.name = cleanName(args.name, "Le nom de la section");
    if (args.description !== undefined) patch.description = cleanDescription(args.description);
    if (args.i18n !== undefined) patch.i18n = cleanI18n(args.i18n);
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(section._id, patch);
  },
});

export const reorderSections = mutation({
  args: { venueId: v.id("venues"), menuId: v.id("menus"), sectionIds: v.array(v.id("menuSections")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    const sections = await sectionsOf(ctx, menu._id);
    assertSamePermutation(
      sections.map((s) => s._id),
      args.sectionIds,
    );
    for (const [index, id] of args.sectionIds.entries()) await ctx.db.patch(id, { sortOrder: index });
  },
});
