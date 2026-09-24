/**
 * Le rapport de fin de service — Joliba (tranche T3)
 *
 * La question du gérant, souvent absent de la salle et lisant sur son téléphone : « qu'est-ce qui
 * est entré, par quel moyen, encaissé par qui — et l'écart s'explique-t-il ? ». Un jour de
 * service (du début réglé, 4 h par défaut, au lendemain même heure), sans graphique ni export.
 *
 * Les caisses se lisent PAR SESSION, pas par jour : une caisse ouverte à 18 h et comptée à 5 h
 * appartient au jour où elle a été ouverte. Les données de simulation sont exclues (G2).
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { closingState, DEFAULT_SERVICE_DAY_START_HOUR, loadSessionBilling, serviceDayWindow } from "./lib/billing";
import { invalid } from "./lib/errors";
import { requirePermission, type ReadCtx } from "./lib/guards";
import { serviceDayKey } from "./lib/ordering";
import { memberName, OPEN_SESSION, settingsOf } from "./lib/service";
import { methodLabel } from "./checks";
import { initialDiscrepancyOf } from "./cash";

function names(ctx: ReadCtx) {
  const cache = new Map<string, string | null>();
  return async (id: Id<"organizationMembers"> | undefined): Promise<string | null> => {
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, await memberName(ctx, id));
    return cache.get(id) ?? null;
  };
}

function tables(ctx: ReadCtx) {
  const cache = new Map<string, string>();
  return async (sessionId: Id<"tableSessions">): Promise<string> => {
    if (!cache.has(sessionId)) {
      const session = await ctx.db.get(sessionId);
      const table = session ? await ctx.db.get(session.tableId) : null;
      cache.set(sessionId, table?.number ?? "?");
    }
    return cache.get(sessionId)!;
  };
}

export const serviceDay = query({
  args: { venueId: v.id("venues"), day: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "report.service_day.read", { venueId: args.venueId });
    const venue = actor.venue;
    const settings = await settingsOf(ctx, venue._id);
    const startHour = settings.service.serviceDayStartHour ?? DEFAULT_SERVICE_DAY_START_HOUR;
    const today = serviceDayKey(Date.now(), venue.timezone, startHour);
    const day = args.day ?? today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw invalid("Jour invalide.");
    const { from, to } = serviceDayWindow(day, venue.timezone, startHour);
    const nameOf = names(ctx);
    // Les données de simulation n'entrent dans aucun chiffre réel (G2). Mais l'établissement de
    // démonstration lui-même lit les siennes : sinon son rapport serait toujours vide.
    const hide = (isSimulation: boolean) => isSimulation && !venue.isSimulation;
    const tableOf = tables(ctx);

    // ── Encaissements ──────────────────────────────────────────────────────
    const payments = (await ctx.db
      .query("payments")
      .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venue._id).gte("createdAt", from).lt("createdAt", to))
      .collect()).filter((p) => !hide(p.isSimulation));
    const valid = payments.filter((p) => p.status !== "voided");
    // `received` : ce que le téléphone ou le terminal doit afficher (montant + monnaie rendue en
    // espèces). C'est lui qu'on rapproche du relevé Wave, pas le seul montant de l'addition.
    const byMethod = new Map<string, { label: string; method: Doc<"payments">["method"]; amount: number; received: number; count: number }>();
    const byCollector = new Map<string, { name: string; amount: number; cash: number; changeOnNonCash: number; count: number }>();
    for (const p of valid) {
      const label = methodLabel(p);
      const m = byMethod.get(label) ?? { label, method: p.method, amount: 0, received: 0, count: 0 };
      m.amount += p.amount;
      m.received += p.method === "cash" ? p.amount : (p.receivedAmount ?? p.amount);
      m.count += 1;
      byMethod.set(label, m);
      const key = p.collectedByMemberId ?? "en_ligne";
      const c = byCollector.get(key) ?? { name: (await nameOf(p.collectedByMemberId)) ?? "En ligne", amount: 0, cash: 0, changeOnNonCash: 0, count: 0 };
      c.amount += p.amount;
      if (p.method === "cash") c.cash += p.amount;
      else c.changeOnNonCash += p.changeAmount ?? 0;
      c.count += 1;
      byCollector.set(key, c);
    }
    const voidedRows = (await ctx.db
      .query("payments")
      .withIndex("by_venue_voidedAt", (q) => q.eq("venueId", venue._id).gte("voidedAt", from).lt("voidedAt", to))
      .collect()).filter((p) => p.status === "voided" && !hide(p.isSimulation));
    const voids = [];
    for (const p of voidedRows) {
      voids.push({
        _id: p._id,
        table: await tableOf(p.tableSessionId),
        label: methodLabel(p),
        amount: p.amount,
        collectedBy: await nameOf(p.collectedByMemberId),
        voidedBy: await nameOf(p.voidedByMemberId),
        reason: p.voidedReason ?? null,
        at: p.voidedAt ?? p.createdAt,
      });
    }

    const refundRows = (await ctx.db
      .query("refunds")
      .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venue._id).gte("createdAt", from).lt("createdAt", to))
      .collect()).filter((r) => !hide(r.isSimulation) && r.status === "succeeded");
    const refunds = [];
    for (const r of refundRows) {
      const payment = await ctx.db.get(r.paymentId);
      refunds.push({
        _id: r._id,
        table: payment ? await tableOf(payment.tableSessionId) : "?",
        amount: r.amount,
        method: r.method === "cash" ? "Espèces" : payment ? methodLabel(payment) : r.method,
        by: await nameOf(r.requestedByMemberId),
        reason: r.reason,
        at: r.createdAt,
      });
    }

    // ── Offerts, remises ───────────────────────────────────────────────────
    const adjustmentRows = await ctx.db
      .query("orderAdjustments")
      .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venue._id).gte("createdAt", from).lt("createdAt", to))
      .collect();
    const adjustments = [];
    for (const a of adjustmentRows) {
      const session = await ctx.db.get(a.tableSessionId);
      if (session && hide(session.isSimulation)) continue;
      adjustments.push({
        _id: a._id,
        type: a.type,
        label: a.label,
        table: await tableOf(a.tableSessionId),
        amount: a.amount,
        by: await nameOf(a.appliedByMemberId),
        reason: a.reason ?? null,
        at: a.createdAt,
      });
    }

    // ── Caisses (par session : celles ouvertes ce jour-là, et celles encore ouvertes) ─
    const opened = await ctx.db
      .query("cashRegisterSessions")
      .withIndex("by_venue_openedAt", (q) => q.eq("venueId", venue._id).gte("openedAt", from).lt("openedAt", to))
      .collect();
    const live: Doc<"cashRegisterSessions">[] = [];
    for (const status of ["open", "counting", "balanced", "discrepancy"] as const) {
      live.push(
        ...(await ctx.db
          .query("cashRegisterSessions")
          .withIndex("by_venue_status", (q) => q.eq("venueId", venue._id).eq("status", status))
          .collect()),
      );
    }
    const cashSessions = [];
    const seen = new Set<string>();
    for (const s of [...opened, ...live]) {
      if (seen.has(s._id) || hide(s.isSimulation)) continue;
      seen.add(s._id);
      const register = s.cashRegisterId ? await ctx.db.get(s.cashRegisterId) : null;
      const holder = await nameOf(s.holderMemberId);
      const counts = [];
      for (const c of s.counts) counts.push({ amount: c.amount, by: (await nameOf(c.countedByMemberId)) ?? "?", at: c.at });
      const lastCounter = s.counts.at(-1)?.countedByMemberId;
      const movements = [];
      for (const m of await ctx.db
        .query("cashMovements")
        .withIndex("by_session", (q) => q.eq("registerSessionId", s._id))
        .collect()) {
        movements.push({ _id: m._id, type: m.type, amount: m.amount, reason: m.reason, by: (await nameOf(m.createdByMemberId)) ?? "?", at: m.createdAt });
      }
      cashSessions.push({
        _id: s._id,
        name: holder ? `Pochette de ${holder}` : (register?.name ?? "Caisse"),
        holder,
        openedBy: await nameOf(s.openedByMemberId),
        openedAt: s.openedAt,
        status: s.status,
        openingFloat: s.openingFloat,
        expected: s.expectedAmount ?? null,
        counted: s.countedAmount ?? null,
        discrepancy: s.discrepancy ?? null,
        initialDiscrepancy: initialDiscrepancyOf(s),
        counts,
        movements,
        /** Un tiroir compté par celui qui l'a ouvert : permis, mais dit. */
        selfCounted: lastCounter !== undefined && lastCounter === s.openedByMemberId,
        closeReason: s.closeReason ?? null,
        closedBy: await nameOf(s.closedByMemberId),
        closedAt: s.closedAt ?? null,
      });
    }

    // ── Impayés, tables encore ouvertes ────────────────────────────────────
    const debtRows = (await ctx.db
      .query("tableSessions")
      .withIndex("by_venue_status", (q) => q.eq("venueId", venue._id).eq("status", "closed_with_debt"))
      .collect()).filter((s) => !hide(s.isSimulation) && (s.closedAt ?? 0) >= from && (s.closedAt ?? 0) < to);
    const debts = [];
    for (const s of debtRows) {
      const { owed } = await closingState(ctx, await loadSessionBilling(ctx, s));
      debts.push({
        _id: s._id,
        table: await tableOf(s._id),
        reference: s.reference,
        amount: s.debtAmount ?? 0,
        /** Ce que le client est revenu payer depuis. */
        recovered: Math.max(0, (s.debtAmount ?? 0) - owed),
        reason: s.closeReason ?? null,
        by: await nameOf(s.closedByMemberId),
        at: s.closedAt ?? 0,
      });
    }
    const openTables = [];
    for (const status of OPEN_SESSION) {
      const rows = await ctx.db
        .query("tableSessions")
        .withIndex("by_venue_status", (q) => q.eq("venueId", venue._id).eq("status", status))
        .collect();
      for (const s of rows) {
        if (hide(s.isSimulation)) continue;
        const billing = await loadSessionBilling(ctx, s);
        openTables.push({ _id: s._id, table: await tableOf(s._id), reference: s.reference, due: (await closingState(ctx, billing)).owed, waiter: await nameOf(s.assignedWaiterMemberId), openedAt: s.openedAt });
      }
    }

    // ── Pertes : plats annulés après envoi en cuisine ──────────────────────
    const cancelEvents = await ctx.db
      .query("orderEvents")
      .withIndex("by_venue_type_at", (q) => q.eq("venueId", venue._id).eq("type", "item_cancelled").gte("at", from).lt("at", to))
      .collect();
    const cancellations = [];
    for (const e of cancelEvents) {
      const payload = (e.payload ?? {}) as { item?: string; quantity?: number; amount?: number; afterFire?: boolean; reason?: string };
      if (payload.afterFire !== true) continue;
      const order = await ctx.db.get(e.orderId);
      if (!order) continue;
      const session = await ctx.db.get(order.tableSessionId);
      if (session && hide(session.isSimulation)) continue;
      cancellations.push({
        _id: e._id,
        table: await tableOf(order.tableSessionId),
        item: payload.item ?? "?",
        quantity: payload.quantity ?? 1,
        amount: payload.amount ?? null,
        reason: payload.reason ?? null,
        by: await nameOf(e.actorMemberId),
        at: e.at,
      });
    }

    // Comptage à l'aveugle (D-081) : tant qu'une caisse est en comptage sans compté saisi, les
    // sommes d'encaissement la trahiraient (fonds + espèces du serveur ≈ attendu). Elles attendent.
    const blind = cashSessions.filter((s) => s.status === "counting" && s.counts.length === 0).map((s) => s.name);
    const collected = valid.reduce((s, p) => s + p.amount, 0);
    const refunded = refunds.reduce((s, r) => s + r.amount, 0);
    return {
      day,
      today,
      from,
      to,
      currency: venue.currency,
      timezone: venue.timezone,
      simulation: venue.isSimulation,
      blindCounting: blind,
      totals: blind.length > 0 ? null : { collected, refunded, net: collected - refunded, count: valid.length },
      byMethod: blind.length > 0 ? [] : [...byMethod.values()].sort((a, b) => b.amount - a.amount),
      byCollector: blind.length > 0 ? [] : [...byCollector.values()].sort((a, b) => b.amount - a.amount),
      cashSessions: cashSessions.sort((a, b) => a.openedAt - b.openedAt),
      voids,
      refunds,
      adjustments,
      debts,
      openTables: openTables.sort((a, b) => b.due - a.due),
      cancellations,
    };
  },
});
