/**
 * Les chiffres du restaurant — Joliba (tranche T6)
 *
 * Trois lectures, une seule source de calcul (`computeServiceDay`, D-139) :
 *   - `day` : un jour de service, en cours ou clos, comparé aux mêmes jours de semaine (D-142) ;
 *   - `period` : une période, lue dans `dailyMetrics`, plus le jour en cours s'il en fait partie ;
 *   - la clôture horaire, qui écrit `dailyMetrics` pour J-1 puis recalcule J-2 (D-141).
 *
 * Un montant exige `analytics.financial.read`, un compte ou un délai `analytics.read` (D-137).
 * Pendant un comptage à l'aveugle, aucune somme du jour ne sort (D-138).
 */

import { v } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  comparableValue,
  dayCount,
  delaySummary,
  emptySlots,
  isComparablePeriod,
  median,
  mergeHistograms,
  sameWeekdaysBefore,
  serviceDayOf,
  shiftDay,
  slotOf,
  SLOTS,
  startHourOf,
  sumUntil,
  weekdayOf,
  type Histogram,
} from "./lib/analytics";
import { serviceDayWindow } from "./lib/billing";
import type { DayMetrics } from "./lib/dayMetrics";
import { invalid } from "./lib/errors";
import { requirePermission, type ReadCtx } from "./lib/guards";
import { settingsOf } from "./lib/service";
import { blindCountingSessions, computeServiceDay, METRICS_VERSION } from "./lib/serviceDay";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Au-delà, la lecture d'une période coûterait trop pour un seul écran. */
const MAX_PERIOD_DAYS = 92;
/**
 * Une part d'annulations en cuisine, d'offerts et de remises qui dépasse deux fois celle des
 * jours comparables se signale (D-148 : constante documentée, réglable quand le terrain le dira).
 */
const EXCEPTION_FACTOR = 2;

type Access = { money: boolean; hidden: "permission" | "blind" | null };

async function accessOf(ctx: ReadCtx, actor: Awaited<ReturnType<typeof requirePermission>>, venue: Doc<"venues">, includesToday: boolean): Promise<Access> {
  if (!actor.permissions.has("analytics.financial.read")) return { money: false, hidden: "permission" };
  if (includesToday && (await blindCountingSessions(ctx, venue)).length > 0) return { money: false, hidden: "blind" };
  return { money: true, hidden: null };
}

async function storedDay(ctx: ReadCtx, venueId: Id<"venues">, day: string): Promise<Doc<"dailyMetrics"> | null> {
  return ctx.db
    .query("dailyMetrics")
    .withIndex("by_venue_date", (q) => q.eq("venueId", venueId).eq("businessDate", day))
    .unique();
}

function delays(m: Pick<DayMetrics, "delays">) {
  const d = m.delays;
  return {
    acceptance: delaySummary(d.acceptance),
    waitStart: delaySummary(d.waitStart),
    prep: delaySummary(d.prep),
    pass: delaySummary(d.pass),
    request: delaySummary(d.request),
    readyWithoutStart: d.readyWithoutStart,
    tickets: d.tickets,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Un jour
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Un jour de service : en cours (lu en direct, jusqu'à maintenant) ou clos (lu dans
 * `dailyMetrics`, recalculé en direct s'il n'y est pas encore). Le jour en cours se compare à la
 * même heure des jours comparables, un jour clos à leur journée entière.
 */
export const day = query({
  args: { venueId: v.id("venues"), day: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "analytics.read", { venueId: args.venueId });
    const venue = actor.venue;
    const settings = await settingsOf(ctx, venue._id);
    const now = Date.now();
    const today = serviceDayOf(now, venue, settings);
    const target = args.day ?? today;
    if (!DAY.test(target) || target > today) throw invalid("Jour invalide.");
    const inProgress = target === today;
    const stored = inProgress ? null : await storedDay(ctx, venue._id, target);
    const m: DayMetrics = stored ?? (await computeServiceDay(ctx, venue, target, startHourOf(settings)));
    const access = await accessOf(ctx, actor, venue, inProgress);

    // « À la même heure » : le créneau d'une demi-heure où l'on se trouve, compté depuis le début du jour.
    const untilSlot = inProgress ? slotOf(now, m.from) : SLOTS - 1;
    const comparables: DayMetrics[] = [];
    for (const d of sameWeekdaysBefore(target)) {
      const row = await storedDay(ctx, venue._id, d);
      if (row) comparables.push(row);
    }
    const reference = (pick: (row: DayMetrics) => number) =>
      comparableValue(comparables.map((row) => ({ orders: row.orders.count, value: pick(row) })));
    const exceptionShare = (row: DayMetrics) =>
      row.sales.amount > 0 ? (row.exceptions.lostAmount + row.exceptions.comps + row.exceptions.discounts) / row.sales.amount : 0;
    const orders = reference((row) => sumUntil(row.slots.orders, untilSlot));
    const shareRef = inProgress ? null : reference((row) => Math.round(exceptionShare(row) * 10_000));

    return {
      day: target,
      today,
      inProgress,
      timezone: venue.timezone,
      currency: venue.currency,
      startHour: m.startHour,
      from: m.from,
      to: m.to,
      orders: m.orders,
      tables: { count: m.sales.tables, withCovers: m.sales.tablesWithCovers, covers: m.sales.covers, abandoned: m.sales.abandoned, debts: m.tables.debts },
      duration: delaySummary(m.tables.duration),
      delays: delays(m),
      stations: m.stations.map((s) => ({ name: s.name, prep: delaySummary(s.prep), waitStart: delaySummary(s.waitStart) })),
      ordersBySlot: m.slots.orders,
      products: m.products.slice(0, 10).map((p) => ({ name: p.name, quantity: p.quantity, lostQuantity: p.lostQuantity, amount: access.money ? p.amount : null })),
      moneyHidden: access.hidden,
      money: access.money
        ? {
            sales: m.sales.amount,
            averageTicket: m.sales.tables > 0 ? Math.round(m.sales.amount / m.sales.tables) : null,
            collected: m.collected,
            byMethod: m.byMethod,
            exceptions: m.exceptions,
            debtAmount: m.tables.debtAmount,
          }
        : null,
      comparison: {
        /** Combien de jours comparables ont servi ; en dessous de 3, rien ne se compare (D-142). */
        days: orders?.days ?? comparables.filter((row) => row.orders.count > 0).length,
        untilSlot,
        orders: orders ? { now: sumUntil(m.slots.orders, untilSlot), usual: orders.value } : null,
        sales: access.money ? pair(reference((row) => sumUntil(row.slots.sales, untilSlot)), sumUntil(m.slots.sales, untilSlot)) : null,
        collected: access.money ? pair(reference((row) => sumUntil(row.slots.collected, untilSlot)), sumUntil(m.slots.collected, untilSlot)) : null,
        /** La seule règle comparative (D-134) : trop d'annulations en cuisine, d'offerts et de remises. */
        exceptionsAlert:
          access.money && shareRef !== null && shareRef.value > 0 && exceptionShare(m) * 10_000 > EXCEPTION_FACTOR * shareRef.value
            ? { share: exceptionShare(m), usual: shareRef.value / 10_000 }
            : null,
      },
    };
  },
});

function pair(ref: { value: number } | null, now: number) {
  return ref ? { now, usual: ref.value } : null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Une période
 * ──────────────────────────────────────────────────────────────────────────── */

type Aggregate = ReturnType<typeof emptyAggregate>;

function emptyAggregate() {
  return {
    days: [] as { day: string; orders: number; sales: number; collected: number }[],
    orders: 0,
    fromGuests: 0,
    sales: 0,
    tables: 0,
    tablesWithCovers: 0,
    covers: 0,
    abandoned: 0,
    collected: { gross: 0, refunded: 0, net: 0, payments: 0 },
    byMethod: new Map<string, { label: string; amount: number; count: number }>(),
    products: new Map<string, { name: string; quantity: number; amount: number; lostQuantity: number; lostAmount: number }>(),
    delays: { acceptance: [] as Histogram[], waitStart: [] as Histogram[], prep: [] as Histogram[], pass: [] as Histogram[], request: [] as Histogram[], readyWithoutStart: 0, tickets: 0 },
    stations: new Map<string, { name: string; prep: Histogram[]; waitStart: Histogram[] }>(),
    duration: [] as Histogram[],
    debts: 0,
    debtAmount: 0,
    exceptions: { comps: 0, discounts: 0, lostAmount: 0, refunds: 0, voids: 0, cashDiscrepancy: 0, cashDiscrepancies: 0 },
    /** Commandes par créneau, cumulées par jour de semaine, et le nombre de jours ouverts. */
    weekdays: Array.from({ length: 7 }, () => ({ days: 0, orders: emptySlots() })),
    startHour: null as number | null,
  };
}

function add(agg: Aggregate, day: string, m: DayMetrics) {
  agg.days.push({ day, orders: m.orders.count, sales: m.sales.amount, collected: m.collected.net });
  agg.orders += m.orders.count;
  agg.fromGuests += m.orders.fromGuests;
  agg.sales += m.sales.amount;
  agg.tables += m.sales.tables;
  agg.tablesWithCovers += m.sales.tablesWithCovers;
  agg.covers += m.sales.covers;
  agg.abandoned += m.sales.abandoned;
  for (const k of ["gross", "refunded", "net", "payments"] as const) agg.collected[k] += m.collected[k];
  for (const x of m.byMethod) {
    const row = agg.byMethod.get(x.label) ?? { label: x.label, amount: 0, count: 0 };
    row.amount += x.amount;
    row.count += x.count;
    agg.byMethod.set(x.label, row);
  }
  for (const p of m.products) {
    const key = p.productId ?? `nom:${p.name}`;
    const row = agg.products.get(key) ?? { name: p.name, quantity: 0, amount: 0, lostQuantity: 0, lostAmount: 0 };
    row.quantity += p.quantity;
    row.amount += p.amount;
    row.lostQuantity += p.lostQuantity;
    row.lostAmount += p.lostAmount;
    agg.products.set(key, row);
  }
  for (const k of ["acceptance", "waitStart", "prep", "pass", "request"] as const) agg.delays[k].push(m.delays[k]);
  agg.delays.readyWithoutStart += m.delays.readyWithoutStart;
  agg.delays.tickets += m.delays.tickets;
  for (const s of m.stations) {
    const row = agg.stations.get(s.stationId) ?? { name: s.name, prep: [], waitStart: [] };
    row.prep.push(s.prep);
    row.waitStart.push(s.waitStart);
    agg.stations.set(s.stationId, row);
  }
  agg.duration.push(m.tables.duration);
  agg.debts += m.tables.debts;
  agg.debtAmount += m.tables.debtAmount;
  for (const k of Object.keys(agg.exceptions) as (keyof Aggregate["exceptions"])[]) agg.exceptions[k] += m.exceptions[k];
  // Un jour sans commande est un jour fermé : il ne tire pas la moyenne de son jour de semaine vers zéro.
  if (m.orders.count > 0) {
    const w = agg.weekdays[weekdayOf(day)]!;
    w.days += 1;
    m.slots.orders.forEach((n, i) => (w.orders[i]! += n));
  }
  agg.startHour = m.startHour;
}

async function aggregate(ctx: QueryCtx, venue: Doc<"venues">, settings: Doc<"venueSettings">, from: string, to: string, today: string) {
  const agg = emptyAggregate();
  const rows = await ctx.db
    .query("dailyMetrics")
    .withIndex("by_venue_date", (q) => q.eq("venueId", venue._id).gte("businessDate", from).lte("businessDate", to))
    .collect();
  const seen = new Set<string>();
  for (const row of rows) {
    add(agg, row.businessDate, row);
    seen.add(row.businessDate);
  }
  if (from <= today && today <= to) {
    add(agg, today, await computeServiceDay(ctx, venue, today, startHourOf(settings)));
    seen.add(today);
  }
  agg.days.sort((a, b) => a.day.localeCompare(b.day));
  const missing = dayCount(from, to) - seen.size;
  return { agg, missing };
}

/**
 * Une période : ce qui se vend, quand on est chargé, où le service coince, comment tournent les
 * tables, et l'argent. Les jours clos viennent de `dailyMetrics` ; le jour en cours, s'il fait
 * partie de la période, est calculé en direct.
 */
export const period = query({
  /** Sans dates : les 7 derniers jours, aujourd'hui compris. */
  args: { venueId: v.id("venues"), from: v.optional(v.string()), to: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const actor = await requirePermission(ctx, "analytics.read", { venueId: a.venueId });
    const venue = actor.venue;
    const settings = await settingsOf(ctx, venue._id);
    const today = serviceDayOf(Date.now(), venue, settings);
    const to = a.to ?? today;
    const args = { from: a.from ?? shiftDay(to, -6), to };
    if (!DAY.test(args.from) || !DAY.test(args.to) || args.from > args.to) throw invalid("Période invalide.");
    const length = dayCount(args.from, args.to);
    if (length > MAX_PERIOD_DAYS) throw invalid(`Une période compte au plus ${MAX_PERIOD_DAYS} jours.`);
    const access = await accessOf(ctx, actor, venue, args.from <= today && today <= args.to);
    const { agg, missing } = await aggregate(ctx, venue, settings, args.from, args.to, today);

    // La période précédente, de même longueur, seulement si elle est de même nature (D-142).
    let previous = null;
    if (isComparablePeriod(length)) {
      const prev = await aggregate(ctx, venue, settings, shiftDay(args.from, -length), shiftDay(args.to, -length), today);
      previous = {
        from: shiftDay(args.from, -length),
        to: shiftDay(args.to, -length),
        missing: prev.missing,
        orders: prev.agg.orders,
        sales: access.money ? prev.agg.sales : null,
        collected: access.money ? prev.agg.collected.net : null,
      };
    }

    const products = [...agg.products.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    const merged = (hs: Histogram[]) => delaySummary(mergeHistograms(hs));
    return {
      from: args.from,
      to: args.to,
      today,
      length,
      /** Jours de la période sans ligne calculée (avant la mise en service, ou pas encore clos). */
      missing,
      currency: venue.currency,
      timezone: venue.timezone,
      startHour: agg.startHour ?? startHourOf(settings),
      orders: { count: agg.orders, fromGuests: agg.fromGuests },
      tables: { count: agg.tables, withCovers: agg.tablesWithCovers, covers: agg.covers, abandoned: agg.abandoned, debts: agg.debts },
      duration: merged(agg.duration),
      delays: {
        acceptance: merged(agg.delays.acceptance),
        waitStart: merged(agg.delays.waitStart),
        prep: merged(agg.delays.prep),
        pass: merged(agg.delays.pass),
        request: merged(agg.delays.request),
        readyWithoutStart: agg.delays.readyWithoutStart,
        tickets: agg.delays.tickets,
      },
      stations: [...agg.stations.values()].map((s) => ({ name: s.name, prep: merged(s.prep), waitStart: merged(s.waitStart) })).sort((a, b) => a.name.localeCompare(b.name)),
      products: products.map((p) => ({ ...p, amount: access.money ? p.amount : null, lostAmount: access.money ? p.lostAmount : null })),
      weekdays: agg.weekdays.map((w, weekday) => ({ weekday, days: w.days, averageOrders: w.days > 0 ? w.orders.map((n) => n / w.days) : null })),
      days: agg.days.map((d) => ({ day: d.day, orders: d.orders, sales: access.money ? d.sales : null, collected: access.money ? d.collected : null })),
      moneyHidden: access.hidden,
      money: access.money
        ? {
            sales: agg.sales,
            averageTicket: agg.tables > 0 ? Math.round(agg.sales / agg.tables) : null,
            collected: agg.collected,
            byMethod: [...agg.byMethod.values()].sort((a, b) => b.amount - a.amount),
            exceptions: agg.exceptions,
            debtAmount: agg.debtAmount,
            medianDailySales: median(agg.days.filter((d) => d.orders > 0).map((d) => d.sales)),
          }
        : null,
      previous,
    };
  },
});

/* ────────────────────────────────────────────────────────────────────────────
 * La clôture (D-141)
 * ──────────────────────────────────────────────────────────────────────────── */

const HOUR = 3_600_000;

/**
 * Toutes les heures : pour chaque établissement, J-1 se clôt une heure après la fin de sa
 * fenêtre, et J-2 se recalcule une fois, un jour plus tard, pour les corrections tardives. Chaque
 * jour à écrire part dans sa propre transaction : la tâche garde une taille constante.
 */
export const closeDays = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let scheduled = 0;
    for (const venue of await ctx.db.query("venues").collect()) {
      if (venue.status === "archived") continue;
      const settings = await settingsOf(ctx, venue._id);
      const today = serviceDayOf(now, venue, settings);
      for (const [lag, delay] of [
        [1, HOUR],
        [2, 25 * HOUR],
      ] as const) {
        const d = shiftDay(today, -lag);
        const row = await storedDay(ctx, venue._id, d);
        const startHour = row?.startHour ?? startHourOf(settings);
        const due = serviceDayWindow(d, venue.timezone, startHour).to + delay;
        if (now < due) continue;
        if (row && row.computedAt >= due && row.sourceVersion === METRICS_VERSION) continue;
        await ctx.scheduler.runAfter(0, internal.analytics.computeDay, { venueId: venue._id, day: d });
        scheduled += 1;
      }
    }
    return { scheduled };
  },
});

/**
 * Calcule et écrit un jour. Idempotent : recalculer écrase la ligne. Un jour déjà écrit garde
 * son heure de début : changer le réglage ne redécoupe pas le passé.
 */
export const computeDay = internalMutation({
  args: { venueId: v.id("venues"), day: v.string() },
  handler: async (ctx, args) => {
    if (!DAY.test(args.day)) throw invalid("Jour invalide.");
    const venue = await ctx.db.get(args.venueId);
    if (!venue) return null;
    const settings = await settingsOf(ctx, venue._id);
    if (args.day >= serviceDayOf(Date.now(), venue, settings)) throw invalid("Ce jour n'est pas encore clos.");
    const existing = await storedDay(ctx, venue._id, args.day);
    const metrics = await computeServiceDay(ctx, venue, args.day, existing?.startHour ?? startHourOf(settings));
    const row = { venueId: venue._id, businessDate: args.day, computedAt: Date.now(), ...metrics };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("dailyMetrics", row);
    return { orders: metrics.orders.count };
  },
});

/**
 * Reconstruire une plage de jours (mise en service, nouvelle version du calcul). Chaque jour
 * part dans sa transaction :
 *     npx convex run analytics:rebuild '{"venueId":"…","from":"2026-06-01","to":"2026-09-24"}'
 */
export const rebuild = internalMutation({
  args: { venueId: v.id("venues"), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    if (!DAY.test(args.from) || !DAY.test(args.to) || args.from > args.to) throw invalid("Période invalide.");
    const days = dayCount(args.from, args.to);
    if (days > 400) throw invalid("Au plus 400 jours par reconstruction.");
    for (let i = 0; i < days; i++) {
      await ctx.scheduler.runAfter(i * 200, internal.analytics.computeDay, { venueId: args.venueId, day: shiftDay(args.from, i) });
    }
    return { scheduled: days };
  },
});
