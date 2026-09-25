/**
 * Le calcul d'un jour de service — Joliba (D-136, D-139)
 *
 * Une seule fonction lit les faits d'un jour et rend ses chiffres : le rapport, « aujourd'hui »,
 * la clôture nocturne (`dailyMetrics`) et les analyses passent tous par elle. Chaque fait est
 * daté par ce qui le fait compter :
 *   - une table et ses Ventes appartiennent au jour où les clients se sont installés ;
 *   - un paiement, un remboursement, un offert, une annulation, au jour où ils ont eu lieu ;
 *   - une caisse, au jour où elle a été ouverte.
 *
 * Le jour en cours se lit avec la même fonction : rien n'existe encore après maintenant, et la
 * clôture écrira, une heure après la fin du jour, ce qu'« aujourd'hui » montrait.
 */

import type { Doc, Id } from "../_generated/dataModel";
import { methodLabel } from "../checks";
import {
  acceptanceTime,
  countsInFigures,
  emptySlots,
  histogramOf,
  passTime,
  prepTime,
  readyWithoutStart,
  requestResponseTime,
  slotOf,
  waitBeforeStart,
} from "./analytics";
import { lineGross, loadSessionBilling, serviceDayWindow } from "./billing";
import type { DayMetrics } from "./dayMetrics";
import type { ReadCtx } from "./guards";

/** Change quand la définition d'un chiffre change : l'historique est alors reconstruit (D-141). */
export const METRICS_VERSION = 1;

/** Les commandes qui ne sont pas des ventes : pas encore acceptées, refusées, annulées. */
const NOT_SOLD: ReadonlySet<Doc<"orders">["status"]> = new Set(["draft", "pending_payment", "pending_acceptance", "rejected", "cancelled"]);

type Venue = Pick<Doc<"venues">, "_id" | "timezone" | "currency" | "isSimulation">;

/**
 * L'argent d'un jour : paiements non annulés et remboursements confirmés, datés par leur
 * création. Le rapport et le calcul du jour lisent CETTE fonction : l'Encaissé n'a qu'une
 * définition.
 */
export async function loadDayMoney(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  const payments = (await ctx.db
    .query("payments")
    .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venue._id).gte("createdAt", from).lt("createdAt", to))
    .collect()).filter((p) => countsInFigures(p.isSimulation, venue) && p.status !== "voided");
  const refunds = (await ctx.db
    .query("refunds")
    .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venue._id).gte("createdAt", from).lt("createdAt", to))
    .collect()).filter((r) => countsInFigures(r.isSimulation, venue) && r.status === "succeeded");
  const gross = payments.reduce((s, p) => s + p.amount, 0);
  const refunded = refunds.reduce((s, r) => s + r.amount, 0);
  const byMethod = new Map<string, { label: string; amount: number; count: number }>();
  for (const p of payments) {
    const label = methodLabel(p);
    const m = byMethod.get(label) ?? { label, amount: 0, count: 0 };
    m.amount += p.amount;
    m.count += 1;
    byMethod.set(label, m);
  }
  return {
    payments,
    refunds,
    collected: { gross, refunded, net: gross - refunded, payments: payments.length },
    byMethod: [...byMethod.values()].sort((a, b) => b.amount - a.amount),
  };
}

export async function computeServiceDay(
  ctx: ReadCtx,
  venue: Venue,
  day: string,
  startHour: number,
): Promise<DayMetrics> {
  const { from, to } = serviceDayWindow(day, venue.timezone, startHour);
  const counts = (isSimulation: boolean) => countsInFigures(isSimulation, venue);
  const slots = { orders: emptySlots(), sales: emptySlots(), collected: emptySlots() };

  // ── Argent ──────────────────────────────────────────────────────────────
  const money = await loadDayMoney(ctx, venue, from, to);
  for (const p of money.payments) slots.collected[slotOf(p.createdAt, from)]! += p.amount;
  for (const r of money.refunds) slots.collected[slotOf(r.createdAt, from)]! -= r.amount;
  const voids = (await ctx.db
    .query("payments")
    .withIndex("by_venue_voidedAt", (q) => q.eq("venueId", venue._id).gte("voidedAt", from).lt("voidedAt", to))
    .collect()).filter((p) => p.status === "voided" && counts(p.isSimulation)).length;

  // ── Tables installées ce jour-là : Ventes, couverts, durée ──────────────
  const sessions = (await ctx.db
    .query("tableSessions")
    .withIndex("by_venue_openedAt", (q) => q.eq("venueId", venue._id).gte("openedAt", from).lt("openedAt", to))
    .collect()).filter((s) => counts(s.isSimulation) && s.mergedIntoSessionId === undefined);
  const sales = { amount: 0, tables: 0, tablesWithCovers: 0, covers: 0, abandoned: 0 };
  const durations: number[] = [];
  for (const s of sessions) {
    if (s.status === "abandoned") {
      sales.abandoned += 1;
      continue;
    }
    const { total } = await loadSessionBilling(ctx, s);
    sales.amount += total;
    slots.sales[slotOf(s.openedAt, from)]! += total;
    sales.tables += 1;
    if (s.guestCount !== undefined && s.guestCount > 0) {
      sales.tablesWithCovers += 1;
      sales.covers += s.guestCount;
    }
    if (s.closedAt !== undefined) durations.push(s.closedAt - s.openedAt);
  }
  const debtSessions = (await ctx.db
    .query("tableSessions")
    .withIndex("by_venue_status", (q) => q.eq("venueId", venue._id).eq("status", "closed_with_debt"))
    .collect()).filter((s) => counts(s.isSimulation) && (s.closedAt ?? 0) >= from && (s.closedAt ?? 0) < to);

  // ── Commandes, produits, délais de cuisine ──────────────────────────────
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_venue_submittedAt", (q) => q.eq("venueId", venue._id).gte("submittedAt", from).lt("submittedAt", to))
    .collect();
  const sessionCounts = new Map<Id<"tableSessions">, boolean>();
  const sessionOf = async (id: Id<"tableSessions">) => {
    if (!sessionCounts.has(id)) sessionCounts.set(id, counts((await ctx.db.get(id))?.isSimulation ?? false));
    return sessionCounts.get(id)!;
  };
  const products = new Map<string, DayMetrics["products"][number]>();
  const productOf = (item: Doc<"orderItems">) => {
    const key = item.productId ?? `nom:${item.nameSnapshot}`;
    const row = products.get(key) ?? { ...(item.productId ? { productId: item.productId } : {}), name: item.nameSnapshot, quantity: 0, amount: 0, lostQuantity: 0, lostAmount: 0 };
    products.set(key, row);
    return row;
  };
  const acceptance: number[] = [];
  const waitStart: number[] = [];
  const prep: number[] = [];
  const pass: number[] = [];
  let tickets = 0;
  let unstarted = 0;
  const byStation = new Map<Id<"prepStations">, { waitStart: number[]; prep: number[] }>();
  let orderCount = 0;
  let fromGuests = 0;
  for (const order of orders) {
    if (!(await sessionOf(order.tableSessionId))) continue;
    if (NOT_SOLD.has(order.status) && order.status !== "cancelled") continue;
    orderCount += 1;
    if (order.channel === "guest") fromGuests += 1;
    slots.orders[slotOf(order.submittedAt, from)]! += 1;
    const accepted = acceptanceTime(order);
    if (accepted !== null) acceptance.push(accepted);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) {
      if (item.status === "cancelled") continue;
      const row = productOf(item);
      row.quantity += item.quantity;
      row.amount += lineGross(item);
    }
    // Une commande saisie « déjà servie » (sur papier, pendant une coupure) n'a aucun délai réel.
    if (order.enteredOffline) continue;
    const orderTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const t of orderTickets) {
      if (t.status === "cancelled" || t.readyAt === undefined) continue;
      tickets += 1;
      if (readyWithoutStart(t)) unstarted += 1;
      const station = byStation.get(t.prepStationId) ?? { waitStart: [], prep: [] };
      byStation.set(t.prepStationId, station);
      const w = waitBeforeStart(t);
      if (w !== null) {
        waitStart.push(w);
        station.waitStart.push(w);
      }
      const p = prepTime(t);
      if (p !== null) {
        prep.push(p);
        station.prep.push(p);
      }
      const s = passTime(t);
      if (s !== null) pass.push(s);
    }
  }

  // ── Pertes : plats annulés alors qu'ils étaient en cuisine (au jour de l'annulation) ─
  const cancelEvents = await ctx.db
    .query("orderEvents")
    .withIndex("by_venue_type_at", (q) => q.eq("venueId", venue._id).eq("type", "item_cancelled").gte("at", from).lt("at", to))
    .collect();
  let lostAmount = 0;
  for (const e of cancelEvents) {
    const payload = (e.payload ?? {}) as { item?: string; quantity?: number; amount?: number; afterFire?: boolean };
    if (payload.afterFire !== true) continue;
    const order = await ctx.db.get(e.orderId);
    if (!order || !(await sessionOf(order.tableSessionId))) continue;
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    const item = items.find((i) => i.nameSnapshot === payload.item && i.status === "cancelled");
    const row = item ? productOf(item) : null;
    if (row) {
      row.lostQuantity += payload.quantity ?? 1;
      row.lostAmount += payload.amount ?? 0;
    }
    lostAmount += payload.amount ?? 0;
  }

  // ── Demandes des clients ────────────────────────────────────────────────
  const requests: number[] = [];
  for (const status of ["open", "acknowledged", "resolved"] as const) {
    const rows = await ctx.db
      .query("serviceRequests")
      .withIndex("by_venue_status_created", (q) => q.eq("venueId", venue._id).eq("status", status).gte("createdAt", from).lt("createdAt", to))
      .collect();
    for (const r of rows) {
      if (r.tableSessionId && !(await sessionOf(r.tableSessionId))) continue;
      const d = requestResponseTime(r);
      if (d !== null) requests.push(d);
    }
  }

  // ── Offerts, remises, caisses ───────────────────────────────────────────
  let comps = 0;
  let discounts = 0;
  for (const a of await ctx.db
    .query("orderAdjustments")
    .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venue._id).gte("createdAt", from).lt("createdAt", to))
    .collect()) {
    if (!(await sessionOf(a.tableSessionId))) continue;
    if (a.type === "comp") comps += a.amount;
    else discounts += a.amount;
  }
  const registers = (await ctx.db
    .query("cashRegisterSessions")
    .withIndex("by_venue_openedAt", (q) => q.eq("venueId", venue._id).gte("openedAt", from).lt("openedAt", to))
    .collect()).filter((s) => counts(s.isSimulation) && s.discrepancy !== undefined && s.discrepancy !== 0);

  const stations = [];
  for (const [stationId, d] of byStation) {
    const station = await ctx.db.get(stationId);
    stations.push({ stationId, name: station?.name ?? "Poste", prep: histogramOf(d.prep), waitStart: histogramOf(d.waitStart) });
  }

  return {
    sourceVersion: METRICS_VERSION,
    startHour,
    from,
    to,
    currency: venue.currency,
    orders: { count: orderCount, fromGuests },
    sales,
    collected: money.collected,
    byMethod: money.byMethod,
    slots,
    products: [...products.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
    delays: {
      acceptance: histogramOf(acceptance),
      waitStart: histogramOf(waitStart),
      prep: histogramOf(prep),
      pass: histogramOf(pass),
      request: histogramOf(requests),
      readyWithoutStart: unstarted,
      tickets,
    },
    stations: stations.sort((a, b) => a.name.localeCompare(b.name)),
    tables: {
      duration: histogramOf(durations),
      debts: debtSessions.length,
      debtAmount: debtSessions.reduce((s, x) => s + (x.debtAmount ?? 0), 0),
    },
    exceptions: {
      comps,
      discounts,
      lostAmount,
      refunds: money.collected.refunded,
      voids,
      cashDiscrepancy: registers.reduce((s, r) => s + (r.discrepancy ?? 0), 0),
      cashDiscrepancies: registers.length,
    },
  };
}

/**
 * Les caisses en comptage à l'aveugle (D-081, D-138) : tant qu'une caisse est en comptage sans
 * compté saisi, toute somme du jour la trahirait — l'Encaissé, et dans un maquis qui n'encaisse
 * qu'en espèces, les Ventes aussi. Chaque écran qui montre une somme du jour lit CETTE fonction.
 */
export async function blindCountingSessions(ctx: ReadCtx, venue: Venue): Promise<Doc<"cashRegisterSessions">[]> {
  const counting = await ctx.db
    .query("cashRegisterSessions")
    .withIndex("by_venue_status", (q) => q.eq("venueId", venue._id).eq("status", "counting"))
    .collect();
  return counting.filter((s) => s.counts.length === 0 && countsInFigures(s.isSimulation, venue));
}
