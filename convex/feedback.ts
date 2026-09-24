/**
 * Les avis des clients, côté gérant — Joliba (T4, D-105)
 *
 * Laissés après le repas par un convive de la tablée, une fois, sans coordonnées. Lus ici, les
 * notes basses d'abord : c'est là qu'il y a quelque chose à comprendre.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getInVenue } from "./lib/catalogAccess";
import { requirePermission } from "./lib/guards";

export const list = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "feedback.read", { venueId: args.venueId });
    const since = Date.now() - 90 * 24 * 3_600_000;
    const rows = await ctx.db
      .query("feedback")
      .withIndex("by_venue_createdAt", (q) => q.eq("venueId", actor.venue._id).gte("createdAt", since))
      .order("desc")
      .take(200);
    const result = [];
    for (const f of rows) {
      const session = f.tableSessionId ? await ctx.db.get(f.tableSessionId) : null;
      const table = session ? await ctx.db.get(session.tableId) : null;
      result.push({
        _id: f._id,
        rating: f.rating,
        comment: f.comment ?? null,
        topics: f.topics,
        status: f.status,
        createdAt: f.createdAt,
        table: table?.number ?? null,
        reference: session?.reference ?? null,
      });
    }
    // Les notes basses d'abord, puis les plus récentes.
    result.sort((a, b) => a.rating - b.rating || b.createdAt - a.createdAt);
    const count = rows.length;
    return {
      items: result,
      count,
      average: count === 0 ? null : Math.round((rows.reduce((s, f) => s + f.rating, 0) / count) * 10) / 10,
      unseen: rows.filter((f) => f.status === "new").length,
    };
  },
});

/** Lu : l'avis quitte la pile des nouveaux. */
export const markSeen = mutation({
  args: { venueId: v.id("venues"), feedbackId: v.id("feedback") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "feedback.read", { venueId: args.venueId });
    const row = await getInVenue(ctx, args.feedbackId, actor.venue._id, "Cet avis");
    if (row.status === "new") await ctx.db.patch(row._id, { status: "seen" });
  },
});
