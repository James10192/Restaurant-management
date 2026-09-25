/**
 * Restaurant de démonstration — Joliba, DÉVELOPPEMENT UNIQUEMENT
 *
 * Sert à mesurer la carte client sur une carte réaliste (40 plats, photos, variantes,
 * options, ruptures) et à rejouer le parcours de scan sans passer par l'écran. Fonctions
 * INTERNES : aucun navigateur ne peut les appeler, seulement `convex run` avec la clé
 * d'administration du déploiement.
 *
 * Double verrou : `JOLIBA_DEMO_SEED=1` doit être posé sur le déploiement, ce que seul
 * `scripts/e2e-env.sh` fait, et ce script refuse tout autre backend qu'un backend local
 * anonyme. Jamais en production.
 *
 * L'établissement est nommé « démo » et marqué `isSimulation` : ses chiffres n'entreront
 * dans aucune statistique réelle (ANALYTICS.md §3.4).
 */

import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { invalid } from "./lib/errors";
import { buildDraftSnapshot } from "./lib/menuSnapshot";
import { createVenueRecords } from "./organizations";
import { insertProduct } from "./products";
import { createQrCode } from "./qr";
import { ROLE_TEMPLATES } from "./lib/permissions";

function assertEnabled() {
  if (process.env.JOLIBA_DEMO_SEED !== "1") {
    throw invalid("Données de démonstration désactivées sur ce déploiement.");
  }
}

/** Des adresses de dépôt de fichiers, pour les photos générées par `scripts/seed-demo.mjs`. */
export const uploadUrls = internalMutation({
  args: { count: v.number() },
  handler: async (ctx, args) => {
    assertEnabled();
    if (!Number.isInteger(args.count) || args.count < 1 || args.count > 200) throw invalid("De 1 à 200 adresses.");
    const urls: string[] = [];
    for (let i = 0; i < args.count; i++) urls.push(await ctx.storage.generateUploadUrl());
    return urls;
  },
});

type DemoProduct = {
  name: string;
  en?: string;
  description?: string;
  descriptionEn?: string;
  price: number;
  allergens?: string[];
  vegetarian?: boolean;
  spicy?: boolean;
  variants?: { name: string; price: number }[];
  withSides?: boolean;
  soldOut?: boolean;
};

const MENU: { section: string; en: string; products: DemoProduct[] }[] = [
  {
    section: "Entrées",
    en: "Starters",
    products: [
      { name: "Alloco", en: "Fried plantain", description: "Banane plantain mûre frite, piment frais à part.", descriptionEn: "Fried ripe plantain, fresh chilli on the side.", price: 1000, vegetarian: true },
      { name: "Salade avocat", en: "Avocado salad", description: "Avocat, tomate, oignon rouge, vinaigrette citron vert.", price: 1500, vegetarian: true },
      { name: "Accras de poisson", description: "Beignets de poisson, sauce tomate pimentée.", price: 1500, allergens: ["poissons", "gluten", "oeufs"], spicy: true },
      { name: "Brochettes de foie", description: "Foie de bœuf mariné, oignons grillés.", price: 2000 },
      { name: "Soupe de poisson", description: "Bouillon clair, gingembre, citronnelle.", price: 2500, allergens: ["poissons"] },
      { name: "Gombo frit", description: "Gombos croustillants, sel de mer.", price: 1000, vegetarian: true },
    ],
  },
  {
    section: "Grillades",
    en: "Grills",
    products: [
      { name: "Poulet braisé", en: "Braised chicken", description: "Demi-poulet mariné au gingembre et à l'ail, braisé au feu de bois.", descriptionEn: "Half chicken marinated in ginger and garlic, wood-fire grilled.", price: 3500, withSides: true },
      { name: "Poisson braisé", en: "Grilled fish", description: "Carpe entière braisée, oignons et tomates.", price: 5000, allergens: ["poissons"], withSides: true, variants: [{ name: "Moyen", price: 4000 }, { name: "Grand", price: 5500 }] },
      { name: "Brochettes de bœuf", description: "Trois brochettes, marinade maison.", price: 3000, withSides: true },
      { name: "Côtelettes d'agneau", description: "Côtelettes grillées, herbes fraîches.", price: 6000, withSides: true },
      { name: "Choukouya", description: "Mouton grillé, oignons, piment, attiéké.", price: 4000, spicy: true },
      { name: "Porc au four", description: "Échine de porc rôtie, sauce piment.", price: 3500, spicy: true, withSides: true },
      { name: "Crevettes grillées", description: "Crevettes de mer, beurre citronné.", price: 7000, allergens: ["crustaces", "lait"], soldOut: true },
      { name: "Poulet bicyclette", description: "Poulet fermier entier, marinade pimentée.", price: 7500, spicy: true, withSides: true },
    ],
  },
  {
    section: "Plats",
    en: "Mains",
    products: [
      { name: "Garba", description: "Attiéké, thon frit, piment et oignon.", price: 1500, allergens: ["poissons"], spicy: true },
      { name: "Kedjenou de poulet", description: "Poulet mijoté à l'étouffée, légumes, attiéké ou riz.", price: 4000 },
      { name: "Sauce graine", description: "Sauce de noix de palme, viande ou poisson fumé, foutou.", price: 3500, allergens: ["poissons"] },
      { name: "Sauce arachide", description: "Pâte d'arachide, bœuf, riz blanc.", price: 3000, allergens: ["arachides"] },
      { name: "Foutou banane sauce claire", description: "Foutou de banane, sauce claire au poisson.", price: 3000, allergens: ["poissons"] },
      { name: "Riz gras", description: "Riz cuisiné à la tomate, légumes et viande.", price: 2500 },
      { name: "Placali sauce kopè", description: "Pâte de manioc, sauce gombo.", price: 2500 },
      { name: "Attiéké poisson", description: "Attiéké, poisson frit, crudités.", price: 3000, allergens: ["poissons"] },
      { name: "Spaghetti sautés", description: "Spaghetti, légumes, œuf.", price: 2000, allergens: ["gluten", "oeufs"], vegetarian: true },
      { name: "Omelette garnie", description: "Trois œufs, oignon, tomate, pain.", price: 1500, allergens: ["oeufs", "gluten"], vegetarian: true },
    ],
  },
  {
    section: "Accompagnements",
    en: "Sides",
    products: [
      { name: "Attiéké", price: 500, vegetarian: true },
      { name: "Riz blanc", price: 500, vegetarian: true },
      { name: "Frites", price: 1000, vegetarian: true },
      { name: "Foutou banane", price: 1000, vegetarian: true },
    ],
  },
  {
    section: "Desserts",
    en: "Desserts",
    products: [
      { name: "Dêguê", description: "Mil, lait caillé sucré.", price: 1000, allergens: ["lait"], vegetarian: true },
      { name: "Salade de fruits", description: "Fruits de saison.", price: 1500, vegetarian: true },
      { name: "Beignets sucrés", description: "Six beignets, sucre glace.", price: 1000, allergens: ["gluten", "oeufs"], vegetarian: true },
    ],
  },
  {
    section: "Boissons",
    en: "Drinks",
    products: [
      { name: "Bissap", en: "Hibiscus juice", description: "Hibiscus, menthe, fait maison.", price: 500, vegetarian: true, variants: [{ name: "33 cl", price: 500 }, { name: "1 L", price: 1500 }] },
      { name: "Gnamakoudji", en: "Ginger juice", description: "Gingembre, citron, fait maison.", price: 500, vegetarian: true },
      { name: "Jus de baobab", description: "Pain de singe, lait.", price: 700, allergens: ["lait"], vegetarian: true },
      { name: "Eau minérale", price: 500, variants: [{ name: "50 cl", price: 500 }, { name: "1,5 L", price: 1000 }] },
      { name: "Soda", price: 700 },
      { name: "Bière locale", description: "Bouteille 65 cl.", price: 1200, allergens: ["gluten"] },
      { name: "Café Touba", description: "Café épicé au poivre de Guinée.", price: 500 },
      { name: "Thé à la menthe", price: 500 },
      { name: "Vin rouge (verre)", price: 2500, allergens: ["sulfites"] },
    ],
  },
];

async function demoOwner(ctx: MutationCtx): Promise<Id<"users">> {
  const email = "demo@joliba.test";
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (existing) return existing._id;
  // Pas de compte d'authentification : ce profil ne peut pas se connecter, il signe les versions.
  return ctx.db.insert("users", { authId: "demo:seed", email, name: "Démonstration", locale: "fr", status: "active" });
}

export const demoRestaurant = internalMutation({
  args: {
    images: v.array(v.object({ storageId: v.id("_storage"), thumbStorageId: v.id("_storage"), width: v.number(), height: v.number() })),
  },
  handler: async (ctx, args) => {
    assertEnabled();
    const userId = await demoOwner(ctx);
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: "Démo Joliba",
      slug: `demo-${now.toString(36)}`,
      ownerUserId: userId,
      countryCode: "CI",
      defaultCurrency: "XOF",
      defaultLocale: "fr",
      status: "active",
    });
    const memberId = await ctx.db.insert("organizationMembers", { organizationId, userId, status: "active", joinedAt: now });
    for (const [key, template] of Object.entries(ROLE_TEMPLATES)) {
      const roleId = await ctx.db.insert("roles", { organizationId, key, label: template.label, permissions: [...template.permissions], isCustom: false });
      if (key === "owner") {
        await ctx.db.insert("memberRoleAssignments", { organizationId, memberId, roleId, scopeType: "organization", grantedByUserId: userId, grantedAt: now });
      }
    }
    const venueId = await createVenueRecords(ctx, { organizationId, name: "Maquis démo", venueType: "maquis", countryCode: "CI", city: "Abidjan" });
    await ctx.db.patch(venueId, {
      status: "active",
      isSimulation: true,
      publicMenuEnabled: true,
      locales: ["fr", "en"],
      phone: "+2250700000000",
      description:
        "Établissement de démonstration Joliba : un maquis de quartier, grillades au feu de bois, plats du jour et jus maison. Les données de cette page servent aux essais.",
      address: { city: "Abidjan", district: "Cocody", countryCode: "CI", landmark: "En face de la pharmacie de démonstration" },
      openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, opensAtMinute: 11 * 60, closesAtMinute: 23 * 60 + 30 })),
    });
    const venue = (await ctx.db.get(venueId))!;

    const menuId = await ctx.db.insert("menus", { venueId, name: "Carte", slug: "carte", status: "draft", sortOrder: 0 });
    const sides = await ctx.db.insert("modifierGroups", {
      venueId,
      name: "Accompagnement",
      i18n: { en: { name: "Side" } },
      selectionType: "single",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
    });
    for (const [index, name] of ["Attiéké", "Alloco", "Frites", "Riz"].entries()) {
      await ctx.db.insert("modifierOptions", { venueId, modifierGroupId: sides, name, priceDelta: index === 2 ? 500 : 0, isAvailable: true, sortOrder: index });
    }

    let photo = 0;
    for (const [sectionIndex, section] of MENU.entries()) {
      const menuSectionId = await ctx.db.insert("menuSections", {
        venueId,
        menuId,
        name: section.section,
        i18n: { en: { name: section.en } },
        sortOrder: sectionIndex,
        isActive: true,
      });
      for (const p of section.products) {
        // Les accompagnements et boissons n'ont pas de photo : la règle des 40 % s'en charge.
        const image = section.section !== "Accompagnements" && photo < args.images.length ? args.images[photo++] : undefined;
        const productId = await insertProduct(ctx, venue, {
          menuSectionId,
          name: p.name,
          basePrice: p.price,
          allergens: p.allergens ?? [],
          tags: [],
          dietary: { ...(p.vegetarian ? { vegetarian: true } : {}), ...(p.spicy ? { spicyLevel: 2 } : {}) },
          images: image ? [image] : [],
          ...(p.description ? { description: p.description } : {}),
          ...(p.en ? { i18n: { en: { name: p.en, ...(p.descriptionEn ? { description: p.descriptionEn } : {}) } } } : {}),
        });
        if (p.soldOut) await ctx.db.patch(productId, { isAvailable: false });
        for (const [index, variant] of (p.variants ?? []).entries()) {
          await ctx.db.insert("productVariants", { venueId, productId, name: variant.name, price: variant.price, isDefault: index === 0, isAvailable: true, sortOrder: index });
        }
        if (p.withSides) await ctx.db.insert("productModifierGroups", { venueId, productId, modifierGroupId: sides, sortOrder: 0 });
      }
    }

    const menu = (await ctx.db.get(menuId))!;
    const snapshot = await buildDraftSnapshot(ctx, menu, venue.currency);
    const publicationId = await ctx.db.insert("menuPublications", { venueId, menuId, version: 1, snapshot, publishedByUserId: userId, publishedAt: now, isCurrent: true });
    await ctx.db.patch(menuId, { status: "published", publishedVersionId: publicationId });

    const areaId = await ctx.db.insert("serviceAreas", { venueId, name: "Terrasse", sortOrder: 0, canvasWidth: 1200, canvasHeight: 800, isActive: true });
    const tableId = await ctx.db.insert("restaurantTables", {
      venueId,
      serviceAreaId: areaId,
      number: "12",
      seats: 4,
      shape: "square",
      x: 40,
      y: 40,
      width: 80,
      height: 80,
      status: "available",
      isActive: true,
    });
    const qrId = await createQrCode(ctx, venueId, tableId, userId, 1);
    const qr = (await ctx.db.get(qrId))!;
    return { venueSlug: venue.slug, token: qr.token };
  },
});

/**
 * Rattache un compte de test (déjà connecté une fois) au dernier restaurant de démonstration,
 * comme propriétaire, et complète la salle pour un essai de service : huit tables sur deux zones.
 * Réservé au backend local, comme le reste de ce fichier.
 */
export const joinDemo = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    assertEnabled();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (!user) throw invalid("Connectez-vous d'abord une fois avec cette adresse.");
    const organizations = (await ctx.db.query("organizations").collect()).filter((o) => o.slug.startsWith("demo-"));
    const organization = organizations.sort((a, b) => b._creationTime - a._creationTime)[0];
    if (!organization) throw invalid("Aucun restaurant de démonstration : lancez scripts/seed-demo.mjs.");
    const now = Date.now();
    const already = (
      await ctx.db
        .query("organizationMembers")
        .withIndex("by_org_status", (q) => q.eq("organizationId", organization._id))
        .collect()
    ).find((m) => m.userId === user._id);
    if (!already) {
      const memberId = await ctx.db.insert("organizationMembers", { organizationId: organization._id, userId: user._id, status: "active", joinedAt: now });
      const owner = (
        await ctx.db
          .query("roles")
          .withIndex("by_org_key", (q) => q.eq("organizationId", organization._id).eq("key", "owner"))
          .collect()
      )[0]!;
      await ctx.db.insert("memberRoleAssignments", {
        organizationId: organization._id,
        memberId,
        roleId: owner._id,
        scopeType: "organization",
        grantedByUserId: user._id,
        grantedAt: now,
      });
    }
    const venue = (
      await ctx.db
        .query("venues")
        .withIndex("by_org", (q) => q.eq("organizationId", organization._id))
        .collect()
    )[0]!;
    const areas = await ctx.db
      .query("serviceAreas")
      .withIndex("by_venue_sort", (q) => q.eq("venueId", venue._id))
      .collect();
    const tables = await ctx.db
      .query("restaurantTables")
      .withIndex("by_venue_number", (q) => q.eq("venueId", venue._id))
      .collect();
    if (tables.length < 2) {
      const terrace = areas[0]!._id;
      const room = await ctx.db.insert("serviceAreas", { venueId: venue._id, name: "Salle", sortOrder: 1, canvasWidth: 1200, canvasHeight: 800, isActive: true });
      const plan: [Id<"serviceAreas">, string, number][] = [
        [terrace, "10", 2],
        [terrace, "11", 4],
        [room, "1", 2],
        [room, "2", 4],
        [room, "3", 4],
        [room, "4", 6],
        [room, "5", 8],
      ];
      for (const [i, [serviceAreaId, number, seats]] of plan.entries()) {
        await ctx.db.insert("restaurantTables", {
          venueId: venue._id,
          serviceAreaId,
          number,
          seats,
          shape: "square",
          x: 40 + (i % 4) * 120,
          y: 160 + Math.floor(i / 4) * 120,
          width: 80,
          height: 80,
          status: "available",
          isActive: true,
        });
      }
    }
    return { organizationId: organization._id, venueId: venue._id, venueSlug: venue.slug };
  },
});

/**
 * Sort le dernier restaurant de démonstration du mode simulation. Le paiement en ligne n'est
 * jamais proposé sur une tablée de simulation (aucun vrai argent sur un essai) : l'essai de bout en bout de T5 en a besoin
 * pour aller jusqu'au faux Wave. Les tables ouvertes AVANT l'appel restent des simulations.
 * Réservé au backend local, comme le reste de ce fichier.
 */
export const leaveSimulation = internalMutation({
  args: {},
  handler: async (ctx) => {
    assertEnabled();
    const organizations = (await ctx.db.query("organizations").collect()).filter((o) => o.slug.startsWith("demo-"));
    const organization = organizations.sort((a, b) => b._creationTime - a._creationTime)[0];
    if (!organization) throw invalid("Aucun restaurant de démonstration : lancez scripts/seed-demo.mjs.");
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_org", (q) => q.eq("organizationId", organization._id))
      .collect();
    for (const venue of venues) await ctx.db.patch(venue._id, { isSimulation: false });
    return venues.length;
  },
});
