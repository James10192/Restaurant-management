/**
 * La tour de contrôle — Joliba (D-133, D-147)
 *
 * `/app/service` porte déjà les files du service (à servir, demandes, à valider, en cuisine).
 * Cette requête ajoute les alertes de gestion qui n'ont pas de file à elles, chacune calculée à
 * la lecture à partir des faits (D-134) et montrée seulement à qui peut faire le geste qu'elle
 * appelle. Liste fermée : ce qui n'appelle aucun geste pendant le service n'y entre pas.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { clockOf, countsInFigures, serviceDayOf } from "./lib/analytics";
import { dayWindow } from "./lib/serviceDay";
import { requireServiceActor } from "./lib/serviceActor";
import { memberName, settingsOf } from "./lib/service";

export const alerts = query({
  /** `at` : l'heure de l'écran, à la minute — une tablette allumée toute la nuit voit la caisse d'hier (D-048). */
  args: { venueId: v.id("venues"), at: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "order.read", { venueId: args.venueId });
    const venue = actor.venue;
    const can = (p: Parameters<typeof actor.permissions.has>[0]) => actor.permissions.has(p);

    // Une caisse appartient au jour où elle a été ouverte (D-085) : ouverte avant le début du
    // jour en cours, elle aurait dû être comptée hier.
    const staleCash = [];
    if (can("cash_register.close")) {
      const settings = await settingsOf(ctx, venue._id);
      const now = clockOf(args.at, Date.now(), 5 * 60_000);
      const { from } = await dayWindow(ctx, venue, serviceDayOf(now, venue, settings), settings);
      // Seulement une caisse OUVERTE : en comptage, quelqu'un s'en occupe déjà.
      const rows = await ctx.db
        .query("cashRegisterSessions")
        .withIndex("by_venue_status", (q) => q.eq("venueId", venue._id).eq("status", "open"))
        .collect();
      for (const s of rows) {
        if (s.openedAt >= from || !countsInFigures(s.isSimulation, venue)) continue;
        const register = s.cashRegisterId ? await ctx.db.get(s.cashRegisterId) : null;
        const holder = await memberName(ctx, s.holderMemberId);
        staleCash.push({ _id: s._id, name: holder ? `Pochette de ${holder}` : (register?.name ?? "Caisse"), openedAt: s.openedAt });
      }
    }

    // Un plat coupé sans heure de retour reste coupé jusqu'à ce que quelqu'un y pense.
    const soldOut = [];
    if (can("menu.availability.toggle")) {
      const products = await ctx.db
        .query("products")
        .withIndex("by_venue_active", (q) => q.eq("venueId", venue._id).eq("isActive", true))
        .collect();
      for (const p of products) if (!p.isAvailable && p.unavailableUntil === undefined) soldOut.push({ _id: p._id, name: p.name });
    }

    let paymentAlerts: number | null = null;
    if (can("payment.read")) {
      paymentAlerts = (
        await ctx.db
          .query("paymentAlerts")
          .withIndex("by_venue_open", (q) => q.eq("venueId", venue._id).eq("resolvedAt", undefined))
          .take(100)
      ).length;
    }

    return { staleCash, soldOut: soldOut.sort((a, b) => a.name.localeCompare(b.name)), paymentAlerts };
  },
});
