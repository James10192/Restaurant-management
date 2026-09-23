/**
 * Écran de production — Joliba
 *
 * Une tablette par poste lit `board` en continu : c'est la requête la plus sollicitée du
 * produit, d'où l'index `by_station_status_queued` et zéro jointure au-delà des lignes du bon.
 * Les gestes passent tous par `advanceTicket` (convex/lib/service.ts) : démarrer, prêt, rappel.
 * « Servi » appartient à la salle (`orders.serveTicket`), pas à la cuisine.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getInVenue } from "./lib/catalogAccess";
import { invalid, notFound } from "./lib/errors";
import type { ReadCtx } from "./lib/guards";
import { requireServiceActor, requireServiceMutation } from "./lib/serviceActor";
import type { TicketStatus } from "./lib/ordering";
import { advanceTicket } from "./lib/service";

/** Ce que la cuisine a encore en main, dans l'ordre où elle doit le traiter. */
const IN_KITCHEN: readonly TicketStatus[] = ["recalled", "queued", "started"];

/** Combien de bons prêts rester à l'écran : de quoi rappeler une erreur, pas un historique. */
export const READY_KEPT = 8;

async function ticketsIn(ctx: ReadCtx, station: Doc<"prepStations">, status: TicketStatus) {
  return ctx.db
    .query("kitchenTickets")
    .withIndex("by_station_status_queued", (q) => q.eq("prepStationId", station._id).eq("status", status))
    .collect();
}

async function linesOf(ctx: ReadCtx, ticket: Doc<"kitchenTickets">) {
  const items = await ctx.db
    .query("kitchenTicketItems")
    .withIndex("by_ticket", (q) => q.eq("kitchenTicketId", ticket._id))
    .collect();
  return items.map((i) => ({
    _id: i._id,
    name: i.nameSnapshot,
    variantName: i.variantNameSnapshot ?? null,
    modifiers: i.modifiersSnapshot,
    quantity: i.quantity,
    instructions: i.instructions ?? null,
    allergyNote: i.allergyNote ?? null,
    cancelled: i.status === "cancelled",
  }));
}

/**
 * Le tableau d'un poste. Les bons rappelés passent devant (un plat à refaire attend déjà),
 * puis la priorité, puis l'ordre d'arrivée. Le retard se calcule sur l'écran à partir de
 * `queuedAt` et des seuils du poste : le serveur ne pousse pas une horloge.
 */
export const board = query({
  args: { venueId: v.id("venues"), stationId: v.id("prepStations") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "kitchen.read", { venueId: args.venueId });
    const station = await getInVenue(ctx, args.stationId, actor.venue._id, "Ce poste");
    // Un écran de cuisine enrôlé pour un poste ne lit que ce poste.
    if (actor.device?.stationId !== undefined && actor.device.stationId !== station._id) throw notFound("Ce poste");
    const active: Doc<"kitchenTickets">[] = [];
    for (const status of IN_KITCHEN) active.push(...(await ticketsIn(ctx, station, status)));
    const rank = (t: Doc<"kitchenTickets">) => (t.status === "recalled" ? 0 : 1);
    active.sort((a, b) => rank(a) - rank(b) || b.priority - a.priority || (a.queuedAt ?? 0) - (b.queuedAt ?? 0));
    const ready = (await ticketsIn(ctx, station, "ready")).sort((a, b) => (b.readyAt ?? 0) - (a.readyAt ?? 0)).slice(0, READY_KEPT);

    const shape = async (t: Doc<"kitchenTickets">) => ({
      _id: t._id,
      reference: t.reference,
      tableNumber: t.tableNumber,
      status: t.status as TicketStatus,
      courseNumber: t.courseNumber,
      queuedAt: t.queuedAt ?? null,
      startedAt: t.startedAt ?? null,
      readyAt: t.readyAt ?? null,
      recalledAt: t.recalledAt ?? null,
      allergyFlags: t.allergyFlags,
      itemCount: t.itemCount,
      lines: await linesOf(ctx, t),
    });

    // Le cumul « à produire » : combien de chaque plat sur tout le tableau (vue d'ensemble du rush).
    const totals = new Map<string, number>();
    const activeShaped = await Promise.all(active.map(shape));
    for (const t of activeShaped) {
      for (const l of t.lines) {
        if (l.cancelled) continue;
        const key = l.variantName ? `${l.name} — ${l.variantName}` : l.name;
        totals.set(key, (totals.get(key) ?? 0) + l.quantity);
      }
    }

    return {
      station: {
        _id: station._id,
        name: station.name,
        type: station.type,
        targetPrepMinutes: station.targetPrepMinutes,
        lateThresholdMinutes: station.lateThresholdMinutes,
        soundEnabled: station.soundEnabled,
        isActive: station.isActive,
      },
      active: activeShaped,
      ready: await Promise.all(ready.map(shape)),
      allDay: [...totals.entries()].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity),
      canUpdate: actor.permissions.has("kitchen.ticket.update"),
    };
  },
});

/** Démarrer, marquer prêt, rappeler. Rejouer le même geste est sans effet (file hors ligne). */
export const advance = mutation({
  args: {
    venueId: v.id("venues"),
    ticketId: v.id("kitchenTickets"),
    action: v.union(v.literal("start"), v.literal("ready"), v.literal("recall")),
    actingMemberId: v.optional(v.id("organizationMembers")),
  },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "kitchen.ticket.update", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const ticket = await getInVenue(ctx, args.ticketId, actor.venue._id, "Ce bon");
    if (actor.device?.stationId !== undefined && actor.device.stationId !== ticket.prepStationId) throw notFound("Ce bon");
    if (ticket.status === "held") throw invalid("Ce service n'a pas encore été envoyé en cuisine.");
    const { changed } = await advanceTicket(ctx, ticket, args.action, actor.event);
    return { changed };
  },
});
