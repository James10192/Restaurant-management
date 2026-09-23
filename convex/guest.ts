/**
 * Surface client — Joliba
 *
 * Le client n'a pas de compte, jamais (PRODUCT.md §7.1). La garde n'est donc pas une
 * permission : c'est un JETON (le QR), puis un LAISSEZ-PASSER signé qui en est l'échange.
 * Chaque fonction ci-dessous dit, en commentaire `garde :`, ce qui la protège.
 *
 * En tranche T1, le scan ne crée PAS de session de table : il n'y a encore rien à commander,
 * et une session ouverte que personne ne ferme marquerait la table « occupée » pour rien. Le
 * laissez-passer désigne une table ; la tranche T2 y ajoutera l'ouverture de session (D-045).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { GUEST_PASS_TTL_MS, signGuestPass, verifyGuestPass } from "./lib/guestPass";
import { loadLiveAvailability, loadPublishedMenus, publicVenue, publishedFacts } from "./lib/guestMenu";

type ExchangeFailure = "invalid" | "table_closed" | "venue_closed";

/**
 * Échange un jeton de QR contre un laissez-passer. Appelée par le serveur web, qui dépose le
 * résultat en cookie `httpOnly` puis redirige vers une adresse sans secret.
 */
export const exchange = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; pass: string; venueSlug: string } | { ok: false; reason: ExchangeFailure; venueSlug: string | null }> => {
    // garde : jeton — 128 bits d'aléa, cherché par égalité exacte. Sans jeton actif, rien
    // n'est renvoyé, pas même l'établissement.
    if (args.token.length < 16 || args.token.length > 64) return { ok: false, reason: "invalid", venueSlug: null };
    const code = await ctx.db
      .query("tableQrCodes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!code) return { ok: false, reason: "invalid", venueSlug: null };
    const venue = await ctx.db.get(code.venueId);
    // Un QR révoqué dit seulement « plus valide » ; il peut renvoyer vers la carte publique.
    if (!venue || venue.status === "archived") return { ok: false, reason: "invalid", venueSlug: null };
    if (code.status !== "active") return { ok: false, reason: "invalid", venueSlug: venue.slug };
    if (venue.status === "paused") return { ok: false, reason: "venue_closed", venueSlug: venue.slug };
    const table = await ctx.db.get(code.tableId);
    if (!table || !table.isActive || table.status === "out_of_service") {
      return { ok: false, reason: "table_closed", venueSlug: venue.slug };
    }
    const now = Date.now();
    // Alimente la détection d'anomalie (un QR scanné deux cents fois ailleurs) sans rien
    // changer pour le client.
    await ctx.db.patch(code._id, { scanCount: code.scanCount + 1, lastScannedAt: now });
    const pass = await signGuestPass({
      venueId: venue._id,
      tableId: table._id,
      qrCodeId: code._id,
      qrVersion: code.version,
      expiresAt: now + GUEST_PASS_TTL_MS,
    });
    return { ok: true, pass, venueSlug: venue.slug };
  },
});

/**
 * La carte d'une table. Le laissez-passer est revérifié à CHAQUE lecture, avec l'état du QR
 * qui l'a émis : un QR révoqué ferme aussitôt la carte de ceux qu'il avait fait entrer.
 */
export const tableMenu = query({
  args: { pass: v.string(), venueSlug: v.string() },
  handler: async (ctx, args) => {
    // garde : laissez-passer signé par Convex, revérifié contre le QR, la table et
    // l'établissement. Un laissez-passer d'un autre établissement que celui de l'adresse
    // est refusé : l'adresse ne choisit pas la carte.
    const payload = await verifyGuestPass(args.pass, Date.now());
    if (!payload) return null;
    const code = await ctx.db.get(payload.qrCodeId);
    if (!code || code.status !== "active" || code.version !== payload.qrVersion || code.tableId !== payload.tableId) return null;
    const venue = await ctx.db.get(payload.venueId);
    if (!venue || venue._id !== code.venueId || venue.slug !== args.venueSlug) return null;
    if (venue.status === "archived" || venue.status === "paused") return null;
    const table = await ctx.db.get(payload.tableId);
    if (!table || !table.isActive || table.status === "out_of_service") return null;
    return {
      venue: publicVenue(venue),
      table: { number: table.number, label: table.label ?? null },
      menus: await loadPublishedMenus(ctx, venue._id),
      live: await loadLiveAvailability(ctx, venue._id),
    };
  },
});

/**
 * La carte publique d'un établissement, pour qui la cherche avant de venir. 404 si le
 * restaurant n'y a pas consenti — et non 403 : son existence n'a pas à être confirmée.
 */
export const publicMenu = query({
  args: { venueSlug: v.string() },
  handler: async (ctx, args) => {
    // garde : consentement explicite de l'établissement (`publicMenuEnabled`), jamais par
    // défaut. Sans lui, la réponse est la même que pour un établissement inexistant.
    const venue = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", args.venueSlug))
      .unique();
    if (!venue || !venue.publicMenuEnabled || venue.status === "archived") return null;
    const menus = await loadPublishedMenus(ctx, venue._id);
    if (menus.length === 0) return null;
    return { venue: publicVenue(venue), menus, live: await loadLiveAvailability(ctx, venue._id) };
  },
});

/**
 * L'état de disponibilité en direct, auquel la carte ouverte s'abonne : quand la cuisine
 * bascule un plat, la carte du client change sous ses yeux.
 */
export const availability = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    // garde : lecture publique, et c'est voulu — elle ne renvoie que des identifiants de
    // produits indisponibles et des plages horaires, sans nom, sans prix, sans rien qui
    // décrive l'établissement. Qui ne connaît pas la carte n'en tire rien.
    const venue = await ctx.db.get(args.venueId);
    if (!venue || venue.status === "archived") return null;
    return loadLiveAvailability(ctx, venue._id);
  },
});

/**
 * Les cartes publiques candidates au plan du site, avec les faits de la porte de qualité.
 * Le serveur web applique la porte avec l'heure courante : n'y figurent que les pages qui
 * la franchissent.
 */
export const sitemap = query({
  args: {},
  handler: async (ctx) => {
    // garde : lecture publique voulue — ne liste que les établissements qui ont consenti à
    // publier leur carte, et seulement ce que leur page publique montre déjà.
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_public_menu", (q) => q.eq("publicMenuEnabled", true))
      .take(5000);
    const entries = [];
    for (const venue of venues) {
      if (venue.status === "archived") continue;
      const facts = await publishedFacts(ctx, venue);
      if (facts.productCount > 0) entries.push({ slug: venue.slug, facts });
    }
    return entries;
  },
});
