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

    const live = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!;
    const today = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    const report = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody });
    // La commande annulée n'est pas une commande, sa table n'est pas une table servie : le ticket
    // moyen n'est pas divisé par une table qui n'a rien vendu.
    expect([live.inProgress, live.orders.count, live.tables.count]).toEqual([true, 1, 1]);
    expect([today.money!.collected.net, report.totals!.net]).toEqual([13500, 13500]);
    // Ventes : la table annulée ne vend rien ; ses plats commencés sont des pertes (D-145).
    expect([live.money!.sales, live.money!.averageTicket, today.money!.exceptions.lostAmount]).toEqual([13500, 13500, 13500]);

    // Le lendemain à 5 h 30 : J-1 se clôt, une heure après la fin de son jour (deux établissements,
    // J-1 et J-2 chacun : c'est la première clôture).
    at("2026-09-22T05:30:00Z");
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 4, failed: [] });
    await settle(v);
    const row = (await stored(v, DAY))!;
    const closed = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody, day: DAY }))!;
    const period = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    const reportAfter = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody, day: DAY });
    expect([row.collected.net, period.money!.collected.net, reportAfter.totals!.net]).toEqual([13500, 13500, 13500]);
    expect(closed.money!.sales).toBe(13500);
    expect(closed.inProgress).toBe(false);
    expect(row.products.find((p) => p.name === "Poulet braisé")).toMatchObject({ quantity: 2, amount: 7000, lostQuantity: 2, lostAmount: 7000 });

    // Rejouer la tâche ne réécrit rien ; une ligne par jour.
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 0, failed: [] });
    // Un jour pas encore clos ne s'écrit pas ; un jour à venir ne se lit pas, sans erreur.
    await expectCode(v.t.mutation(internal.analytics.computeDay, { venueId: v.cocody, day: "2026-09-22" }), "INVALID_ARGUMENT");
    expect(await v.owner.as.query(api.analytics.day, { venueId: v.cocody, day: "2026-09-30" })).toBeNull();
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
    // Le jour de lundi, déjà écrit, se recalcule aussitôt : rapport et analyses ne divergent pas.
    await settle(v);
    expect((await stored(v, DAY))!.sales.amount).toBe(13500 + 1000);
    // Mercredi 5 h 30 : J-2 (lundi) se recalcule une fois, J-1 (mardi) se clôt — dans chacun des
    // deux établissements.
    at("2026-09-23T05:30:00Z");
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 4, failed: [] });
    await settle(v);
    expect((await stored(v, DAY))!.sales.amount).toBe(13500 + 1000);
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 0, failed: [] });
  });
});

describe("qui voit l'argent (D-137, D-138)", () => {
  test("le chef de rang voit les commandes et les délais, jamais un montant ; le serveur, rien", async () => {
    const v = await venue();
    await evening(v);
    const floor = (await v.floor.as.query(api.analytics.day, { venueId: v.cocody }))!;
    expect([floor.orders.count, floor.money, floor.moneyHidden]).toEqual([1, null, "permission"]);
    expect(floor.comparison.sales).toBeNull();
    const period = await v.floor.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect([period.products.length > 0, period.products.every((p) => p.amount === null), period.money]).toEqual([true, true, null]);
    await expectCode(v.waiter.as.query(api.analytics.day, { venueId: v.cocody }), "FORBIDDEN");
  });

  test("pendant un comptage à l'aveugle, aucune somme du jour ne sort, même aux analyses", async () => {
    const v = await venue();
    const drawer = await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 10000 });
    await evening(v);
    await v.cashier.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer });
    const day = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!;
    const period = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect([day.money, day.moneyHidden, period.money, period.moneyHidden]).toEqual([null, "blind", null, "blind"]);
    await v.cashier.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: drawer, countedAmount: 10000 });
    expect((await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!.money!.sales).toBe(13500);
  });

  test("une caisse ouverte hier et comptée ce matin : les ventes d'HIER se taisent aussi (B1)", async () => {
    const v = await venue();
    const drawer = await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 10000 });
    await evening(v);
    at("2026-09-22T05:30:00Z");
    await v.t.mutation(internal.analytics.closeDays, {});
    await settle(v);
    at("2026-09-22T10:00:00Z");
    await v.cashier.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer });
    const yesterday = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody, day: DAY }))!;
    const period = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    const report = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody, day: DAY });
    expect([yesterday.money, yesterday.moneyHidden, period.money, period.days.every((d) => d.sales === null), report.totals]).toEqual([null, "blind", null, true, null]);
  });

  test("les données de simulation n'entrent pas dans les chiffres d'un établissement réel", async () => {
    const v = await venue();
    const a = await tableWithOrder(v);
    await collect(v, a.sessionId, { method: "mobile_money", amount: 13500, wallet: "Wave" });
    await tableWithOrder(v, v.table2);
    await v.t.run(async (ctx) => {
      await ctx.db.patch(a.sessionId, { isSimulation: true });
      for (const p of await ctx.db.query("payments").collect()) await ctx.db.patch(p._id, { isSimulation: true });
    });
    const day = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!;
    const period = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect([day.orders.count, day.tables.count, day.money!.sales, period.money!.collected.net]).toEqual([1, 1, 13500, 0]);
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

    const day = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect(day.delays.prep).toMatchObject({ median: bucket(5 * 60_000), count: 1 });
    expect(day.delays.pass).toMatchObject({ median: bucket(2 * 60_000), count: 1 });
    expect([day.delays.readyWithoutStart, day.delays.tickets]).toEqual([1, 2]);
    // Des commandes saisies par le personnel n'ont pas de délai d'acceptation.
    expect(day.delays.acceptance.count).toBe(0);
  });

  test("des gestes rejoués au retour du réseau, un bon rappelé : aucun délai de cuisine inventé", async () => {
    const v = await venue();
    // « Commencer » puis « Prêt », faits pendant une coupure et rejoués à une seconde d'écart par
    // la file au retour du réseau : leur heure sur l'appareil dit qu'ils ont attendu.
    const a = await tableWithOrder(v);
    const replayed = (await ticketOf(v, a.orderId))._id;
    const madeAt = Date.now();
    vi.advanceTimersByTime(10 * 60_000);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: replayed, action: "start", ageMs: Date.now() - madeAt });
    vi.advanceTimersByTime(1_000);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: replayed, action: "ready", ageMs: Date.now() - (madeAt + 5 * 60_000) });
    // Rappelé : il garde son premier début et prend un second « prêt ».
    const b = await tableWithOrder(v, v.table2);
    const recalled = (await ticketOf(v, b.orderId))._id;
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: recalled, action: "start" });
    vi.advanceTimersByTime(5 * 60_000);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: recalled, action: "ready" });
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: recalled, action: "recall" });
    vi.advanceTimersByTime(3 * 60_000);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: recalled, action: "ready" });
    await v.waiter.as.mutation(api.orders.serveTicket, { venueId: v.cocody, ticketId: recalled });

    const day = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    // Ni préparation, ni attente, ni passage mesurés ; aucun n'est « prêt sans démarrage » pour autant.
    expect([day.delays.prep.count, day.delays.waitStart.count, day.delays.pass.count, day.delays.readyWithoutStart, day.delays.tickets]).toEqual([0, 1, 0, 0, 2]);
    // Ce qui sort des délais se compte : l'écran le dit au lieu de réduire l'échantillon en silence.
    expect(day.delays.replayed).toBe(1);
  });

  test("un geste rejoué qui ne change rien (déjà fait en direct) ne marque pas le bon", async () => {
    const v = await venue();
    const a = await tableWithOrder(v);
    const t = (await ticketOf(v, a.orderId))._id;
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t, action: "start", ageMs: 0 });
    vi.advanceTimersByTime(4 * 60_000);
    // Le même « Commencer », resté dans la file d'une autre tablette pendant dix minutes.
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t, action: "start", ageMs: 10 * 60_000 });
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t, action: "ready", ageMs: 0 });
    const day = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect([day.delays.prep.count, day.delays.replayed]).toEqual([1, 0]);
  });

  test("un « Servi » rejoué après une coupure ne mesure pas la passe, et se compte", async () => {
    const v = await venue();
    const a = await tableWithOrder(v);
    const t = (await ticketOf(v, a.orderId))._id;
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t, action: "start", ageMs: 0 });
    vi.advanceTimersByTime(4 * 60_000);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t, action: "ready", ageMs: 0 });
    const servedAt = Date.now() + 60_000;
    vi.advanceTimersByTime(20 * 60_000);
    await v.waiter.as.mutation(api.orders.serveTicket, { venueId: v.cocody, ticketId: t, ageMs: Date.now() - servedAt });
    const day = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect([day.delays.pass.count, day.delays.replayed, day.delays.tickets]).toEqual([0, 1, 1]);
  });

  test("une préparation rapide, faite en direct, compte : une bière en 20 s n'est pas un bon « prêt sans démarrage »", async () => {
    const v = await venue();
    const a = await tableWithOrder(v);
    const t = (await ticketOf(v, a.orderId))._id;
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t, action: "start", ageMs: 0 });
    vi.advanceTimersByTime(20_000);
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t, action: "ready", ageMs: 0 });
    const day = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: DAY, to: DAY });
    expect([day.delays.prep.count, day.delays.waitStart.count, day.delays.readyWithoutStart]).toEqual([1, 1, 0]);
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
    expect((await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!.comparison.orders).toBeNull();
    // Un lundi fermé (aucune commande) ne compte pas ; un troisième lundi ouvert, si.
    await copy("2026-09-07", 0);
    expect((await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!.comparison.orders).toBeNull();
    await copy("2026-08-31", 6);
    const cmp = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!.comparison;
    // Jusqu'à la dernière demi-heure écoulée (18 h 30 – 19 h) : le 21 n'avait encore rien reçu (sa
    // commande est de 19 h), le 14 ses 4, le 31 ses 6 : la médiane est 4.
    expect([cmp.orders, cmp.days]).toEqual([{ now: 0, usual: 4 }, 3]);
    // En cours de journée, les Ventes ne se comparent pas : les tables n'ont pas fini de commander.
    expect(cmp.sales).toBeNull();
  });

  test("un établissement qui n'offre jamais rien est alerté quand il se met à offrir (plancher)", async () => {
    const v = await venue();
    await evening(v);
    at("2026-09-22T05:30:00Z");
    await v.t.mutation(internal.analytics.closeDays, {});
    await settle(v);
    const base = (await stored(v, DAY))!;
    await v.t.run(async (ctx) => {
      const { _id, _creationTime, ...rest } = base;
      void _id;
      void _creationTime;
      const clean = { ...rest.exceptions, lostAmount: 0, comps: 0, discounts: 0 };
      for (const day of ["2026-09-14", "2026-09-07", "2026-08-31"]) await ctx.db.insert("dailyMetrics", { ...rest, businessDate: day, exceptions: clean });
    });
    // D'habitude 0 % ; ce lundi, la moitié des ventes perdue en cuisine.
    const alert = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody, day: DAY }))!.comparison.exceptionsAlert;
    expect(alert).toMatchObject({ usual: 0 });
    expect(alert!.share).toBeCloseTo(1);
  });

  test("une période ne se compare qu'une fois finie, entièrement connue, et à une période de même nature (B2)", async () => {
    const v = await venue();
    await evening(v);
    at("2026-09-22T05:30:00Z");
    await v.t.mutation(internal.analytics.closeDays, {});
    await settle(v);
    const base = (await stored(v, DAY))!;
    await v.t.run(async (ctx) => {
      const { _id, _creationTime, ...rest } = base;
      void _id;
      void _creationTime;
      for (let d = 8; d <= 20; d++) await ctx.db.insert("dailyMetrics", { ...rest, businessDate: `2026-09-${String(d).padStart(2, "0")}` });
    });
    const q = (from: string, to: string) => v.owner.as.query(api.analytics.period, { venueId: v.cocody, from, to });
    // Aujourd'hui seul, et 7 jours qui finissent aujourd'hui : un jour entamé ne se compare pas.
    expect((await q("2026-09-22", "2026-09-22")).previous).toBeNull();
    expect((await q("2026-09-16", "2026-09-22")).previous).toBeNull();
    // Un jour clos seul se compare à ses mêmes jours de semaine, dans le rapport : pas à la veille.
    expect((await q(DAY, DAY)).previous).toBeNull();
    // Sept jours clos, précédés de sept jours connus : oui.
    expect((await q("2026-09-15", DAY)).previous).toMatchObject({ from: "2026-09-08", to: "2026-09-14", orders: 7, missing: 0 });
    // Précédés de jours inconnus : non.
    expect((await q("2026-09-09", "2026-09-15")).previous).toBeNull();
  });
});

describe("les corrections et les changements de réglage (I3, I5, I8)", () => {
  test("un recomptage n'efface pas l'écart : le premier fait foi, manquant et excédent séparés", async () => {
    const v = await venue();
    const drawer = await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 10000 });
    await evening(v);
    await v.cashier.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer });
    await v.cashier.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: drawer, countedAmount: 9000 });
    await v.cashier.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: drawer, countedAmount: 10000 });
    at("2026-09-22T05:30:00Z");
    await v.t.mutation(internal.analytics.closeDays, {});
    await settle(v);
    expect((await stored(v, DAY))!.exceptions).toMatchObject({ cashShort: 1000, cashOver: 0, cashDiscrepancies: 1 });
  });

  test("l'heure de début change : aucun paiement ne tombe entre deux jours", async () => {
    const v = await venue();
    // Mardi 5 h, avec un début de journée à 4 h : ce paiement est à mardi.
    at("2026-09-22T05:00:00Z");
    const a = await tableWithOrder(v);
    await collect(v, a.sessionId, { method: "mobile_money", amount: 13500, wallet: "Wave" });
    at("2026-09-22T05:30:00Z");
    await v.t.mutation(internal.analytics.closeDays, {});
    await settle(v);
    // Mardi 10 h, le début passe à 6 h. Sans chaînage, mardi commencerait à 6 h et le paiement de
    // 5 h n'appartiendrait à aucun jour.
    at("2026-09-22T10:00:00Z");
    await v.owner.as.mutation(api.cash.setPaymentSettings, { venueId: v.cocody, cashMode: "central", mobileMoneyWallets: ["Wave", "Orange Money"], amountStep: 25, serviceDayStartHour: 6 });
    const tuesday = await v.owner.as.query(api.analytics.period, { venueId: v.cocody, from: "2026-09-22", to: "2026-09-22" });
    const report = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody, day: "2026-09-22" });
    expect([tuesday.money!.collected.net, report.totals!.net, (await stored(v, DAY))!.collected.net]).toEqual([13500, 13500, 0]);
  });

  test("un établissement mal réglé n'arrête pas la clôture des autres", async () => {
    const v = await venue();
    await v.t.run(async (ctx) => {
      for (const s of await ctx.db.query("venueSettings").withIndex("by_venue", (q) => q.eq("venueId", v.plateau)).collect()) await ctx.db.delete(s._id);
    });
    at("2026-09-22T05:30:00Z");
    expect(await v.t.mutation(internal.analytics.closeDays, {})).toEqual({ scheduled: 2, failed: [v.plateau] });
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
    // Un comptage lancé puis laissé tait TOUS les montants : l'alerte reste, et le dit.
    const [drawer] = owner.staleCash;
    await v.cashier.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer!._id });
    expect((await v.owner.as.query(api.tower.alerts, { venueId: v.cocody })).staleCash.map((c) => c.status)).toEqual(["counting"]);
    const day = (await v.owner.as.query(api.analytics.day, { venueId: v.cocody }))!;
    expect([day.moneyHidden, day.countingDrawers]).toEqual(["blind", ["Caisse principale"]]);
  });
});
