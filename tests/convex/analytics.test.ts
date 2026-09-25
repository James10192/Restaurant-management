/**
 * Les chiffres du restaurant — tranche T6.
 *
 * « Maquis Awa », Cocody (Abidjan, UTC+0, jour de service à 4 h). Lundi 21 septembre 2026, un
 * service du soir. On vérifie ce que le gérant lira le lendemain : un seul Encaissé partout, des
 * délais honnêtes, rien d'argent pour qui n'en a pas le droit, rien pendant un comptage.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BUCKET_MS } from "../../convex/lib/analytics";
import { collect, serveAll, tableWithOrder, venue, type Venue } from "./moneyFixtures";
import { expectCode } from "./setup";

const DAY = "2026-09-21";
const at = (iso: string) => vi.setSystemTime(new Date(iso));

beforeEach(() => {
  vi.useFakeTimers();
  at(`${DAY}T19:00:00Z`);
});
afterEach(() => vi.useRealTimers());

const settle = (v: Venue) => v.t.finishAllScheduledFunctions(vi.runAllTimers);
const stored = (v: Venue, day: string) =>
  v.t.run((ctx) =>
    ctx.db
      .query("dailyMetrics")
      .withIndex("by_venue_date", (q) => q.eq("venueId", v.cocody).eq("businessDate", day))
      .unique(),
  );
/** Le milieu de la case de 30 s d'une durée : ce que rend une médiane. */
const bucket = (ms: number) => Math.floor(ms / BUCKET_MS) * BUCKET_MS + BUCKET_MS / 2;

async function ticketOf(v: Venue, orderId: Id<"orders">) {
  const [t] = await v.t.run((ctx) => ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", orderId)).collect());
  return t!;
}

/** Une soirée : table 1 servie et payée par Wave ; table 2 annulée alors que la cuisine avait commencé. */
async function evening(v: Venue) {
  const a = await tableWithOrder(v);
  await serveAll(v, a.orderId);
  await collect(v, a.sessionId, { method: "mobile_money", amount: 13500, wallet: "Wave" });
  await v.waiter.as.mutation(api.sessions.close, { venueId: v.cocody, sessionId: a.sessionId });
  const b = await tableWithOrder(v, v.table2);
  await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: (await ticketOf(v, b.orderId))._id, action: "start" });
  await v.owner.as.mutation(api.orders.cancelOrder, { venueId: v.cocody, orderId: b.orderId, reason: "Table partie" });
  return { a, b };
}

describe("un seul Encaissé (D-139)", () => {
  test("le rapport, « aujourd'hui », la ligne du jour clos et la période disent la même somme", async () => {
    const v = await venue();
    await evening(v);

    const live = await v.owner.as.query(api.analytics.day, { venueId: v.cocody });
    const report = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody });
    expect([live.inProgress, live.orders.count, live.tables.count]).toEqual([true, 2, 2]);
    expect(live.money!.collected.net).toBe(13500);
    expect(report.totals!.net).toBe(13500);
    // Ventes : la table annulée ne vend rien ; ses plats commencés sont des pertes (D-145).
    expect([live.money!.sales, live.money!.exceptions.lostAmount]).toEqual([13500, 13500]);

    // Le lendemain à 5 h 30 : J-1 se clôt, une heure après la fin de son jour (deux établissements,
    // J-1 et J-2 chacun : c'est la première clôture).
    at("2026-09-22T05:30:00Z");
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 4 });
    await settle(v);
    const row = (await stored(v, DAY))!;
    const closed = await v.owner.as.query(api.analytics.day, { venueId: v.cocody, day: DAY });
    const period = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    const reportAfter = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody, day: DAY });
    expect([row.collected.net, closed.money!.collected.net, period.money!.collected.net, reportAfter.totals!.net]).toEqual([13500, 13500, 13500, 13500]);
    expect(closed.inProgress).toBe(false);
    expect(row.products.find((p) => p.name === "Poulet braisé")).toMatchObject({ quantity: 2, amount: 7000, lostQuantity: 2, lostAmount: 7000 });

    // Rejouer la tâche ne réécrit rien ; une ligne par jour.
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 0 });
    // Un jour pas encore clos ne s'écrit pas.
    await expectCode(v.t.mutation(internal.analytics.computeDay, { venueId: v.cocody, day: "2026-09-22" }), "INVALID_ARGUMENT");
  });

  test("une table encore ouverte qui commande après minuit compte pour sa soirée : J-2 la rattrape", async () => {
    const v = await venue();
    const late = await tableWithOrder(v);
    at("2026-09-22T05:30:00Z");
    await v.t.mutation(internal.analytics.closeDays, {});
    await settle(v);
    expect((await stored(v, DAY))!.sales.amount).toBe(13500);

    // La table, installée lundi soir, commande encore le mardi matin.
    await v.waiter.as.mutation(api.orders.submit, {
      venueId: v.cocody,
      sessionId: late.sessionId,
      lines: [{ productId: v.products.bissap, optionIds: [], quantity: 2, courseNumber: 1 }],
      heldCourses: [],
      idempotencyKey: "test-chiffres-apres-minuit-0001",
    });
    // Mercredi 5 h 30 : J-2 (lundi) se recalcule une fois, J-1 (mardi) se clôt — dans chacun des
    // deux établissements.
    at("2026-09-23T05:30:00Z");
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 4 });
    await settle(v);
    expect((await stored(v, DAY))!.sales.amount).toBe(13500 + 1000);
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 0 });
  });
});

describe("qui voit l'argent (D-137, D-138)", () => {
  test("le chef de rang voit les commandes et les délais, jamais un montant ; le serveur, rien", async () => {
    const v = await venue();
    await evening(v);
    const floor = await v.floor.as.query(api.analytics.day, { venueId: v.cocody });
    expect([floor.orders.count, floor.money, floor.moneyHidden]).toEqual([2, null, "permission"]);
    expect(floor.products.every((p) => p.amount === null)).toBe(true);
    expect(floor.comparison.sales).toBeNull();
    await expectCode(v.waiter.as.query(api.analytics.day, { venueId: v.cocody }), "FORBIDDEN");
  });

  test("pendant un comptage à l'aveugle, aucune somme du jour ne sort, même aux analyses", async () => {
    const v = await venue();
    const drawer = await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 10000 });
    await evening(v);
    await v.cashier.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer });
    const day = await v.owner.as.query(api.analytics.day, { venueId: v.cocody });
    const period = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect([day.money, day.moneyHidden, period.money, period.moneyHidden]).toEqual([null, "blind", null, "blind"]);
    await v.cashier.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: drawer, countedAmount: 10000 });
    expect((await v.owner.as.query(api.analytics.day, { venueId: v.cocody })).money!.collected.net).toBe(13500);
  });

  test("les données de simulation n'entrent pas dans les chiffres d'un établissement réel", async () => {
    const v = await venue();
    const { a } = await evening(v);
    await v.t.run(async (ctx) => {
      await ctx.db.patch(a.sessionId, { isSimulation: true });
      for (const p of await ctx.db.query("payments").collect()) await ctx.db.patch(p._id, { isSimulation: true });
    });
    const day = await v.owner.as.query(api.analytics.day, { venueId: v.cocody });
    expect([day.orders.count, day.tables.count, day.money!.collected.net]).toEqual([1, 1, 0]);
  });
});

describe("les délais, honnêtes (D-143)", () => {
  test("médiane de préparation et de passe ; un bon marqué prêt sans démarrage est compté à part", async () => {
    const v = await venue();
    const a = await tableWithOrder(v);
    const t1 = await ticketOf(v, a.orderId);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t1._id, action: "start" });
    vi.advanceTimersByTime(5 * 60_000);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t1._id, action: "ready" });
    vi.advanceTimersByTime(2 * 60_000);
    await v.waiter.as.mutation(api.orders.serveTicket, { venueId: v.cocody, ticketId: t1._id });

    // Table 2 : prêt d'un coup, sans « démarrer ». Sa préparation mesurerait zéro.
    const b = await tableWithOrder(v, v.table2);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: (await ticketOf(v, b.orderId))._id, action: "ready" });

    const day = await v.owner.as.query(api.analytics.day, { venueId: v.cocody });
    expect(day.delays.prep).toMatchObject({ median: bucket(5 * 60_000), count: 1 });
    expect(day.delays.pass).toMatchObject({ median: bucket(2 * 60_000), count: 1 });
    expect([day.delays.readyWithoutStart, day.delays.tickets]).toEqual([1, 2]);
    // Des commandes saisies par le personnel n'ont pas de délai d'acceptation.
    expect(day.delays.acceptance.count).toBe(0);
  });
});

describe("comparer (D-142)", () => {
  test("rien sous trois jours comparables ; à la même heure au-delà", async () => {
    const v = await venue();
    await evening(v);
    at("2026-09-22T05:30:00Z");
    await v.t.mutation(internal.analytics.closeDays, {});
    await settle(v);
    const base = (await stored(v, DAY))!;

    const copy = async (day: string, orders: number) =>
      v.t.run(async (ctx) => {
        const { _id, _creationTime, ...rest } = base;
        void _id;
        void _creationTime;
        const slots = { ...rest.slots, orders: rest.slots.orders.map(() => 0) };
        slots.orders[0] = orders;
        await ctx.db.insert("dailyMetrics", { ...rest, businessDate: day, orders: { ...rest.orders, count: orders }, slots });
      });
    // Lundi 28, 19 h, le jour est en cours. Deux lundis ouverts (le 21 et le 14) : pas de comparaison.
    await copy("2026-09-14", 4);
    at("2026-09-28T19:00:00Z");
    expect((await v.owner.as.query(api.analytics.day, { venueId: v.cocody })).comparison.orders).toBeNull();
    // Un lundi fermé (aucune commande) ne compte pas ; un troisième lundi ouvert, si.
    await copy("2026-09-07", 0);
    expect((await v.owner.as.query(api.analytics.day, { venueId: v.cocody })).comparison.orders).toBeNull();
    await copy("2026-08-31", 6);
    const cmp = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody })).comparison;
    // À 19 h, le 21 avait reçu ses 2 commandes, le 14 ses 4, le 31 ses 6 : la médiane est 4.
    expect([cmp.orders, cmp.days]).toEqual([{ now: 0, usual: 4 }, 3]);
  });
});

describe("la tour de contrôle (D-133, D-147)", () => {
  test("« En cuisine » liste les bons de tous les postes, du plus ancien au plus récent", async () => {
    const v = await venue();
    const a = await tableWithOrder(v);
    vi.advanceTimersByTime(60_000);
    const b = await tableWithOrder(v, v.table2);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: (await ticketOf(v, b.orderId))._id, action: "start" });
    const list = await v.waiter.as.query(api.kitchen.inProduction, { venueId: v.cocody });
    expect(list.map((t) => [t.tableNumber, t.status])).toEqual([
      ["1", "queued"],
      ["2", "started"],
    ]);
    expect(list[0]!.station.lateThresholdMinutes).toBe(20);
    await serveAll(v, a.orderId);
    expect((await v.waiter.as.query(api.kitchen.inProduction, { venueId: v.cocody })).map((t) => t.tableNumber)).toEqual(["2"]);
  });

  test("alertes : caisse d'hier encore ouverte, rupture sans échéance ; chacune à qui peut agir", async () => {
    const v = await venue();
    await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 5000 });
    await v.owner.as.mutation(api.availability.setProduct, { venueId: v.cocody, productId: v.products.alloco, isAvailable: false });
    await v.owner.as.mutation(api.availability.setProduct, { venueId: v.cocody, productId: v.products.bissap, isAvailable: false, until: Date.now() + 3_600_000 });
    // Le soir même, la caisse est d'aujourd'hui : rien à signaler.
    expect((await v.owner.as.query(api.tower.alerts, { venueId: v.cocody })).staleCash).toEqual([]);
    at("2026-09-22T10:00:00Z");
    const owner = await v.owner.as.query(api.tower.alerts, { venueId: v.cocody });
    expect(owner.staleCash.map((c) => c.name)).toEqual(["Caisse principale"]);
    expect(owner.soldOut.map((p) => p.name)).toEqual(["Alloco"]);
    // Le serveur n'a ni la clôture de caisse ni la carte : ces alertes ne le concernent pas. Il lit
    // les paiements, donc le nombre d'alertes de paiement ouvertes.
    expect(await v.waiter.as.query(api.tower.alerts, { venueId: v.cocody })).toEqual({ staleCash: [], soldOut: [], paymentAlerts: 0 });
  });
});
