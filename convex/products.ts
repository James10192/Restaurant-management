/**
 * Produits et variantes — Joliba
 *
 * Le découpage des permissions est DÉLIBÉRÉ (DATA_MODEL.md §4) :
 *  - `menu.edit`         : nom, description, classement, photos, options ;
 *  - `menu.price.edit`   : tout ce qui fixe un montant — le prix de base, la promotion, le
 *                          prix d'une variante, et donc aussi la CRÉATION d'un produit, qui
 *                          fixe un prix. Un acte financier, audité ;
 *  - `menu.availability.toggle` : la disponibilité, geste de service (`availability.ts`).
 *
 * Un chef de rang doit pouvoir dire « il n'y a plus de poisson » sans pouvoir changer un
 * prix. Un responsable de carte sans droit sur les prix peut tout réorganiser, rien facturer.
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { assertSamePermutation, getInVenue } from "./lib/catalogAccess";
import {
  LIMITS,
  assertPrice,
  cleanAllergens,
  cleanDescription,
  cleanDietary,
  cleanI18n,
  cleanName,
  cleanTags,
} from "./lib/catalog";
import { forbidden, invalid } from "./lib/errors";
import { requirePermission, type MutationCtx, type ReadCtx, type VenueActor } from "./lib/guards";
import { uniqueSlug } from "./lib/slug";

const MAX_PRODUCTS_PER_VENUE = 1500;
/** Les photos sont réduites dans le navigateur ; au-delà, elles n'ont pas été réduites. */
const MAX_IMAGE_BYTES = 600 * 1024;
const MAX_THUMB_BYTES = 80 * 1024;

const i18nArg = v.optional(
  v.record(v.string(), v.object({ name: v.optional(v.string()), description: v.optional(v.string()) })),
);
const dietaryArg = v.object({
  vegetarian: v.optional(v.boolean()),
  vegan: v.optional(v.boolean()),
  halal: v.optional(v.boolean()),
  spicyLevel: v.optional(v.number()),
});

function requireAlso(actor: VenueActor, permission: "menu.price.edit" | "menu.edit", message: string) {
  if (!actor.permissions.has(permission)) throw forbidden(message);
}

async function productSlugTaken(ctx: ReadCtx, venueId: Id<"venues">, slug: string) {
  return Boolean(
    await ctx.db
      .query("products")
      .withIndex("by_venue_slug", (q) => q.eq("venueId", venueId).eq("slug", slug))
      .first(),
  );
}

async function nextProductSort(ctx: ReadCtx, venueId: Id<"venues">, sectionId: Id<"menuSections">) {
  const last = await ctx.db
    .query("products")
    .withIndex("by_venue_section_sort", (q) => q.eq("venueId", venueId).eq("menuSectionId", sectionId))
    .order("desc")
    .first();
  return last ? last.sortOrder + 1 : 0;
}

async function variantsOf(ctx: ReadCtx, productId: Id<"products">) {
  return ctx.db
    .query("productVariants")
    .withIndex("by_product_sort", (q) => q.eq("productId", productId))
    .collect();
}

async function linksOf(ctx: ReadCtx, productId: Id<"products">) {
  return ctx.db
    .query("productModifierGroups")
    .withIndex("by_product_sort", (q) => q.eq("productId", productId))
    .collect();
}

export type NewProduct = {
  menuSectionId: Id<"menuSections">;
  name: string;
  description?: string;
  basePrice: number;
  i18n?: Record<string, { name?: string; description?: string }>;
  tags?: string[];
  allergens?: string[];
  dietary?: { vegetarian?: boolean; vegan?: boolean; halal?: boolean; spicyLevel?: number };
  prepMinutes?: number;
  images?: Doc<"products">["images"];
};

/**
 * Insère un produit validé. Partagée par la saisie, l'import CSV et la duplication : les
 * trois passent par les MÊMES règles, et la garde reste à l'appelant.
 */
export async function insertProduct(ctx: MutationCtx, venue: Doc<"venues">, input: NewProduct): Promise<Id<"products">> {
  const section = await getInVenue(ctx, input.menuSectionId, venue._id, "Cette section");
  const name = cleanName(input.name, "Le nom du produit");
  const description = cleanDescription(input.description);
  const i18n = cleanI18n(input.i18n);
  if (input.prepMinutes !== undefined && (!Number.isInteger(input.prepMinutes) || input.prepMinutes < 0 || input.prepMinutes > 240)) {
    throw invalid("La durée de préparation va de 0 à 240 minutes.");
  }
  const slug = await uniqueSlug(name, (candidate) => productSlugTaken(ctx, venue._id, candidate));
  return ctx.db.insert("products", {
    venueId: venue._id,
    menuSectionId: section._id,
    name,
    slug,
    ...(description ? { description } : {}),
    ...(i18n ? { i18n } : {}),
    basePrice: assertPrice(input.basePrice),
    currency: venue.currency,
    taxCodes: [],
    images: input.images ?? [],
    tags: cleanTags(input.tags ?? []),
    allergens: cleanAllergens(input.allergens ?? []),
    dietary: cleanDietary(input.dietary ?? {}),
    ...(input.prepMinutes !== undefined ? { prepMinutes: input.prepMinutes } : {}),
    isAvailable: true,
    relatedProductIds: [],
    sortOrder: await nextProductSort(ctx, venue._id, section._id),
    isActive: true,
  });
}

export async function countProducts(ctx: ReadCtx, venueId: Id<"venues">): Promise<number> {
  return (
    await ctx.db
      .query("products")
      .withIndex("by_venue_active", (q) => q.eq("venueId", venueId).eq("isActive", true))
      .collect()
  ).length;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Lecture
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Catalogue de l'établissement. La recherche passe par l'index plein texte FILTRÉ par
 * établissement : jamais un balayage de la table (IA §4.11).
 */
export const list = query({
  args: {
    venueId: v.id("venues"),
    search: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.read", { venueId: args.venueId });
    const venueId = actor.venue._id;
    const search = args.search?.trim();
    let products: Doc<"products">[];
    if (search) {
      products = await ctx.db
        .query("products")
        .withSearchIndex("search_products", (q) => {
          const base = q.search("name", search).eq("venueId", venueId);
          return args.includeArchived ? base : base.eq("isActive", true);
        })
        .take(50);
    } else if (args.includeArchived) {
      products = await ctx.db
        .query("products")
        .withIndex("by_venue_section_sort", (q) => q.eq("venueId", venueId))
        .collect();
    } else {
      products = await ctx.db
        .query("products")
        .withIndex("by_venue_active", (q) => q.eq("venueId", venueId).eq("isActive", true))
        .collect();
    }
    const sectionNames = new Map<string, string>();
    const rows = [];
    for (const p of products) {
      if (!sectionNames.has(p.menuSectionId)) {
        const section = await ctx.db.get(p.menuSectionId);
        sectionNames.set(p.menuSectionId, section?.name ?? "");
      }
      rows.push({
        _id: p._id,
        name: p.name,
        sectionId: p.menuSectionId,
        sectionName: sectionNames.get(p.menuSectionId) ?? "",
        basePrice: p.basePrice,
        currency: p.currency,
        isActive: p.isActive,
        isAvailable: p.isAvailable,
        unavailableUntil: p.unavailableUntil ?? null,
        thumbUrl: p.images[0] ? await ctx.storage.getUrl(p.images[0].thumbStorageId) : null,
      });
    }
    return rows;
  },
});

/** La fiche complète d'un produit. */
export const get = query({
  args: { venueId: v.id("venues"), productId: v.id("products") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.read", { venueId: args.venueId });
    const p = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    const images = [];
    for (const image of p.images) {
      images.push({ ...image, url: await ctx.storage.getUrl(image.thumbStorageId) });
    }
    const variants = await variantsOf(ctx, p._id);
    const links = await linksOf(ctx, p._id);
    const groups = [];
    for (const link of links) {
      const group = await ctx.db.get(link.modifierGroupId);
      if (group) groups.push({ _id: group._id, name: group.name, isRequired: link.overrideRequired ?? group.isRequired });
    }
    return {
      _id: p._id,
      menuSectionId: p.menuSectionId,
      name: p.name,
      description: p.description ?? null,
      i18n: p.i18n ?? null,
      basePrice: p.basePrice,
      promoPrice: p.promoPrice ?? null,
      promoEndsAt: p.promoEndsAt ?? null,
      currency: p.currency,
      tags: p.tags,
      allergens: p.allergens,
      dietary: p.dietary,
      prepMinutes: p.prepMinutes ?? null,
      isActive: p.isActive,
      isAvailable: p.isAvailable,
      unavailableUntil: p.unavailableUntil ?? null,
      images,
      variants: variants.map((variant) => ({
        _id: variant._id,
        name: variant.name,
        i18n: variant.i18n ?? null,
        price: variant.price ?? p.basePrice + (variant.priceDelta ?? 0),
        isDefault: variant.isDefault,
        isAvailable: variant.isAvailable,
      })),
      modifierGroups: groups,
      timezone: actor.venue.timezone,
      canEdit: actor.permissions.has("menu.edit"),
      canEditPrice: actor.permissions.has("menu.price.edit"),
    };
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Écriture
 * ──────────────────────────────────────────────────────────────────────────── */

/** Créer un produit FIXE un prix : `menu.edit` et `menu.price.edit` sont exigés tous deux. */
export const create = mutation({
  args: {
    venueId: v.id("venues"),
    menuSectionId: v.id("menuSections"),
    name: v.string(),
    description: v.optional(v.string()),
    basePrice: v.number(),
    i18n: i18nArg,
    tags: v.optional(v.array(v.string())),
    allergens: v.optional(v.array(v.string())),
    dietary: v.optional(dietaryArg),
    prepMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    requireAlso(actor, "menu.price.edit", "Créer un produit fixe son prix : il faut aussi le droit de modifier les prix.");
    if ((await countProducts(ctx, actor.venue._id)) >= MAX_PRODUCTS_PER_VENUE) {
      throw invalid(`Pas plus de ${MAX_PRODUCTS_PER_VENUE} produits par établissement.`);
    }
    const { venueId: _venueId, ...input } = args;
    const productId = await insertProduct(ctx, actor.venue, input);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "product.create",
      resourceType: "product",
      resourceId: productId,
      after: { name: args.name, basePrice: args.basePrice },
    });
    return productId;
  },
});

/** Tout sauf le prix et la disponibilité. */
export const update = mutation({
  args: {
    venueId: v.id("venues"),
    productId: v.id("products"),
    menuSectionId: v.optional(v.id("menuSections")),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    i18n: i18nArg,
    tags: v.optional(v.array(v.string())),
    allergens: v.optional(v.array(v.string())),
    dietary: v.optional(dietaryArg),
    prepMinutes: v.optional(v.union(v.number(), v.null())),
    relatedProductIds: v.optional(v.array(v.id("products"))),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const venueId = actor.venue._id;
    const product = await getInVenue(ctx, args.productId, venueId, "Ce produit");
    const patch: Partial<Doc<"products">> = {};
    if (args.menuSectionId !== undefined && args.menuSectionId !== product.menuSectionId) {
      const section = await getInVenue(ctx, args.menuSectionId, venueId, "Cette section");
      patch.menuSectionId = section._id;
      patch.sortOrder = await nextProductSort(ctx, venueId, section._id);
    }
    if (args.name !== undefined) patch.name = cleanName(args.name, "Le nom du produit");
    if (args.description !== undefined) patch.description = cleanDescription(args.description);
    if (args.i18n !== undefined) patch.i18n = cleanI18n(args.i18n);
    if (args.tags !== undefined) patch.tags = cleanTags(args.tags);
    if (args.allergens !== undefined) patch.allergens = cleanAllergens(args.allergens);
    if (args.dietary !== undefined) patch.dietary = cleanDietary(args.dietary);
    if (args.prepMinutes !== undefined) {
      if (args.prepMinutes !== null && (!Number.isInteger(args.prepMinutes) || args.prepMinutes < 0 || args.prepMinutes > 240)) {
        throw invalid("La durée de préparation va de 0 à 240 minutes.");
      }
      patch.prepMinutes = args.prepMinutes ?? undefined;
    }
    if (args.relatedProductIds !== undefined) {
      if (args.relatedProductIds.length > 6) throw invalid("Pas plus de 6 suggestions par produit.");
      for (const id of args.relatedProductIds) {
        if (id === product._id) throw invalid("Un produit ne se suggère pas lui-même.");
        await getInVenue(ctx, id, venueId, "Un des produits suggérés");
      }
      patch.relatedProductIds = [...new Set(args.relatedProductIds)];
    }
    await ctx.db.patch(product._id, patch);
  },
});

/**
 * Le prix, et seulement le prix. `promoPrice: null` retire la promotion. Audité : c'est la
 * seule façon d'expliquer plus tard pourquoi un prix était affiché ce jour-là.
 */
export const setPrice = mutation({
  args: {
    venueId: v.id("venues"),
    productId: v.id("products"),
    basePrice: v.number(),
    promoPrice: v.optional(v.union(v.number(), v.null())),
    promoEndsAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.price.edit", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    const basePrice = assertPrice(args.basePrice);
    const patch: Partial<Doc<"products">> = { basePrice };
    // La promotion en cours reste en place si on ne la touche pas : elle doit rester sous le prix.
    if (args.promoPrice === undefined && product.promoPrice !== undefined && product.promoPrice >= basePrice) {
      throw invalid("Ce prix passerait sous la promotion en cours : retirez ou baissez d'abord la promotion.");
    }
    if (args.promoPrice !== undefined) {
      if (args.promoPrice === null) {
        patch.promoPrice = undefined;
        patch.promoEndsAt = undefined;
      } else {
        const promo = assertPrice(args.promoPrice, "Le prix promotionnel");
        if (promo >= basePrice) throw invalid("Le prix promotionnel doit être inférieur au prix normal.");
        patch.promoPrice = promo;
        patch.promoEndsAt = args.promoEndsAt ?? undefined;
      }
    }
    const before = { basePrice: product.basePrice, promoPrice: product.promoPrice ?? null };
    await ctx.db.patch(product._id, patch);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "product.price.update",
      resourceType: "product",
      resourceId: product._id,
      before,
      after: { basePrice, promoPrice: patch.promoPrice ?? null },
    });
  },
});

/** Archiver (jamais supprimer) ou restaurer. */
export const setActive = mutation({
  args: { venueId: v.id("venues"), productId: v.id("products"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    if (product.isActive === args.isActive) return;
    await ctx.db.patch(product._id, { isActive: args.isActive });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: args.isActive ? "product.restore" : "product.archive",
      resourceType: "product",
      resourceId: product._id,
    });
  },
});

export const reorder = mutation({
  args: { venueId: v.id("venues"), menuSectionId: v.id("menuSections"), productIds: v.array(v.id("products")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const section = await getInVenue(ctx, args.menuSectionId, actor.venue._id, "Cette section");
    const products = await ctx.db
      .query("products")
      .withIndex("by_venue_section_sort", (q) => q.eq("venueId", actor.venue._id).eq("menuSectionId", section._id))
      .collect();
    assertSamePermutation(
      products.map((p) => p._id),
      args.productIds,
    );
    for (const [index, id] of args.productIds.entries()) await ctx.db.patch(id, { sortOrder: index });
  },
});

/**
 * Duplique un produit dans sa section, variantes et options comprises. Le prix recopié
 * est celui qu'une personne habilitée a déjà fixé : `menu.edit` suffit.
 */
export const duplicate = mutation({
  args: { venueId: v.id("venues"), productId: v.id("products") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const source = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    if ((await countProducts(ctx, actor.venue._id)) >= MAX_PRODUCTS_PER_VENUE) {
      throw invalid(`Pas plus de ${MAX_PRODUCTS_PER_VENUE} produits par établissement.`);
    }
    const copyName = `${source.name} (copie)`.slice(0, LIMITS.name);
    const productId = await insertProduct(ctx, actor.venue, {
      menuSectionId: source.menuSectionId,
      name: copyName,
      basePrice: source.basePrice,
      tags: source.tags,
      allergens: source.allergens,
      dietary: source.dietary,
      images: source.images,
      ...(source.description !== undefined ? { description: source.description } : {}),
      ...(source.i18n !== undefined ? { i18n: source.i18n } : {}),
      ...(source.prepMinutes !== undefined ? { prepMinutes: source.prepMinutes } : {}),
    });
    for (const variant of await variantsOf(ctx, source._id)) {
      const { _id, _creationTime, productId: _p, ...rest } = variant;
      await ctx.db.insert("productVariants", { ...rest, productId });
    }
    for (const link of await linksOf(ctx, source._id)) {
      const { _id, _creationTime, productId: _p, ...rest } = link;
      await ctx.db.insert("productModifierGroups", { ...rest, productId });
    }
    return productId;
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Variantes
 * ──────────────────────────────────────────────────────────────────────────── */

/** Une variante porte son PROPRE prix (33 cl : 1 000 F · 50 cl : 1 500 F). */
export const addVariant = mutation({
  args: { venueId: v.id("venues"), productId: v.id("products"), name: v.string(), price: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    requireAlso(actor, "menu.price.edit", "Une variante fixe un prix : il faut aussi le droit de modifier les prix.");
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    const variants = await variantsOf(ctx, product._id);
    if (variants.length >= LIMITS.variants) throw invalid(`Pas plus de ${LIMITS.variants} variantes par produit.`);
    return ctx.db.insert("productVariants", {
      venueId: actor.venue._id,
      productId: product._id,
      name: cleanName(args.name, "Le nom de la variante"),
      price: assertPrice(args.price),
      isDefault: variants.length === 0,
      isAvailable: true,
      sortOrder: variants.reduce((max, x) => Math.max(max, x.sortOrder + 1), 0),
    });
  },
});

export const updateVariant = mutation({
  args: {
    venueId: v.id("venues"),
    variantId: v.id("productVariants"),
    name: v.optional(v.string()),
    i18n: i18nArg,
    isDefault: v.optional(v.literal(true)),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const variant = await getInVenue(ctx, args.variantId, actor.venue._id, "Cette variante");
    const patch: Partial<Doc<"productVariants">> = {};
    if (args.name !== undefined) patch.name = cleanName(args.name, "Le nom de la variante");
    if (args.i18n !== undefined) patch.i18n = cleanI18n(args.i18n);
    if (args.isDefault) {
      // Une seule variante par défaut : c'est celle qu'ajoute le bouton « + » de la carte.
      for (const other of await variantsOf(ctx, variant.productId)) {
        if (other.isDefault && other._id !== variant._id) await ctx.db.patch(other._id, { isDefault: false });
      }
      patch.isDefault = true;
    }
    await ctx.db.patch(variant._id, patch);
  },
});

export const setVariantPrice = mutation({
  args: { venueId: v.id("venues"), variantId: v.id("productVariants"), price: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.price.edit", { venueId: args.venueId });
    const variant = await getInVenue(ctx, args.variantId, actor.venue._id, "Cette variante");
    const price = assertPrice(args.price);
    await ctx.db.patch(variant._id, { price, priceDelta: undefined });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "product.variant.price.update",
      resourceType: "productVariant",
      resourceId: variant._id,
      before: { price: variant.price ?? null },
      after: { price },
    });
  },
});

/**
 * Retire une variante. Une commande passée garde sa copie figée (R6) : la supprimer du
 * catalogue ne réécrit rien. La variante par défaut passe à la suivante.
 */
export const removeVariant = mutation({
  args: { venueId: v.id("venues"), variantId: v.id("productVariants") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const variant = await getInVenue(ctx, args.variantId, actor.venue._id, "Cette variante");
    await ctx.db.delete(variant._id);
    if (variant.isDefault) {
      const next = (await variantsOf(ctx, variant.productId))[0];
      if (next) await ctx.db.patch(next._id, { isDefault: true });
    }
  },
});

export const reorderVariants = mutation({
  args: { venueId: v.id("venues"), productId: v.id("products"), variantIds: v.array(v.id("productVariants")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    const variants = await variantsOf(ctx, product._id);
    assertSamePermutation(
      variants.map((x) => x._id),
      args.variantIds,
    );
    for (const [index, id] of args.variantIds.entries()) await ctx.db.patch(id, { sortOrder: index });
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * Options et photos
 * ──────────────────────────────────────────────────────────────────────────── */

/** Les groupes d'options du produit, dans l'ordre donné. Remplace la liste entière. */
export const setModifierGroups = mutation({
  args: { venueId: v.id("venues"), productId: v.id("products"), modifierGroupIds: v.array(v.id("modifierGroups")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    if (new Set(args.modifierGroupIds).size !== args.modifierGroupIds.length) {
      throw invalid("Un groupe d'options ne se rattache qu'une fois.");
    }
    if (args.modifierGroupIds.length > 8) throw invalid("Pas plus de 8 groupes d'options par produit.");
    for (const id of args.modifierGroupIds) await getInVenue(ctx, id, actor.venue._id, "Ce groupe d'options");
    for (const link of await linksOf(ctx, product._id)) await ctx.db.delete(link._id);
    for (const [index, modifierGroupId] of args.modifierGroupIds.entries()) {
      await ctx.db.insert("productModifierGroups", {
        venueId: actor.venue._id,
        productId: product._id,
        modifierGroupId,
        sortOrder: index,
      });
    }
  },
});

/** URL d'envoi d'une photo. L'envoi lui-même se fait du navigateur vers le stockage. */
export const generateUploadUrl = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Le fichier est-il une photo acceptable ? On lit ses PREMIERS OCTETS : le type déclaré à
 * l'envoi vient du navigateur, donc de l'expéditeur, et ne prouve rien.
 */
export function imageProblem(bytes: Uint8Array, maxBytes: number): string | null {
  const refuse = "Ce fichier n'est pas une photo acceptée (JPEG, WebP ou PNG, réduite avant l'envoi).";
  if (bytes.length === 0 || bytes.length > maxBytes) return refuse;
  const at = (i: number) => bytes[i] ?? -1;
  const ascii = (from: number, text: string) => [...text].every((c, i) => at(from + i) === c.charCodeAt(0));
  const jpeg = at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
  const png = at(0) === 0x89 && ascii(1, "PNG");
  const webp = ascii(0, "RIFF") && ascii(8, "WEBP");
  return jpeg || png || webp ? null : refuse;
}

/** Un fichier fraîchement envoyé : au-delà, ce n'est plus « la photo qu'on vient de choisir ». */
const FRESH_UPLOAD_MS = 60 * 60 * 1000;

/**
 * Les identifiants de fichier viennent du navigateur : rien ne dit qu'ils désignent la photo
 * qu'il vient d'envoyer. On n'accepte donc qu'un fichier RÉCENT et que AUCUN produit de
 * l'organisation n'utilise déjà — sinon on pourrait s'approprier, ou faire effacer par un
 * refus, la photo d'un autre plat, voire celle d'une carte en ligne.
 */
async function assertFreshUnusedFiles(ctx: ReadCtx, actor: VenueActor, ids: Id<"_storage">[]) {
  const now = Date.now();
  for (const id of ids) {
    const file = await ctx.db.system.get(id);
    if (!file || now - file._creationTime > FRESH_UPLOAD_MS) throw invalid("Cette photo n'a pas été envoyée à l'instant. Choisissez-la à nouveau.");
  }
  const venues = await ctx.db
    .query("venues")
    .withIndex("by_org", (q) => q.eq("organizationId", actor.organization._id))
    .collect();
  const wanted = new Set<string>(ids);
  for (const venue of venues) {
    const products = await ctx.db
      .query("products")
      .withIndex("by_venue_section_sort", (q) => q.eq("venueId", venue._id))
      .collect();
    for (const p of products) {
      if (p.images.some((image) => wanted.has(image.storageId) || wanted.has(image.thumbStorageId))) {
        throw invalid("Cette photo est déjà utilisée par un autre produit.");
      }
    }
  }
}

/** La garde de l'envoi, rejouée par l'action AVANT qu'elle touche un fichier. */
export const assertCanAttachImage = internalQuery({
  args: { venueId: v.id("venues"), productId: v.id("products"), storageId: v.id("_storage"), thumbStorageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    if (product.images.length >= LIMITS.images) throw invalid(`Pas plus de ${LIMITS.images} photos par produit.`);
    if (args.storageId === args.thumbStorageId) throw invalid("La photo et sa vignette sont deux fichiers distincts.");
    await assertFreshUnusedFiles(ctx, actor, [args.storageId, args.thumbStorageId]);
  },
});

export const recordImage = internalMutation({
  args: {
    venueId: v.id("venues"),
    productId: v.id("products"),
    storageId: v.id("_storage"),
    thumbStorageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    accepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    // Rejouée au moment d'écrire : entre la lecture et l'écriture, un autre envoi a pu les prendre.
    await assertFreshUnusedFiles(ctx, actor, [args.storageId, args.thumbStorageId]);
    if (!args.accepted) {
      // Un fichier refusé ne reste pas stocké : sinon l'envoi servirait à stocker n'importe quoi.
      for (const id of [args.storageId, args.thumbStorageId]) {
        if (await ctx.db.system.get(id)) await ctx.storage.delete(id);
      }
      return;
    }
    if (product.images.length >= LIMITS.images) throw invalid(`Pas plus de ${LIMITS.images} photos par produit.`);
    await ctx.db.patch(product._id, {
      images: [
        ...product.images,
        { storageId: args.storageId, thumbStorageId: args.thumbStorageId, width: args.width, height: args.height },
      ],
    });
  },
});

/**
 * Rattache une photo déjà envoyée (la photo réduite et sa vignette). Un fichier refusé est
 * EFFACÉ et le refus est RENVOYÉ, pas levé : une écriture qui lève est annulée, l'effacement
 * compris.
 */
export const addImage = action({
  args: {
    venueId: v.id("venues"),
    productId: v.id("products"),
    storageId: v.id("_storage"),
    thumbStorageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; message: string }> => {
    // garde : `assertCanAttachImage` s'exécute avec l'identité de l'appelant, AVANT toute
    // lecture de fichier ; `recordImage` rejoue la même garde au moment d'écrire.
    await ctx.runQuery(internal.products.assertCanAttachImage, {
      venueId: args.venueId,
      productId: args.productId,
      storageId: args.storageId,
      thumbStorageId: args.thumbStorageId,
    });
    for (const d of [args.width, args.height]) {
      if (!Number.isInteger(d) || d < 64 || d > 4096) throw invalid("Dimensions de photo invalides.");
    }
    const read = async (id: Id<"_storage">) => {
      const blob = await ctx.storage.get(id);
      return blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array();
    };
    const problem =
      imageProblem(await read(args.storageId), MAX_IMAGE_BYTES) ?? imageProblem(await read(args.thumbStorageId), MAX_THUMB_BYTES);
    await ctx.runMutation(internal.products.recordImage, { ...args, accepted: problem === null });
    return problem === null ? { ok: true } : { ok: false, message: problem };
  },
});

/**
 * Retire une photo du produit. Le fichier n'est PAS effacé : une publication en ligne peut
 * encore le montrer, et une publication ne se modifie pas.
 */
export const removeImage = mutation({
  args: { venueId: v.id("venues"), productId: v.id("products"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "menu.edit", { venueId: args.venueId });
    const product = await getInVenue(ctx, args.productId, actor.venue._id, "Ce produit");
    await ctx.db.patch(product._id, { images: product.images.filter((image) => image.storageId !== args.storageId) });
  },
});
