/**
 * Instantané de carte — Joliba
 *
 * Une publication FIGE ce que le client voit : noms, descriptions, prix, photos, options,
 * plage horaire de la carte (R22). Elle ne fige PAS la disponibilité : « plus de poisson ce
 * soir » est un geste de service, pas une nouvelle version de la carte (R23). La
 * disponibilité est lue en direct et appliquée par-dessus l'instantané.
 *
 * `diffSnapshots` compare deux instantanés et répond à la seule question de l'écran de
 * tête : « qu'est-ce qui n'est pas encore en ligne ? ».
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { ReadCtx } from "./guards";

export const SNAPSHOT_SCHEMA = 1;
/** Un document Convex plafonne à 1 Mo : on garde une marge pour les champs voisins. */
export const MAX_SNAPSHOT_BYTES = 900_000;

type I18n = Record<string, { name?: string; description?: string }>;

export type SnapshotOption = { id: string; name: string; i18n?: I18n; priceDelta: number };
export type SnapshotModifierGroup = {
  id: string;
  name: string;
  i18n?: I18n;
  selectionType: "single" | "multiple";
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: SnapshotOption[];
};
export type SnapshotVariant = { id: string; name: string; i18n?: I18n; price: number; isDefault: boolean };
export type SnapshotImage = { storageId: string; thumbStorageId: string; width: number; height: number };
export type SnapshotProduct = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  i18n?: I18n;
  basePrice: number;
  promoPrice?: number;
  promoEndsAt?: number;
  images: SnapshotImage[];
  tags: string[];
  allergens: string[];
  dietary: { vegetarian?: boolean; vegan?: boolean; halal?: boolean; spicyLevel?: number };
  relatedProductIds: string[];
  variants: SnapshotVariant[];
  modifierGroups: SnapshotModifierGroup[];
};
export type SnapshotSection = { id: string; name: string; description?: string; i18n?: I18n; products: SnapshotProduct[] };
export type MenuSnapshot = {
  schema: typeof SNAPSHOT_SCHEMA;
  menu: {
    id: string;
    name: string;
    sortOrder: number;
    activeSchedule: { daysOfWeek: number[]; startMinute: number; endMinute: number } | null;
  };
  currency: string;
  sections: SnapshotSection[];
};

function opt<K extends string, T>(key: K, value: T | undefined): { [P in K]?: T } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: T };
}

/** L'état ACTUEL du brouillon, sous la forme d'une publication. Sections et produits archivés exclus. */
export async function buildDraftSnapshot(ctx: ReadCtx, menu: Doc<"menus">, currency: string): Promise<MenuSnapshot> {
  const sections = await ctx.db
    .query("menuSections")
    .withIndex("by_menu_sort", (q) => q.eq("menuId", menu._id))
    .collect();
  const groupCache = new Map<Id<"modifierGroups">, SnapshotModifierGroup | null>();
  const loadGroup = async (id: Id<"modifierGroups">) => {
    if (groupCache.has(id)) return groupCache.get(id)!;
    const group = await ctx.db.get(id);
    let snap: SnapshotModifierGroup | null = null;
    if (group) {
      const options = await ctx.db
        .query("modifierOptions")
        .withIndex("by_group_sort", (q) => q.eq("modifierGroupId", id))
        .collect();
      snap = {
        id: group._id,
        name: group.name,
        ...opt("i18n", group.i18n),
        selectionType: group.selectionType,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        isRequired: group.isRequired,
        options: options.map((o) => ({ id: o._id, name: o.name, ...opt("i18n", o.i18n), priceDelta: o.priceDelta })),
      };
    }
    groupCache.set(id, snap);
    return snap;
  };

  const out: SnapshotSection[] = [];
  for (const section of sections) {
    if (!section.isActive) continue;
    const products = await ctx.db
      .query("products")
      .withIndex("by_venue_section_sort", (q) => q.eq("venueId", menu.venueId).eq("menuSectionId", section._id))
      .collect();
    const snapProducts: SnapshotProduct[] = [];
    for (const p of products) {
      if (!p.isActive) continue;
      const variants = await ctx.db
        .query("productVariants")
        .withIndex("by_product_sort", (q) => q.eq("productId", p._id))
        .collect();
      const links = await ctx.db
        .query("productModifierGroups")
        .withIndex("by_product_sort", (q) => q.eq("productId", p._id))
        .collect();
      const groups: SnapshotModifierGroup[] = [];
      for (const link of links) {
        const group = await loadGroup(link.modifierGroupId);
        if (!group) continue;
        groups.push(link.overrideRequired === undefined ? group : { ...group, isRequired: link.overrideRequired });
      }
      snapProducts.push({
        id: p._id,
        name: p.name,
        slug: p.slug,
        ...opt("description", p.description),
        ...opt("i18n", p.i18n),
        basePrice: p.basePrice,
        ...opt("promoPrice", p.promoPrice),
        ...opt("promoEndsAt", p.promoEndsAt),
        images: p.images.map((i) => ({ storageId: i.storageId, thumbStorageId: i.thumbStorageId, width: i.width, height: i.height })),
        tags: p.tags,
        allergens: p.allergens,
        dietary: p.dietary,
        relatedProductIds: p.relatedProductIds,
        variants: variants.map((x) => ({
          id: x._id,
          name: x.name,
          ...opt("i18n", x.i18n),
          price: x.price ?? p.basePrice + (x.priceDelta ?? 0),
          isDefault: x.isDefault,
        })),
        modifierGroups: groups,
      });
    }
    out.push({
      id: section._id,
      name: section.name,
      ...opt("description", section.description),
      ...opt("i18n", section.i18n),
      products: snapProducts,
    });
  }
  return {
    schema: SNAPSHOT_SCHEMA,
    menu: { id: menu._id, name: menu.name, sortOrder: menu.sortOrder, activeSchedule: menu.activeSchedule ?? null },
    currency,
    sections: out,
  };
}

export function snapshotSize(snapshot: MenuSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}

export function countProducts(snapshot: MenuSnapshot): number {
  return snapshot.sections.reduce((n, s) => n + s.products.length, 0);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Écart entre deux versions
 * ──────────────────────────────────────────────────────────────────────────── */

export type SnapshotChange = {
  kind: "added" | "removed" | "changed" | "moved";
  entity: "menu" | "section" | "product";
  name: string;
  /** Ce qui a changé, en mots : « prix », « description », « photos »… */
  fields: string[];
};

/** Stable, indépendant de l'ordre des clés : deux objets égaux donnent la même chaîne. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/**
 * Les éléments dont la place RELATIVE a changé. On ne compare que les éléments présents des
 * deux côtés : un plat ajouté en tête ne fait pas « bouger » tous ceux qui le suivent.
 */
function reordered(before: readonly string[], after: readonly string[]): Set<string> {
  const common = new Set(before.filter((id) => after.includes(id)));
  const a = before.filter((id) => common.has(id));
  const b = after.filter((id) => common.has(id));
  return new Set(b.filter((id, i) => a[i] !== id));
}

const PRODUCT_FIELDS: Array<[keyof SnapshotProduct, string]> = [
  ["name", "nom"],
  ["description", "description"],
  ["i18n", "traduction"],
  ["basePrice", "prix"],
  ["promoPrice", "promotion"],
  ["promoEndsAt", "promotion"],
  ["images", "photos"],
  ["tags", "étiquettes"],
  ["allergens", "allergènes"],
  ["dietary", "régimes"],
  ["relatedProductIds", "suggestions"],
  ["variants", "variantes"],
  ["modifierGroups", "options"],
];

/**
 * Ce qui diffère entre `published` (en ligne) et `draft` (en cours). `published` absent :
 * tout est nouveau. L'ordre des sections et des produits compte — le client le voit.
 */
export function diffSnapshots(published: MenuSnapshot | null, draft: MenuSnapshot): SnapshotChange[] {
  const changes: SnapshotChange[] = [];
  if (!published) {
    changes.push({ kind: "added", entity: "menu", name: draft.menu.name, fields: [] });
    return changes;
  }
  const menuFields: string[] = [];
  if (published.menu.name !== draft.menu.name) menuFields.push("nom");
  if (published.menu.sortOrder !== draft.menu.sortOrder) menuFields.push("ordre");
  if (!same(published.menu.activeSchedule, draft.menu.activeSchedule)) menuFields.push("horaires");
  if (menuFields.length > 0) changes.push({ kind: "changed", entity: "menu", name: draft.menu.name, fields: menuFields });

  const oldSections = new Map(published.sections.map((s) => [s.id, { s }]));
  const newSections = new Map(draft.sections.map((s) => [s.id, { s }]));
  const oldProducts = new Map(published.sections.flatMap((s) => s.products.map((p) => [p.id, { p, sectionId: s.id }] as const)));
  const newProducts = new Map(draft.sections.flatMap((s) => s.products.map((p) => [p.id, { p, sectionId: s.id }] as const)));
  const movedSections = reordered(
    published.sections.map((s) => s.id),
    draft.sections.map((s) => s.id),
  );
  const movedProducts = new Set<string>();
  for (const section of draft.sections) {
    const before = published.sections.find((s) => s.id === section.id);
    if (!before) continue;
    for (const id of reordered(
      before.products.map((p) => p.id),
      section.products.map((p) => p.id),
    )) {
      movedProducts.add(id);
    }
  }

  for (const [id, { s }] of newSections) {
    const before = oldSections.get(id);
    if (!before) {
      changes.push({ kind: "added", entity: "section", name: s.name, fields: [] });
      continue;
    }
    const fields: string[] = [];
    if (before.s.name !== s.name) fields.push("nom");
    if (before.s.description !== s.description) fields.push("description");
    if (!same(before.s.i18n, s.i18n)) fields.push("traduction");
    if (fields.length > 0) changes.push({ kind: "changed", entity: "section", name: s.name, fields });
    else if (movedSections.has(id)) changes.push({ kind: "moved", entity: "section", name: s.name, fields: ["ordre"] });
  }
  for (const [id, { s }] of oldSections) {
    if (!newSections.has(id)) changes.push({ kind: "removed", entity: "section", name: s.name, fields: [] });
  }

  for (const [id, { p, sectionId }] of newProducts) {
    const before = oldProducts.get(id);
    if (!before) {
      changes.push({ kind: "added", entity: "product", name: p.name, fields: [] });
      continue;
    }
    const fields = [...new Set(PRODUCT_FIELDS.filter(([key]) => !same(before.p[key], p[key])).map(([, label]) => label))];
    if (fields.length > 0) changes.push({ kind: "changed", entity: "product", name: p.name, fields });
    else if (before.sectionId !== sectionId || movedProducts.has(id)) {
      changes.push({ kind: "moved", entity: "product", name: p.name, fields: [before.sectionId !== sectionId ? "section" : "ordre"] });
    }
  }
  for (const [id, { p }] of oldProducts) {
    if (!newProducts.has(id)) changes.push({ kind: "removed", entity: "product", name: p.name, fields: [] });
  }
  return changes;
}

/** Tout ce qui fait le prix d'un plat, sous une forme comparable. */
function priceSignature(p: SnapshotProduct): string {
  return canonical({
    base: p.basePrice,
    promo: p.promoPrice ?? null,
    promoEndsAt: p.promoEndsAt ?? null,
    variants: p.variants.map((v) => [v.id, v.price]),
    options: p.modifierGroups.flatMap((g) => g.options.map((o) => [o.id, o.priceDelta])),
  });
}

/**
 * Les plats de `next` dont le prix n'est pas celui qu'affiche `current` (ou qui n'y figurent
 * pas). Remettre en ligne une ancienne version, c'est remettre ses prix : un acte financier.
 */
export function pricedDifferently(current: MenuSnapshot | null, next: MenuSnapshot): string[] {
  const online = new Map((current?.sections ?? []).flatMap((s) => s.products.map((p) => [p.id, priceSignature(p)] as const)));
  return next.sections.flatMap((s) => s.products.filter((p) => online.get(p.id) !== priceSignature(p)).map((p) => p.name));
}
