/**
 * Import et duplication de carte — Joliba
 *
 * Deux façons de ne pas tout retaper :
 *  - un fichier CSV, relu ICI avec les mêmes règles que l'aperçu et que la saisie à la main ;
 *  - la carte d'un autre établissement de la MÊME organisation.
 *
 * Les deux créent un BROUILLON : rien n'arrive chez le client avant une publication. Les deux
 * fixent des prix : `menu.edit` et `menu.price.edit` sont exigés. Tout ou rien : une ligne
 * refusée annule l'import entier, on ne laisse pas une carte à moitié importée.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { getInVenue } from "./lib/catalogAccess";
import { cleanName } from "./lib/catalog";
import { forbidden, invalid, notFound } from "./lib/errors";
import { accessibleVenues, requirePermission, type MutationCtx, type VenueActor } from "./lib/guards";
import { buildDraftSnapshot, countProducts as countSnapshotProducts } from "./lib/menuSnapshot";
import { uniqueSlug } from "./lib/slug";
import { IMPORT_MAX_ROWS } from "./lib/menuImport";
import { countProducts, insertProduct } from "./products";
import { sectionsOf } from "./menus";

const MAX_PRODUCTS_PER_VENUE = 1500;

function requirePriceRight(actor: VenueActor) {
  if (!actor.permissions.has("menu.price.edit")) {
    throw forbidden("Importer une carte fixe des prix : il faut aussi le droit de modifier les prix.");
  }
}

async function sectionByName(ctx: MutationCtx, venueId: Id<"venues">, menu: Doc<"menus">, cache: Map<string, Id<"menuSections">>, name: string) {
  const key = name.trim().toLowerCase();
  const known = cache.get(key);
  if (known) return known;
  const existing = (await sectionsOf(ctx, menu._id)).find((s) => s.name.trim().toLowerCase() === key && s.isActive);
  if (existing) {
    cache.set(key, existing._id);
    return existing._id;
  }
  const last = (await sectionsOf(ctx, menu._id)).reduce((max, s) => Math.max(max, s.sortOrder + 1), 0);
  const id = await ctx.db.insert("menuSections", {
    venueId,
    menuId: menu._id,
    name: cleanName(name, "Le nom de la section"),
    sortOrder: last,
    isActive: true,
  });
  cache.set(key, id);
  return id;
}

/**
 * Applique des lignes déjà lues du CSV (`lib/menuImport.ts`). Les sections sont retrouvées
 * par leur nom ou créées ; chaque produit passe par `insertProduct`, comme une saisie.
 */
export const apply = mutation({
  args: {
    venueId: v.id("venues"),
    menuId: v.id("menus"),
    rows: v.array(
      v.object({
        line: v.number(),
        section: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        price: v.number(),
        allergens: v.array(v.string()),
        tags: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    requirePriceRight(actor);
    const menu = await getInVenue(ctx, args.menuId, actor.venue._id, "Cette carte");
    if (menu.status === "archived") throw invalid("Cette carte est archivée.");
    if (args.rows.length === 0 || args.rows.length > IMPORT_MAX_ROWS) {
      throw invalid(`Entre 1 et ${IMPORT_MAX_ROWS} produits par import.`);
    }
    if ((await countProducts(ctx, actor.venue._id)) + args.rows.length > MAX_PRODUCTS_PER_VENUE) {
      throw invalid(`Cet import dépasserait ${MAX_PRODUCTS_PER_VENUE} produits pour l'établissement.`);
    }
    const sections = new Map<string, Id<"menuSections">>();
    for (const row of args.rows) {
      try {
        const menuSectionId = await sectionByName(ctx, actor.venue._id, menu, sections, row.section);
        await insertProduct(ctx, actor.venue, {
          menuSectionId,
          name: row.name,
          basePrice: row.price,
          allergens: row.allergens,
          tags: row.tags,
          ...(row.description !== undefined ? { description: row.description } : {}),
        });
      } catch (error) {
        // Une erreur de saisie reçoit le numéro de ligne du tableur, pour que la correction se
        // fasse au bon endroit. Toute autre erreur est un défaut du logiciel : elle remonte telle quelle.
        if (!(error instanceof ConvexError)) throw error;
        const message = (error.data as { message?: string }).message ?? "Ligne invalide.";
        throw invalid(`Ligne ${row.line} : ${message}`);
      }
    }
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "menu.import",
      resourceType: "menu",
      resourceId: menu._id,
      after: { products: args.rows.length, sections: sections.size },
    });
    return { products: args.rows.length, sections: sections.size };
  },
});

/** Les cartes qu'on peut recopier ici : celles des AUTRES établissements de l'organisation. */
export const sources = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const venues = await accessibleVenues(ctx, actor);
    const result = [];
    for (const venue of venues) {
      if (venue._id === actor.venue._id) continue;
      const menus = (
        await ctx.db
          .query("menus")
          .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
          .collect()
      ).filter((m) => m.status !== "archived");
      if (menus.length === 0) continue;
      result.push({ venueId: venue._id, venueName: venue.name, menus: menus.map((m) => ({ _id: m._id, name: m.name })) });
    }
    return result;
  },
});

/**
 * Recopie une carte d'un autre établissement de la même organisation, en brouillon : sections,
 * produits actifs, variantes, groupes d'options (recréés ici), photos (les mêmes fichiers).
 * Les disponibilités repartent à « disponible » : une rupture n'a de sens que sur place.
 */
export const duplicateFromVenue = mutation({
  args: { venueId: v.id("venues"), sourceVenueId: v.id("venues"), sourceMenuId: v.id("menus") },
  handler: async (ctx, args) => {
    const target = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    requirePriceRight(target);
    if (args.sourceVenueId === args.venueId) throw invalid("Choisissez un autre établissement que celui-ci.");
    // Lire la source exige d'y avoir accès, comme n'importe quelle lecture de carte.
    const source = await requirePermission(ctx, "menu.read", { venueId: args.sourceVenueId });
    // Jamais d'une organisation à l'autre, même pour qui appartient aux deux (R25).
    if (source.venue.organizationId !== target.venue.organizationId) throw notFound("Cette carte");
    const sourceMenu = await getInVenue(ctx, args.sourceMenuId, source.venue._id, "Cette carte");
    if (sourceMenu.status === "archived") throw invalid("Cette carte est archivée.");
    if (source.venue.currency !== target.venue.currency) {
      throw invalid("Les deux établissements n'ont pas la même devise : les prix ne peuvent pas être recopiés.");
    }
    const snapshot = await buildDraftSnapshot(ctx, sourceMenu, source.venue.currency);
    if ((await countProducts(ctx, target.venue._id)) + countSnapshotProducts(snapshot) > MAX_PRODUCTS_PER_VENUE) {
      throw invalid(`Cette copie dépasserait ${MAX_PRODUCTS_PER_VENUE} produits pour l'établissement.`);
    }

    const venueId = target.venue._id;
    const existingMenus = await ctx.db
      .query("menus")
      .withIndex("by_venue", (q) => q.eq("venueId", venueId))
      .collect();
    const menuName = existingMenus.some((m) => m.name === sourceMenu.name) ? `${sourceMenu.name} (copie)`.slice(0, 80) : sourceMenu.name;
    const slug = await uniqueSlug(menuName, async (candidate) => existingMenus.some((m) => m.slug === candidate));
    const menuId = await ctx.db.insert("menus", {
      venueId,
      name: menuName,
      slug,
      status: "draft",
      sortOrder: existingMenus.reduce((max, m) => Math.max(max, m.sortOrder + 1), 0),
      ...(sourceMenu.activeSchedule ? { activeSchedule: sourceMenu.activeSchedule } : {}),
    });

    const groups = new Map<string, Id<"modifierGroups">>();
    let products = 0;
    for (const [sectionIndex, section] of snapshot.sections.entries()) {
      const sectionId = await ctx.db.insert("menuSections", {
        venueId,
        menuId,
        name: section.name,
        ...(section.description ? { description: section.description } : {}),
        ...(section.i18n ? { i18n: section.i18n } : {}),
        sortOrder: sectionIndex,
        isActive: true,
      });
      for (const p of section.products) {
        const sourceProduct = (await ctx.db.get(p.id as Id<"products">)) as Doc<"products"> | null;
        const productId = await insertProduct(ctx, target.venue, {
          menuSectionId: sectionId,
          name: p.name,
          basePrice: p.basePrice,
          tags: p.tags,
          allergens: p.allergens,
          dietary: p.dietary,
          images: sourceProduct?.images ?? [],
          ...(p.description ? { description: p.description } : {}),
          ...(p.i18n ? { i18n: p.i18n } : {}),
          ...(sourceProduct?.prepMinutes !== undefined ? { prepMinutes: sourceProduct.prepMinutes } : {}),
        });
        products++;
        for (const [index, variant] of p.variants.entries()) {
          await ctx.db.insert("productVariants", {
            venueId,
            productId,
            name: variant.name,
            ...(variant.i18n ? { i18n: variant.i18n } : {}),
            price: variant.price,
            isDefault: variant.isDefault,
            isAvailable: true,
            sortOrder: index,
          });
        }
        for (const [index, group] of p.modifierGroups.entries()) {
          let groupId = groups.get(group.id);
          if (!groupId) {
            groupId = await ctx.db.insert("modifierGroups", {
              venueId,
              name: group.name,
              ...(group.i18n ? { i18n: group.i18n } : {}),
              selectionType: group.selectionType,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              isRequired: group.isRequired,
            });
            for (const [optionIndex, option] of group.options.entries()) {
              await ctx.db.insert("modifierOptions", {
                venueId,
                modifierGroupId: groupId,
                name: option.name,
                ...(option.i18n ? { i18n: option.i18n } : {}),
                priceDelta: option.priceDelta,
                isAvailable: true,
                sortOrder: optionIndex,
              });
            }
            groups.set(group.id, groupId);
          }
          await ctx.db.insert("productModifierGroups", { venueId, productId, modifierGroupId: groupId, sortOrder: index });
        }
      }
    }
    await writeAudit(ctx, {
      organizationId: target.organization._id,
      venueId,
      actorUserId: target.user._id,
      action: "menu.duplicate",
      resourceType: "menu",
      resourceId: menuId,
      after: { fromVenueId: source.venue._id, fromMenuId: sourceMenu._id, products },
    });
    return { menuId, products };
  },
});
