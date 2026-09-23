/**
 * Sessions de table — Joliba
 *
 * L'objet central du produit : l'occupation d'une table par un groupe, de l'installation à la
 * clôture (ARCHITECTURE.md §4). Une table a AU PLUS une session ouverte (R1) : c'est vérifié
 * ici, dans la transaction qui ouvre, et doublé par `restaurantTables.activeSessionId`.
 *
 * En tranche T2, il n'y a pas encore d'addition : clôturer une table exige seulement que
 * plus rien n'y soit en cours. La tranche T3 insérera l'addition entre « servi » et « clôturé »
 * (états `billing` / `settling`), et la clôture exigera alors un solde nul.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, invalid, notFound } from "./lib/errors";
import { memberCoversVenue, type ReadCtx } from "./lib/guards";
import { requireServiceActor, requireServiceMutation } from "./lib/serviceActor";
import { ACTIVE_ORDER, isClientRef, type OrderStatus } from "./lib/ordering";
import { activeSessionOf, isOpenSession, memberName, nextCounter, OPEN_SESSION, settingsOf } from "./lib/service";

/** « TS-2026-000123 » : l'année de l'établissement, puis le rang dans l'année. */
async function sessionReference(ctx: Parameters<typeof nextCounter>[0], venue: Doc<"venues">, now: number): Promise<string> {
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: venue.timezone, year: "numeric" }).format(new Date(now));
  const n = await nextCounter(ctx, venue._id, `session:${year}`);
  return `TS-${year}-${String(n).padStart(6, "0")}`;
}

async function ordersOf(ctx: ReadCtx, sessionId: Id<"tableSessions">) {
  return ctx.db
    .query("orders")
    .withIndex("by_session", (q) => q.eq("tableSessionId", sessionId))
    .collect();
}

/**
 * Ouvrir une table. Le serveur qui l'ouvre en devient responsable, sauf s'il en désigne un autre
 * plus tard. Refusé si la table est déjà ouverte : deux serveurs qui ouvrent la même table en même
 * temps n'obtiennent pas deux sessions — le second voit « déjà ouverte ».
 */
export const open = mutation({
  args: {
    venueId: v.id("venues"),
    tableId: v.id("restaurantTables"),
    guestCount: v.optional(v.number()),
    /** Présente quand l'ouverture vient de la file d'un appareil (D-062). */
    clientRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "table.session.open", { venueId: args.venueId });
    const table = await getInVenue(ctx, args.tableId, actor.venue._id, "Cette table");
    if (args.clientRef !== undefined) {
      if (!isClientRef(args.clientRef)) throw invalid("Référence d'appareil invalide.");
      const replay = await ctx.db
        .query("tableSessions")
        .withIndex("by_venue_clientRef", (q) => q.eq("venueId", actor.venue._id).eq("clientRef", args.clientRef))
        .unique();
      if (replay) return replay._id; // rejouée : déjà ouverte par ce geste
    }
    if (!table.isActive || table.status === "out_of_service") throw conflict("Cette table est hors service.");
    if (args.guestCount !== undefined && (!Number.isInteger(args.guestCount) || args.guestCount < 1 || args.guestCount > 40)) {
      throw invalid("Le nombre de couverts va de 1 à 40.");
    }
    const existing = await activeSessionOf(ctx, table._id);
    if (existing) {
      if (args.clientRef === undefined) throw conflict(`La table ${table.number} est déjà ouverte.`);
      // Ouverte hors ligne pendant qu'un collègue l'ouvrait en ligne : une seule session (R1).
      // Le geste rejoué rejoint la session existante, et c'est noté pour relecture.
      await writeAudit(ctx, {
        organizationId: actor.organization._id,
        venueId: actor.venue._id,
        ...actor.audit,
        action: "table.session.offline_merge",
        resourceType: "tableSession",
        resourceId: existing._id,
        after: { clientRef: args.clientRef },
      });
      return existing._id;
    }
    const now = Date.now();
    const settings = await settingsOf(ctx, actor.venue._id);
    const sessionId = await ctx.db.insert("tableSessions", {
      venueId: actor.venue._id,
      tableId: table._id,
      reference: await sessionReference(ctx, actor.venue, now),
      status: "open",
      originType: "staff",
      ...(args.guestCount !== undefined ? { guestCount: args.guestCount } : {}),
      ...(actor.member ? { assignedWaiterMemberId: actor.member._id, openedByMemberId: actor.member._id } : {}),
      openedAt: now,
      currency: actor.venue.currency,
      ...(args.clientRef !== undefined ? { clientRef: args.clientRef } : {}),
      lastActivityAt: now,
      isSimulation: actor.venue.isSimulation,
    });
    await ctx.db.patch(table._id, { status: "occupied", activeSessionId: sessionId });
    // Une table ouverte sans commande ne reste pas « occupée » toute la nuit.
    await ctx.scheduler.runAfter(settings.service.autoAbandonMinutes * 60_000, internal.sessions.abandonIfIdle, { sessionId });
    return sessionId;
  },
});

/** Prendre une table à son nom, ou (avec `table.session.transfer`) la confier à un collègue. */
export const assignWaiter = mutation({
  args: { venueId: v.id("venues"), sessionId: v.id("tableSessions"), memberId: v.optional(v.id("organizationMembers")) },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "table.session.open", { venueId: args.venueId });
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    if (!isOpenSession(session)) throw conflict("Cette table est clôturée.");
    const target = args.memberId ?? actor.member?._id;
    if (!target) throw invalid("Désignez le serveur.");
    if (target !== actor.member?._id) {
      if (!actor.permissions.has("table.session.transfer")) {
        throw conflict("Confier une table à un collègue demande le droit de transférer les tables.");
      }
      const member = await ctx.db.get(target);
      const covers =
        member !== null &&
        member.organizationId === actor.organization._id &&
        member.status === "active" &&
        (await memberCoversVenue(ctx, member, actor.venue, member.userId !== undefined && member.userId === actor.organization.ownerUserId));
      if (!covers) throw notFound("Ce membre de l'équipe");
    }
    await ctx.db.patch(session._id, { assignedWaiterMemberId: target, lastActivityAt: Date.now() });
  },
});

/**
 * Clôturer. Refusé tant qu'une commande est en cours : clôturer une table dont un plat est en
 * cuisine, c'est un plat que personne ne portera. Annulez ou servez d'abord.
 */
export const close = mutation({
  args: { venueId: v.id("venues"), sessionId: v.id("tableSessions") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "table.session.close", { venueId: args.venueId });
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    if (!isOpenSession(session)) return; // déjà clôturée : rejouer ne fait rien
    const orders = await ordersOf(ctx, session._id);
    const pending = orders.filter((o) => ACTIVE_ORDER.includes(o.status as OrderStatus));
    if (pending.length > 0) {
      throw conflict(
        `Il reste ${pending.length === 1 ? "une commande" : `${pending.length} commandes`} en cours sur cette table (${pending.map((o) => o.reference).join(", ")}). Servez ou annulez d'abord.`,
      );
    }
    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: orders.length === 0 ? "abandoned" : "closed",
      closedAt: now,
      ...(actor.member ? { closedByMemberId: actor.member._id } : {}),
      lastActivityAt: now,
    });
    const table = await ctx.db.get(session.tableId);
    if (table && table.activeSessionId === session._id) {
      await ctx.db.patch(table._id, { status: "available", activeSessionId: undefined });
    }
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
      action: "table.session.close",
      resourceType: "tableSession",
      resourceId: session._id,
      after: { reference: session.reference, orders: orders.length },
    });
  },
});

/** Tâche planifiée : une table ouverte sans aucune commande depuis trop longtemps est libérée. */
export const abandonIfIdle = internalMutation({
  args: { sessionId: v.id("tableSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "open") return;
    if ((await ordersOf(ctx, session._id)).length > 0) return;
    const settings = await settingsOf(ctx, session.venueId);
    const idleFor = Date.now() - session.lastActivityAt;
    const limit = settings.service.autoAbandonMinutes * 60_000;
    if (idleFor < limit) {
      await ctx.scheduler.runAfter(limit - idleFor, internal.sessions.abandonIfIdle, { sessionId: session._id });
      return;
    }
    await ctx.db.patch(session._id, { status: "abandoned", closedAt: Date.now() });
    const table = await ctx.db.get(session.tableId);
    if (table && table.activeSessionId === session._id) {
      await ctx.db.patch(table._id, { status: "available", activeSessionId: undefined });
    }
  },
});

/**
 * La salle en direct, pour l'écran du serveur : chaque table, sa session, et ce qui l'attend —
 * plats prêts à porter, demandes des clients. Une lecture par index, quel que soit le nombre de
 * tables : c'est l'écran qu'on regarde cinquante fois par service.
 */
export const floor = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "table.read", { venueId: args.venueId });
    const venueId = actor.venue._id;
    const areas = (
      await ctx.db
        .query("serviceAreas")
        .withIndex("by_venue_sort", (q) => q.eq("venueId", venueId))
        .collect()
    ).filter((a) => a.isActive);
    const sessions: Doc<"tableSessions">[] = [];
    for (const status of OPEN_SESSION) {
      sessions.push(
        ...(await ctx.db
          .query("tableSessions")
          .withIndex("by_venue_status", (q) => q.eq("venueId", venueId).eq("status", status))
          .collect()),
      );
    }
    const readyTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_venue_status", (q) => q.eq("venueId", venueId).eq("status", "ready"))
      .collect();
    const openRequests = await ctx.db
      .query("serviceRequests")
      .withIndex("by_venue_status_created", (q) => q.eq("venueId", venueId).eq("status", "open"))
      .collect();
    const pendingOrders = await ctx.db
      .query("orders")
      .withIndex("by_venue_status_submitted", (q) => q.eq("venueId", venueId).eq("status", "pending_acceptance"))
      .collect();
    const bySession = new Map(sessions.map((s) => [s._id, s]));
    const names = new Map<Id<"organizationMembers">, string | null>();
    const nameOf = async (id: Id<"organizationMembers"> | undefined) => {
      if (!id) return null;
      if (!names.has(id)) names.set(id, await memberName(ctx, id));
      return names.get(id)!;
    };
    const result = [];
    for (const area of areas) {
      const tables = (
        await ctx.db
          .query("restaurantTables")
          .withIndex("by_area", (q) => q.eq("serviceAreaId", area._id))
          .collect()
      ).filter((t) => t.isActive);
      const rows = [];
      for (const table of tables.sort((a, b) => a.number.localeCompare(b.number, "fr", { numeric: true }))) {
        const session = table.activeSessionId ? bySession.get(table.activeSessionId) : undefined;
        rows.push({
          _id: table._id,
          number: table.number,
          label: table.label ?? null,
          seats: table.seats,
          outOfService: table.status === "out_of_service",
          session: session
            ? {
                _id: session._id,
                reference: session.reference,
                status: session.status,
                guestCount: session.guestCount ?? null,
                openedAt: session.openedAt,
                waiterMemberId: session.assignedWaiterMemberId ?? null,
                waiterName: await nameOf(session.assignedWaiterMemberId),
                isMine: actor.member !== null && session.assignedWaiterMemberId === actor.member._id,
                readyCount: readyTickets.filter((t) => t.tableSessionId === session._id).length,
                requestCount: openRequests.filter((r) => r.tableSessionId === session._id).length,
                pendingCount: pendingOrders.filter((o) => o.tableSessionId === session._id).length,
              }
            : null,
        });
      }
      result.push({ _id: area._id, name: area.name, tables: rows });
    }
    return {
      areas: result,
      me: actor.member?._id ?? null,
      can: {
        open: actor.permissions.has("table.session.open"),
        close: actor.permissions.has("table.session.close"),
        order: actor.permissions.has("order.create"),
        serve: actor.permissions.has("order.serve"),
        transfer: actor.permissions.has("table.session.transfer"),
      },
    };
  },
});

/** Une table ouverte : ses commandes, lignes et bons, pour l'écran de la table. */
export const detail = query({
  args: { venueId: v.id("venues"), sessionId: v.id("tableSessions") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "order.read", { venueId: args.venueId });
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    const table = await ctx.db.get(session.tableId);
    const orders = (await ordersOf(ctx, session._id)).sort((a, b) => a.submittedAt - b.submittedAt);
    const result = [];
    for (const order of orders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      const tickets = await ctx.db
        .query("kitchenTickets")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      const stations = new Map<Id<"prepStations">, string>();
      for (const t of tickets) {
        if (!stations.has(t.prepStationId)) stations.set(t.prepStationId, (await ctx.db.get(t.prepStationId))?.name ?? "Poste");
      }
      result.push({
        _id: order._id,
        reference: order.reference,
        status: order.status,
        channel: order.channel,
        submittedAt: order.submittedAt,
        placedBy: await memberName(ctx, order.placedByMemberId),
        total: order.totals.total,
        notes: order.notes ?? null,
        rejectedReason: order.rejectedReason ?? null,
        items: items.map((i) => ({
          _id: i._id,
          name: i.nameSnapshot,
          variantName: i.variantNameSnapshot ?? null,
          modifiers: i.modifiers.map((m) => m.optionName),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          instructions: i.instructions ?? null,
          courseNumber: i.courseNumber,
          status: i.status,
          cancelledReason: i.cancelledReason ?? null,
        })),
        tickets: tickets.map((t) => ({
          _id: t._id,
          reference: t.reference,
          status: t.status,
          courseNumber: t.courseNumber,
          station: stations.get(t.prepStationId) ?? "Poste",
          readyAt: t.readyAt ?? null,
        })),
      });
    }
    const live = result.flatMap((o) => o.items).filter((i) => i.status !== "cancelled");
    return {
      _id: session._id,
      reference: session.reference,
      status: session.status,
      tableNumber: table?.number ?? "?",
      guestCount: session.guestCount ?? null,
      openedAt: session.openedAt,
      waiterName: await memberName(ctx, session.assignedWaiterMemberId),
      isMine: actor.member !== null && session.assignedWaiterMemberId === actor.member._id,
      currency: session.currency,
      /** Indicatif : l'addition, avec remises et paiements, est la tranche T3. */
      runningTotal: live.reduce((s, i) => s + i.lineTotal, 0),
      heldCourses: [...new Set(result.flatMap((o) => o.tickets).filter((t) => t.status === "held").map((t) => t.courseNumber))].sort(),
      orders: result,
      can: {
        order: actor.permissions.has("order.create") && isOpenSession(session),
        serve: actor.permissions.has("order.serve"),
        fire: actor.permissions.has("order.course.fire"),
        modify: actor.permissions.has("order.modify"),
        modifyAfterFire: actor.permissions.has("order.modify.after_fire"),
        cancel: actor.permissions.has("order.cancel"),
        accept: actor.permissions.has("order.accept"),
        close: actor.permissions.has("table.session.close") && isOpenSession(session),
      },
    };
  },
});
