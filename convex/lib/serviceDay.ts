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

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
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
  serviceDayOf,
  shiftDay,
  slotOf,
  startHourOf,
  waitBeforeStart,
} from "./analytics";
import { lineGross, loadSessionBilling, serviceDayWindow } from "./billing";
import { discrepancyOf } from "./cashCount";
import type { DayMetrics } from "./dayMetrics";
import type { ReadCtx } from "./guards";
import { memberName, settingsOf } from "./service";

/**
 * Change quand la définition d'un chiffre change. La clôture recalcule alors J-1 et J-2 ; le
 * reste de l'historique se reconstruit à la main (`analytics:rebuild`), et une période qui mêle
 * deux versions le dit (`versions`).
 */
export const METRICS_VERSION = 2;

/** Les commandes qui ne sont pas des ventes : pas encore acceptées, refusées, annulées (comptées nulle part). */
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

/* ────────────────────────────────────────────────────────────────────────────
 * La fenêtre d'un jour
 * ──────────────────────────────────────────────────────────────────────────── */

export type DayWindow = { from: number; to: number; startHour: number };

/**
 * Une correction tardive (remboursement confirmé, paiement annulé, caisse comptée, offert ou
 * commande sur une table d'un jour clos) fait recalculer le jour DÉJÀ écrit qu'elle touche : sans
 * quoi le rapport, recalculé en direct, et les analyses, lues dans `dailyMetrics`, divergeraient
 * pour de bon (D-139). Un jour pas encore écrit n'a besoin de rien : la clôture le lira.
 */
export async function refreshClosedDay(ctx: MutationCtx, venueId: Id<"venues">, at: number): Promise<void> {
  const venue = await ctx.db.get(venueId);
  if (!venue) return;
  const settings = await settingsOf(ctx, venueId);
  const today = serviceDayOf(Date.now(), venue, settings);
  // Le chemin chaud du produit : une commande sur une table de ce soir ne lit aucune ligne de chiffres.
  if (at >= serviceDayWindow(today, venue.timezone, startHourOf(settings)).from) return;
  const guess = serviceDayOf(at, venue, settings);
  for (const day of [shiftDay(guess, -1), guess, shiftDay(guess, 1)]) {
    if (day >= today) continue;
    const row = await storedDay(ctx, venueId, day);
    if (!row || at < row.from || at >= row.to) continue;
    // Une fois par mutation : annuler une commande de dix lignes ne recalcule pas dix fois le jour.
    const done = refreshed.get(ctx) ?? new Set<string>();
    refreshed.set(ctx, done);
    if (done.has(`${venueId}:${day}`)) return;
    done.add(`${venueId}:${day}`);
    await ctx.scheduler.runAfter(0, internal.analytics.computeDay, { venueId, day });
    return;
  }
}

/** Les jours déjà reprogrammés par la mutation en cours (une entrée par transaction, libérée avec elle). */
const refreshed = new WeakMap<MutationCtx, Set<string>>();

export async function storedDay(ctx: ReadCtx, venueId: Id<"venues">, day: string): Promise<Doc<"dailyMetrics"> | null> {
  return ctx.db
    .query("dailyMetrics")
    .withIndex("by_venue_date", (q) => q.eq("venueId", venueId).eq("businessDate", day))
    .unique();
}

/**
 * La fenêtre d'un jour. Un jour déjà écrit garde la sienne ; un jour qui ne l'est pas encore
 * part de la fin du précédent quand l'heure de début a changé entre-temps : aucun fait n'est
 * perdu entre deux jours ni compté dans les deux (4 h → 6 h, ou 6 h → 4 h).
 */
export async function dayWindow(ctx: ReadCtx, venue: Venue, day: string, settings: Pick<Doc<"venueSettings">, "service">): Promise<DayWindow> {
  const stored = await storedDay(ctx, venue._id, day);
  if (stored) return { from: stored.from, to: stored.to, startHour: stored.startHour };
  const startHour = startHourOf(settings);
  const base = serviceDayWindow(day, venue.timezone, startHour);
  const previous = await storedDay(ctx, venue._id, shiftDay(day, -1));
  const from = previous && previous.to < base.to ? previous.to : base.from;
  return { from, to: base.to, startHour };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Les faits d'un jour, un chargeur par sorte (partagés avec le rapport, D-139)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Mémorise, par table, si elle compte dans les chiffres (une table de simulation ne compte pas). */
export function sessionFilter(ctx: ReadCtx, venue: Venue) {
  const cache = new Map<Id<"tableSessions">, boolean>();
  return async (id: Id<"tableSessions">) => {
    if (!cache.has(id)) cache.set(id, countsInFigures((await ctx.db.get(id))?.isSimulation ?? false, venue));
    return cache.get(id)!;
  };
}

/** Les paiements annulés ce jour-là. */
export async function loadDayVoids(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  return (await ctx.db
    .query("payments")
    .withIndex("by_venue_voidedAt", (q) => q.eq("venueId", venue._id).gte("voidedAt", from).lt("voidedAt", to))
    .collect()).filter((p) => p.status === "voided" && countsInFigures(p.isSimulation, venue));
}

/** Les offerts et remises accordés ce jour-là. */
export async function loadDayAdjustments(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  const counts = sessionFilter(ctx, venue);
  const rows = await ctx.db
    .query("orderAdjustments")
    .withIndex("by_venue_createdAt", (q) => q.eq("venueId", venue._id).gte("createdAt", from).lt("createdAt", to))
    .collect();
  const kept = [];
  for (const a of rows) if (await counts(a.tableSessionId)) kept.push(a);
  return kept;
}

/** Les tables parties sans payer ce jour-là (par l'index : l'historique ne se relit pas). */
export async function loadDayDebts(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  return (await ctx.db
    .query("tableSessions")
    .withIndex("by_venue_status_closedAt", (q) => q.eq("venueId", venue._id).eq("status", "closed_with_debt").gte("closedAt", from).lt("closedAt", to))
    .collect()).filter((s) => countsInFigures(s.isSimulation, venue));
}

/** Les plats annulés alors qu'ils étaient en cuisine, au jour de l'annulation : des denrées perdues. */
export async function loadDayLosses(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  const counts = sessionFilter(ctx, venue);
  const events = await ctx.db
    .query("orderEvents")
    .withIndex("by_venue_type_at", (q) => q.eq("venueId", venue._id).eq("type", "item_cancelled").gte("at", from).lt("at", to))
    .collect();
  const losses = [];
  for (const e of events) {
    const payload = (e.payload ?? {}) as { orderItemId?: Id<"orderItems">; item?: string; quantity?: number; amount?: number; afterFire?: boolean; reason?: string };
    if (payload.afterFire !== true) continue;
    const order = await ctx.db.get(e.orderId);
    if (!order || !(await counts(order.tableSessionId))) continue;
    // Les événements écrits avant `orderItemId` retrouvent leur ligne par le nom.
    const item = payload.orderItemId
      ? await ctx.db.get(payload.orderItemId)
      : ((await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect()).find((i) => i.nameSnapshot === payload.item && i.status === "cancelled") ?? null);
    losses.push({ event: e, order, item, name: payload.item ?? item?.nameSnapshot ?? "?", quantity: payload.quantity ?? 1, amount: payload.amount ?? null, reason: payload.reason ?? null });
  }
  return losses;
}

/** Les tables installées ce jour-là, avec le solde de leur addition. */
export async function loadDaySessions(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  const sessions = (await ctx.db
    .query("tableSessions")
    .withIndex("by_venue_openedAt", (q) => q.eq("venueId", venue._id).gte("openedAt", from).lt("openedAt", to))
    .collect()).filter((s) => countsInFigures(s.isSimulation, venue) && s.mergedIntoSessionId === undefined);
  const rows = [];
  for (const session of sessions) {
    rows.push({ session, total: session.status === "abandoned" ? 0 : (await loadSessionBilling(ctx, session)).total });
  }
  return rows;
}

/** Les commandes VENDUES ce jour-là (ni annulées, ni refusées, ni en attente), avec leurs lignes et leurs bons. */
export async function loadDayOrders(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  const counts = sessionFilter(ctx, venue);
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_venue_submittedAt", (q) => q.eq("venueId", venue._id).gte("submittedAt", from).lt("submittedAt", to))
    .collect();
  const rows = [];
  for (const order of orders) {
    if (NOT_SOLD.has(order.status) || !(await counts(order.tableSessionId))) continue;
    const items = await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect();
    // Une commande saisie « déjà servie » (sur papier, pendant une coupure) n'a aucun délai réel.
    const tickets = order.enteredOffline ? [] : await ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect();
    rows.push({ order, items, tickets });
  }
  return rows;
}

/** Les délais de réponse aux demandes des clients faites ce jour-là. */
export async function loadDayRequests(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  const counts = sessionFilter(ctx, venue);
  const delays: number[] = [];
  for (const status of ["open", "acknowledged", "resolved"] as const) {
    const rows = await ctx.db
      .query("serviceRequests")
      .withIndex("by_venue_status_created", (q) => q.eq("venueId", venue._id).eq("status", status).gte("createdAt", from).lt("createdAt", to))
      .collect();
    for (const r of rows) {
      if (r.tableSessionId && !(await counts(r.tableSessionId))) continue;
      const d = requestResponseTime(r);
      if (d !== null) delays.push(d);
    }
  }
  return delays;
}

/** Les caisses ouvertes ce jour-là qui ont un écart au premier comptage. */
export async function loadDayRegisters(ctx: ReadCtx, venue: Venue, from: number, to: number) {
  return (await ctx.db
    .query("cashRegisterSessions")
    .withIndex("by_venue_openedAt", (q) => q.eq("venueId", venue._id).gte("openedAt", from).lt("openedAt", to))
    .collect()).filter((s) => countsInFigures(s.isSimulation, venue) && (discrepancyOf(s) ?? 0) !== 0);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Le calcul, composé des chargeurs
 * ──────────────────────────────────────────────────────────────────────────── */

type Orders = Awaited<ReturnType<typeof loadDayOrders>>;
type Losses = Awaited<ReturnType<typeof loadDayLosses>>;

function productTable() {
  const products = new Map<string, DayMetrics["products"][number]>();
  const of = (item: Pick<Doc<"orderItems">, "productId" | "nameSnapshot"> | null, name: string) => {
    const key = item?.productId ?? `nom:${item?.nameSnapshot ?? name}`;
    const row = products.get(key) ?? { ...(item?.productId ? { productId: item.productId } : {}), name: item?.nameSnapshot ?? name, quantity: 0, amount: 0, lostQuantity: 0, lostAmount: 0 };
    products.set(key, row);
    return row;
  };
  return { of, rows: () => [...products.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)) };
}

/** Commandes, produits vendus et délais de cuisine. */
async function orderFigures(ctx: ReadCtx, rows: Orders, from: number, products: ReturnType<typeof productTable>, slots: number[]) {
  const acceptance: number[] = [];
  const all = { waitStart: [] as number[], prep: [] as number[], pass: [] as number[] };
  const byStation = new Map<Id<"prepStations">, { waitStart: number[]; prep: number[] }>();
  let tickets = 0;
  let unstarted = 0;
  let fromGuests = 0;
  for (const { order, items, tickets: orderTickets } of rows) {
    if (order.channel === "guest") fromGuests += 1;
    slots[slotOf(order.submittedAt, from)]! += 1;
    const accepted = acceptanceTime(order);
    if (accepted !== null) acceptance.push(accepted);
    for (const item of items) {
      if (item.status === "cancelled") continue;
      const row = products.of(item, item.nameSnapshot);
      row.quantity += item.quantity;
      row.amount += lineGross(item);
    }
    for (const t of orderTickets) {
      if (t.status === "cancelled" || t.readyAt === undefined) continue;
      tickets += 1;
      if (readyWithoutStart(t)) unstarted += 1;
      const station = byStation.get(t.prepStationId) ?? { waitStart: [], prep: [] };
      byStation.set(t.prepStationId, station);
      for (const [key, value] of [["waitStart", waitBeforeStart(t)], ["prep", prepTime(t)], ["pass", passTime(t)]] as const) {
        if (value === null) continue;
        all[key].push(value);
        if (key !== "pass") station[key].push(value);
      }
    }
  }
  const stations = [];
  for (const [stationId, d] of byStation) {
    const station = await ctx.db.get(stationId);
    stations.push({ stationId, name: station?.name ?? "Poste", prep: histogramOf(d.prep), waitStart: histogramOf(d.waitStart) });
  }
  return {
    orders: { count: rows.length, fromGuests },
    delays: { acceptance: histogramOf(acceptance), waitStart: histogramOf(all.waitStart), prep: histogramOf(all.prep), pass: histogramOf(all.pass), readyWithoutStart: unstarted, tickets },
    stations: stations.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function lossFigures(losses: Losses, products: ReturnType<typeof productTable>) {
  let lostAmount = 0;
  for (const l of losses) {
    const row = products.of(l.item, l.name);
    row.lostQuantity += l.quantity;
    row.lostAmount += l.amount ?? 0;
    lostAmount += l.amount ?? 0;
  }
  return lostAmount;
}

/** Les Ventes : seules les tables qui ont vendu quelque chose comptent comme tables servies. */
function salesFigures(rows: Awaited<ReturnType<typeof loadDaySessions>>, from: number, slots: number[]) {
  const sales = { amount: 0, tables: 0, tablesWithCovers: 0, covers: 0, abandoned: 0 };
  const durations: number[] = [];
  for (const { session: s, total } of rows) {
    if (s.status === "abandoned") sales.abandoned += 1;
    if (total <= 0) continue;
    sales.amount += total;
    slots[slotOf(s.openedAt, from)]! += total;
    sales.tables += 1;
    if (s.guestCount !== undefined && s.guestCount > 0) {
      sales.tablesWithCovers += 1;
      sales.covers += s.guestCount;
    }
    if (s.closedAt !== undefined) durations.push(s.closedAt - s.openedAt);
  }
  return { sales, duration: histogramOf(durations) };
}

export async function computeServiceDay(ctx: ReadCtx, venue: Venue, window: DayWindow): Promise<DayMetrics> {
  const { from, to } = window;
  const slots = { orders: emptySlots(), sales: emptySlots(), collected: emptySlots() };
  const money = await loadDayMoney(ctx, venue, from, to);
  for (const p of money.payments) slots.collected[slotOf(p.createdAt, from)]! += p.amount;
  for (const r of money.refunds) slots.collected[slotOf(r.createdAt, from)]! -= r.amount;

  const products = productTable();
  const { sales, duration } = salesFigures(await loadDaySessions(ctx, venue, from, to), from, slots.sales);
  const kitchen = await orderFigures(ctx, await loadDayOrders(ctx, venue, from, to), from, products, slots.orders);
  const lostAmount = lossFigures(await loadDayLosses(ctx, venue, from, to), products);
  const adjustments = await loadDayAdjustments(ctx, venue, from, to);
  const debts = await loadDayDebts(ctx, venue, from, to);
  const discrepancies = (await loadDayRegisters(ctx, venue, from, to)).map((s) => discrepancyOf(s) ?? 0);

  return {
    sourceVersion: METRICS_VERSION,
    startHour: window.startHour,
    from,
    to,
    currency: venue.currency,
    orders: kitchen.orders,
    sales,
    collected: money.collected,
    byMethod: money.byMethod,
    slots,
    products: products.rows(),
    delays: { ...kitchen.delays, request: histogramOf(await loadDayRequests(ctx, venue, from, to)) },
    stations: kitchen.stations,
    tables: { duration, debts: debts.length, debtAmount: debts.reduce((s, x) => s + (x.debtAmount ?? 0), 0) },
    exceptions: {
      comps: adjustments.filter((a) => a.type === "comp").reduce((s, a) => s + a.amount, 0),
      discounts: adjustments.filter((a) => a.type !== "comp").reduce((s, a) => s + a.amount, 0),
      lostAmount,
      refunds: money.collected.refunded,
      voids: (await loadDayVoids(ctx, venue, from, to)).length,
      cashShort: discrepancies.filter((d) => d < 0).reduce((s, d) => s - d, 0),
      cashOver: discrepancies.filter((d) => d > 0).reduce((s, d) => s + d, 0),
      cashDiscrepancies: discrepancies.length,
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

/**
 * Qui peut voir les montants, et pourquoi pas. UNE décision pour tous les écrans (D-137, D-138) :
 * pendant un comptage à l'aveugle, AUCUN montant ne sort, quel que soit le jour affiché — une
 * caisse ouverte hier et comptée ce matin se trahirait par les ventes d'hier.
 */
export async function moneyAccess(
  ctx: ReadCtx,
  venue: Venue,
  allowed: boolean,
): Promise<{ money: boolean; hidden: "permission" | "blind" | null; counting: string[] }> {
  if (!allowed) return { money: false, hidden: "permission", counting: [] };
  const blind = await blindCountingSessions(ctx, venue);
  // Nommer la caisse : un comptage oublié tait tous les montants, il faut pouvoir le retrouver.
  if (blind.length > 0) return { money: false, hidden: "blind", counting: await Promise.all(blind.map((s) => drawerName(ctx, s))) };
  return { money: true, hidden: null, counting: [] };
}

/** « Pochette d'Awa », « Caisse principale » : le nom sous lequel l'équipe connaît une caisse. */
export async function drawerName(ctx: ReadCtx, s: Doc<"cashRegisterSessions">): Promise<string> {
  const holder = await memberName(ctx, s.holderMemberId);
  if (holder) return `Pochette de ${holder}`;
  const register = s.cashRegisterId ? await ctx.db.get(s.cashRegisterId) : null;
  return register?.name ?? "Caisse";
}
