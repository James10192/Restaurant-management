/**
 * Carte côté client — Joliba
 *
 * Assemble ce que voit le client : les PUBLICATIONS en ligne (jamais le brouillon, R22),
 * leurs photos résolues en adresses, et l'état de disponibilité en direct. La disponibilité
 * n'est pas CALCULÉE ici : les requêtes Convex ne lisent pas l'heure (voir `availability.ts`).
 * On renvoie les faits — interrupteurs, échéances, plages — et le rendu les applique.
 *
 * Lecture sur le chemin le plus chaud du produit : quatre lectures d'index par établissement
 * pour la disponibilité, quelle que soit la taille de la carte.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { ReadCtx } from "./guards";
import type { MenuSnapshot, SnapshotProduct } from "./menuSnapshot";
import { HEX_PATTERN } from "./brandTheme";

export type GuestImage = { url: string | null; thumbUrl: string | null; width: number; height: number };
export type GuestProduct = Omit<SnapshotProduct, "images"> & { images: GuestImage[] };
export type GuestMenu = Omit<MenuSnapshot, "sections"> & {
  publicationId: Id<"menuPublications">;
  version: number;
  publishedAt: number;
  sections: Array<Omit<MenuSnapshot["sections"][number], "products"> & { products: GuestProduct[] }>;
};

export type LiveRule = {
  targetType: "product" | "section" | "menu";
  targetId: string;
  ruleType: "available" | "unavailable";
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  effectiveFrom?: number;
  effectiveTo?: number;
};

export type LiveAvailability = {
  /** Seulement les produits NON disponibles par interrupteur : la liste reste courte. */
  products: Record<string, { unavailableUntil: number | null }>;
  variants: string[];
  options: string[];
  rules: LiveRule[];
};

/** Les cartes en ligne de l'établissement, dans l'ordre publié. */
export async function loadPublishedMenus(ctx: ReadCtx, venueId: Id<"venues">): Promise<GuestMenu[]> {
  const publications = await ctx.db
    .query("menuPublications")
    .withIndex("by_venue_current", (q) => q.eq("venueId", venueId).eq("isCurrent", true))
    .collect();
  const menus: GuestMenu[] = [];
  for (const publication of publications) {
    const menu = await ctx.db.get(publication.menuId);
    if (!menu || menu.status === "archived") continue;
    const snapshot = publication.snapshot as MenuSnapshot;
    const sections = [];
    for (const section of snapshot.sections) {
      const products: GuestProduct[] = [];
      for (const product of section.products) {
        const images: GuestImage[] = [];
        for (const image of product.images) {
          images.push({
            url: await ctx.storage.getUrl(image.storageId as Id<"_storage">),
            thumbUrl: await ctx.storage.getUrl(image.thumbStorageId as Id<"_storage">),
            width: image.width,
            height: image.height,
          });
        }
        products.push({ ...product, images });
      }
      if (products.length > 0) sections.push({ ...section, products });
    }
    menus.push({
      ...snapshot,
      publicationId: publication._id,
      version: publication.version,
      publishedAt: publication.publishedAt,
      sections,
    });
  }
  return menus.sort((a, b) => a.menu.sortOrder - b.menu.sortOrder);
}

/**
 * Les FAITS de la porte de qualité (`indexability.ts`), lus sans résoudre une seule photo :
 * le plan du site parcourt tous les établissements consentants.
 */
export async function publishedFacts(ctx: ReadCtx, venue: Doc<"venues">) {
  const publications = await ctx.db
    .query("menuPublications")
    .withIndex("by_venue_current", (q) => q.eq("venueId", venue._id).eq("isCurrent", true))
    .collect();
  let productCount = 0;
  let describedCount = 0;
  let lastPublishedAt: number | null = null;
  for (const publication of publications) {
    const menu = await ctx.db.get(publication.menuId);
    if (!menu || menu.status === "archived") continue;
    for (const section of (publication.snapshot as MenuSnapshot).sections) {
      for (const product of section.products) {
        productCount++;
        if ((product.description ?? "").trim().length > 0) describedCount++;
      }
    }
    lastPublishedAt = lastPublishedAt === null ? publication.publishedAt : Math.max(lastPublishedAt, publication.publishedAt);
  }
  return {
    publicMenuEnabled: venue.publicMenuEnabled,
    productCount,
    describedCount,
    hasAddress: Boolean(venue.address?.line1 || venue.address?.landmark),
    hasOpeningHours: (venue.openingHours ?? []).length > 0,
    descriptionLength: (venue.description ?? "").trim().length,
    lastPublishedAt,
  };
}

export async function loadLiveAvailability(ctx: ReadCtx, venueId: Id<"venues">): Promise<LiveAvailability> {
  const products = await ctx.db
    .query("products")
    .withIndex("by_venue_active", (q) => q.eq("venueId", venueId).eq("isActive", true))
    .collect();
  const variants = await ctx.db
    .query("productVariants")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .collect();
  const options = await ctx.db
    .query("modifierOptions")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .collect();
  const rules = await ctx.db
    .query("availabilityRules")
    .withIndex("by_venue_active", (q) => q.eq("venueId", venueId).eq("isActive", true))
    .collect();
  const unavailable: LiveAvailability["products"] = {};
  for (const p of products) if (!p.isAvailable) unavailable[p._id] = { unavailableUntil: p.unavailableUntil ?? null };
  return {
    products: unavailable,
    variants: variants.filter((x) => !x.isAvailable).map((x) => x._id),
    options: options.filter((x) => !x.isAvailable).map((x) => x._id),
    rules: rules.map((r) => ({
      targetType: r.targetType,
      targetId: r.targetId,
      ruleType: r.ruleType,
      daysOfWeek: r.daysOfWeek,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
      ...(r.effectiveFrom !== undefined ? { effectiveFrom: r.effectiveFrom } : {}),
      ...(r.effectiveTo !== undefined ? { effectiveTo: r.effectiveTo } : {}),
    })),
  };
}

/**
 * L'apparence que la carte applique : la couleur DÉJÀ résolue (jamais la saisie brute, D-152)
 * et le logo. `primary` nul : la carte garde la couleur Joliba de la feuille de style.
 */
export type PublicBrand = {
  primary: string | null;
  logo: { url: string; width: number; height: number } | null;
};

export async function publicBrand(ctx: ReadCtx, venueId: Id<"venues">): Promise<PublicBrand> {
  const settings = await ctx.db
    .query("venueSettings")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .unique();
  const branding = settings?.branding;
  const primary = branding?.resolvedPrimary !== undefined && HEX_PATTERN.test(branding.resolvedPrimary) ? branding.resolvedPrimary : null;
  const logoUrl = branding?.logo ? await ctx.storage.getUrl(branding.logo.storageId) : null;
  return {
    primary,
    logo: branding?.logo && logoUrl ? { url: logoUrl, width: branding.logo.width, height: branding.logo.height } : null,
  };
}

/** Ce que l'en-tête de carte peut montrer de l'établissement. Rien d'interne. */
export async function publicVenue(ctx: ReadCtx, venue: Doc<"venues">) {
  return {
    brand: await publicBrand(ctx, venue._id),
    _id: venue._id,
    name: venue.name,
    slug: venue.slug,
    venueType: venue.venueType,
    timezone: venue.timezone,
    currency: venue.currency,
    locales: venue.locales,
    phone: venue.phone ?? null,
    description: venue.description ?? null,
    address: venue.address ?? null,
    openingHours: venue.openingHours ?? null,
  };
}

export type PublicVenue = Awaited<ReturnType<typeof publicVenue>>;
