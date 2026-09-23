/**
 * L'argent d'un service — tranche T3.
 *
 * « Maquis Awa », Cocody. Mariam tient la caisse, Koffi sert et, les soirs de pochette, encaisse
 * lui-même. Chaque scénario vient de PAYMENTS.md §12 ou de la porte de sortie de T3 : une clôture
 * de caisse qui tombe juste, et un écart provoqué qui remonte avec son auteur et son motif.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { restaurantWithMenu } from "./catalogFixtures";
import { activateAndUnlock, enrollDevice, pinMember } from "./deviceFixtures";
import { expectCode, inviteAndJoin } from "./setup";

async function venue() {
  const r = await restaurantWithMenu();
  const { owner, cocody } = r;
  await owner.as.mutation(api.publications.publish, { venueId: cocody, menuId: r.menuId });
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId: cocody, names: ["Terrasse"] });
  const table = (number: string) =>
    owner.as.mutation(api.floor.createTable, { venueId: cocody, serviceAreaId: areaId!, number, seats: 4, shape: "square" });
  const tableId = await table("1");
  const table2 = await table("2");
  await owner.as.mutation(api.stations.create, { venueId: cocody, name: "Cuisine", type: "kitchen" });
  const cashier = await inviteAndJoin(
    r.t,
    owner,
    { organizationId: r.organizationId, roleId: r.roleId("cashier"), venueIds: [cocody] },
    { email: "caisse@maquis.ci" },
  );
  await owner.as.mutation(api.cash.setPaymentSettings, {
    venueId: cocody,
    cashMode: "central",
    mobileMoneyWallets: ["Wave", "Orange Money"],
    amountStep: 25,
    serviceDayStartHour: 4,
  });
  return { ...r, tableId, table2, cashier };
}

type Venue = Awaited<ReturnType<typeof venue>>;

let keySeq = 0;
const key = () => `test-argent-${String(++keySeq).padStart(8, "0")}`;

/** 2 poulets (7 000), 1 poisson (5 000), 3 bissap (1 500) : 13 500. */
async function tableWithOrder(v: Venue, tableId = v.tableId) {
  const sessionId = await v.waiter.as.mutation(api.sessions.open, { venueId: v.cocody, tableId });
  const sent = await v.waiter.as.mutation(api.orders.submit, {
    venueId: v.cocody,
    sessionId,
    lines: [
      { productId: v.products.poulet, optionIds: [], quantity: 2, courseNumber: 1 },
      { productId: v.products.poisson, optionIds: [], quantity: 1, courseNumber: 1 },
      { productId: v.products.bissap, optionIds: [], quantity: 3, courseNumber: 1 },
    ],
    heldCourses: [],
    idempotencyKey: key(),
  });
  if (!sent.ok) throw new Error(JSON.stringify(sent));
  const items = await v.t.run((ctx) => ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", sent.orderId)).collect());
  const byName = (name: string) => items.find((i) => i.nameSnapshot === name)!._id;
  return { sessionId, orderId: sent.orderId, poulet: byName("Poulet braisé"), poisson: byName("Poisson braisé"), bissap: byName("Bissap") };
}

async function serveAll(v: Venue, orderId: Id<"orders">) {
  const tickets = await v.t.run((ctx) => ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", orderId)).collect());
  for (const t of tickets) {
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: t._id, action: "ready" });
    await v.waiter.as.mutation(api.orders.serveTicket, { venueId: v.cocody, ticketId: t._id });
  }
}

function bill(v: Venue, sessionId: Id<"tableSessions">) {
  return v.cashier.as.query(api.checks.forSession, { venueId: v.cocody, sessionId });
}

async function collect(
  v: Venue,
  sessionId: Id<"tableSessions">,
  input: { method: "cash" | "mobile_money" | "card"; amount: number; checkId?: Id<"checks"> | null; receivedAmount?: number; changeAmount?: number; wallet?: string },
  who = v.cashier,
) {
  const r = await who.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId, checkId: input.checkId ?? null, idempotencyKey: key(), ...input });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("encaisser", () => {
  test("paiement mixte : espèces avec monnaie rendue + Wave, la table se clôt, la caisse tombe juste", async () => {
    const v = await venue();
    const { sessionId, orderId } = await tableWithOrder(v);
    await serveAll(v, orderId);
    await v.waiter.as.mutation(api.checks.requestBill, { venueId: v.cocody, sessionId });
    expect((await bill(v, sessionId)).due).toBe(13500);

    // Espèces sans caisse ouverte : refusé, l'écran propose d'ouvrir.
    const refused = await v.cashier.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId, checkId: null, method: "cash", amount: 5000, idempotencyKey: key() });
    expect(refused).toEqual({ ok: false, reason: "no_cash_session" });

    const drawer = await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 10000 });
    const cash = await collect(v, sessionId, { method: "cash", amount: 5000, receivedAmount: 10000 });
    expect([cash.due, cash.changeAmount]).toEqual([8500, 5000]);
    // Mobile Money : le portefeuille est obligatoire.
    await expectCode(v.cashier.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId, checkId: null, method: "mobile_money", amount: 8500, idempotencyKey: key() }), "INVALID_ARGUMENT");
    const wave = await collect(v, sessionId, { method: "mobile_money", amount: 8500, wallet: "Wave" });
    expect(wave.due).toBe(0);

    const view = await bill(v, sessionId);
    expect(view.checks.map((c) => c.payments.map((p) => [p.label, p.amount, p.collectedBy]))).toEqual([
      [
        ["Espèces", 5000, "caisse"],
        ["Wave", 8500, "caisse"],
      ],
    ]);
    // La table ne se clôt jamais seule à solde nul (paiement par tournée) : c'est un geste.
    expect(view.sessionStatus).toBe("settling");
    await v.waiter.as.mutation(api.sessions.close, { venueId: v.cocody, sessionId });

    // Fin de service : Mariam ne compte pas elle-même ? Un tiroir, si — c'est dit dans le rapport.
    await v.cashier.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer });
    // À l'aveugle : pendant le comptage, l'attendu n'est pas lisible.
    const counting = (await v.cashier.as.query(api.cash.overview, { venueId: v.cocody })).sessions.find((s) => s._id === drawer)!;
    expect([counting.status, counting.expectedAmount]).toEqual(["counting", null]);
    // Espèces pendant le comptage : refusées (plus de caisse ouverte).
    const { sessionId: s2 } = await tableWithOrder(v, v.table2);
    expect(await v.cashier.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId: s2, checkId: null, method: "cash", amount: 1000, idempotencyKey: key() })).toEqual({ ok: false, reason: "no_cash_session" });

    expect(await v.cashier.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: drawer, countedAmount: 15000 })).toEqual({ expected: 15000, counted: 15000, discrepancy: 0 });
    await v.cashier.as.mutation(api.cash.close, { venueId: v.cocody, sessionId: drawer });
    const closed = await v.t.run((ctx) => ctx.db.get(drawer));
    expect([closed!.status, closed!.discrepancy]).toEqual(["closed", 0]);
  });

  test("double clic : une même clé, un seul paiement ; la même clé pour un autre montant est refusée", async () => {
    const v = await venue();
    const { sessionId } = await tableWithOrder(v);
    const args = { venueId: v.cocody, sessionId, checkId: null, method: "card" as const, amount: 3000, idempotencyKey: key() };
    const first = await v.cashier.as.mutation(api.payments.collect, args);
    const again = await v.cashier.as.mutation(api.payments.collect, args);
    expect(first.ok && again.ok && first.paymentId === again.paymentId).toBe(true);
    await expectCode(v.cashier.as.mutation(api.payments.collect, { ...args, amount: 2000 }), "CONFLICT");
    expect((await bill(v, sessionId)).paid).toBe(3000);
  });

  test("jamais au-delà du dû : deux encaisseurs pour le même solde, un seul passe", async () => {
    const v = await venue();
    const { sessionId } = await tableWithOrder(v);
    const pay = () => v.cashier.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId, checkId: null, method: "card", amount: 13500, idempotencyKey: key() });
    const results = await Promise.allSettled([pay(), pay()]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect((await bill(v, sessionId)).due).toBe(0);
    await expectCode(pay(), "CONFLICT");
  });

  test("un serveur sans le droit d'encaisser ne peut pas encaisser ; la table ne se clôt pas avec un dû", async () => {
    const v = await venue();
    const { sessionId, orderId } = await tableWithOrder(v);
    await serveAll(v, orderId);
    await expectCode(v.waiter.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId, checkId: null, method: "card", amount: 100, idempotencyKey: key() }), "FORBIDDEN");
    await expectCode(v.waiter.as.mutation(api.sessions.close, { venueId: v.cocody, sessionId }), "CONFLICT");
  });

  test("sous PIN, sur la tablette partagée : encaisser oui, rembourser jamais", async () => {
    const v = await venue();
    const { sessionId } = await tableWithOrder(v);
    const tablet = await enrollDevice(v.t, v.owner, v.cocody, { deviceType: "shared", label: "Caisse" });
    const aya = await pinMember(v.owner, v.organizationId, v.roleId("cashier"), [v.cocody], "Aya");
    const op = await activateAndUnlock(v.t, tablet.deviceToken, aya.code, "3719");
    const paid = await op.as.mutation(api.payments.collect, { venueId: v.cocody, sessionId, checkId: null, method: "card", amount: 13500, idempotencyKey: key() });
    if (!paid.ok) throw new Error("refusé");
    const payment = await v.t.run((ctx) => ctx.db.get(paid.paymentId));
    expect([payment!.collectedByMemberId, payment!.deviceId]).toEqual([aya.memberId, tablet.deviceId]);
    await expectCode(
      op.as.mutation(api.payments.refund, { venueId: v.cocody, paymentId: paid.paymentId, amount: 1000, reason: "plat froid", method: "original", idempotencyKey: key() }),
      "FORBIDDEN",
    );
  });
});

describe("l'addition", () => {
  test("partager par articles, avec un plat partagé à deux : aucun franc perdu", async () => {
    const v = await venue();
    const { sessionId, poisson, bissap } = await tableWithOrder(v);
    const marcel = await v.waiter.as.mutation(api.checks.split, {
      venueId: v.cocody,
      sessionId,
      label: "Marcel",
      lines: [
        { orderItemId: bissap, quantity: 1 },
        { orderItemId: poisson, quantity: 0.5 },
      ],
    });
    let view = await bill(v, sessionId);
    expect(view.checks.map((c) => [c.label, c.balance.total])).toEqual([
      ["Table", 10500],
      ["Marcel", 3000],
    ]);
    expect(view.total).toBe(13500);
    await collect(v, sessionId, { method: "card", amount: 3000, checkId: marcel });
    // Une addition payée ne se défait plus.
    await expectCode(v.waiter.as.mutation(api.checks.unsplit, { venueId: v.cocody, checkId: marcel }), "CONFLICT");
    // Le reste de la table recommande : la bière arrive sur le reste, pas sur l'addition de Marcel.
    const more = await v.waiter.as.mutation(api.orders.submit, {
      venueId: v.cocody,
      sessionId,
      lines: [{ productId: v.products.bissap, optionIds: [], quantity: 2, courseNumber: 1 }],
      heldCourses: [],
      idempotencyKey: key(),
    });
    expect(more.ok).toBe(true);
    view = await bill(v, sessionId);
    expect(view.checks.map((c) => [c.label, c.balance.due])).toEqual([
      ["Table", 11500],
      ["Marcel", 0],
    ]);
    // Le partage égal est une aide : trois paiements sur la même addition.
    for (const amount of [3850, 3825, 3825]) await collect(v, sessionId, { method: "card", amount });
    expect((await bill(v, sessionId)).due).toBe(0);
  });

  test("on ne détache pas ce qui est déjà payé", async () => {
    const v = await venue();
    const { sessionId, poulet } = await tableWithOrder(v);
    await collect(v, sessionId, { method: "card", amount: 13000 });
    await expectCode(v.waiter.as.mutation(api.checks.split, { venueId: v.cocody, sessionId, lines: [{ orderItemId: poulet, quantity: 1 }] }), "CONFLICT");
  });

  test("offrir un plat servi : compte seulement, motif obligatoire, jamais au-delà du dû", async () => {
    const v = await venue();
    const { sessionId, orderId, poisson } = await tableWithOrder(v);
    await serveAll(v, orderId);
    // Un plat servi ne s'annule pas : il s'offre.
    await expectCode(v.owner.as.mutation(api.orders.cancelItem, { venueId: v.cocody, itemId: poisson, reason: "trop cuit" }), "CONFLICT");
    const args = { venueId: v.cocody, sessionId, checkId: null, orderItemId: poisson, reason: "Poisson trop cuit, refusé" };
    await expectCode(v.waiter.as.mutation(api.checks.comp, args), "FORBIDDEN");
    await expectCode(v.owner.as.mutation(api.checks.comp, { ...args, reason: "" }), "INVALID_ARGUMENT");
    await v.owner.as.mutation(api.checks.comp, args);
    const view = await bill(v, sessionId);
    expect([view.checks[0]!.balance.discounts, view.due]).toEqual([5000, 8500]);
    expect(view.checks[0]!.lines.find((l) => l.orderItemId === poisson)!.comped).toBe(true);
    await collect(v, sessionId, { method: "card", amount: 8000 });
    await expectCode(v.owner.as.mutation(api.checks.discount, { venueId: v.cocody, sessionId, checkId: null, amount: 1000, reason: "Geste de la maison" }), "CONFLICT");
    await v.owner.as.mutation(api.checks.discount, { venueId: v.cocody, sessionId, checkId: null, amount: 500, reason: "Geste de la maison" });
    expect((await bill(v, sessionId)).due).toBe(0);
  });

  test("annuler un plat déjà payé : refusé, on rembourse d'abord", async () => {
    const v = await venue();
    const { sessionId, bissap } = await tableWithOrder(v);
    await collect(v, sessionId, { method: "card", amount: 13500 });
    await expectCode(v.owner.as.mutation(api.orders.cancelItem, { venueId: v.cocody, itemId: bissap, reason: "rupture" }), "CONFLICT");
  });

  test("client parti sans payer : compte seulement, motif, montant figé", async () => {
    const v = await venue();
    const { sessionId, orderId } = await tableWithOrder(v);
    await serveAll(v, orderId);
    await collect(v, sessionId, { method: "card", amount: 3500 });
    await expectCode(v.waiter.as.mutation(api.sessions.closeWithDebt, { venueId: v.cocody, sessionId, reason: "Parti sans payer" }), "FORBIDDEN");
    await expectCode(v.owner.as.mutation(api.sessions.closeWithDebt, { venueId: v.cocody, sessionId, reason: "" }), "INVALID_ARGUMENT");
    await v.owner.as.mutation(api.sessions.closeWithDebt, { venueId: v.cocody, sessionId, reason: "Parti sans payer, table 1" });
    const session = await v.t.run((ctx) => ctx.db.get(sessionId));
    expect([session!.status, session!.debtAmount, session!.closeReason]).toEqual(["closed_with_debt", 10000, "Parti sans payer, table 1"]);
  });
});

describe("le ticket", () => {
  test("émis une fois l'addition soldée, numéroté sans trou ; il fige ses lignes", async () => {
    const v = await venue();
    const { sessionId } = await tableWithOrder(v);
    const checkId = await v.waiter.as.mutation(api.checks.requestBill, { venueId: v.cocody, sessionId });
    await expectCode(v.cashier.as.mutation(api.bills.issue, { venueId: v.cocody, checkId }), "CONFLICT");
    await collect(v, sessionId, { method: "card", amount: 13500 });
    const billId = await v.cashier.as.mutation(api.bills.issue, { venueId: v.cocody, checkId });
    expect(await v.cashier.as.mutation(api.bills.issue, { venueId: v.cocody, checkId })).toBe(billId);
    const ticket = await v.cashier.as.query(api.bills.get, { venueId: v.cocody, billId });
    const year = new Date().getUTCFullYear();
    expect(ticket.reference).toBe(`T-${year}-000001`);
    expect(ticket.notice).toBe("Document interne — ne vaut pas reçu fiscal");
    expect(ticket.snapshot.totals.total).toBe(13500);
    expect(ticket.snapshot.payments).toEqual([{ method: "Carte", amount: 13500 }]);
    // Imprimer, puis réimprimer : un duplicata, avec son droit.
    expect(await v.cashier.as.mutation(api.bills.recordPrint, { venueId: v.cocody, billId })).toEqual({ duplicate: false });
    expect(await v.cashier.as.mutation(api.bills.recordPrint, { venueId: v.cocody, billId })).toEqual({ duplicate: true });
    await expectCode(v.waiter.as.mutation(api.bills.recordPrint, { venueId: v.cocody, billId }), "FORBIDDEN");
    // Une bière après le ticket : nouvelle addition, le ticket ne change pas.
    await v.waiter.as.mutation(api.orders.submit, {
      venueId: v.cocody,
      sessionId,
      lines: [{ productId: v.products.bissap, optionIds: [], quantity: 1, courseNumber: 1 }],
      heldCourses: [],
      idempotencyKey: key(),
    });
    const view = await bill(v, sessionId);
    expect(view.checks.map((c) => [c.kind, c.balance.total, c.balance.due])).toEqual([
      ["remainder", 500, 500],
      ["allocated", 13500, 0],
    ]);
  });
});

describe("annuler, rembourser", () => {
  test("annuler une saisie : ni par son auteur, ni une fois la caisse comptée", async () => {
    const v = await venue();
    const { sessionId } = await tableWithOrder(v);
    const drawer = await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 0 });
    const wrong = await collect(v, sessionId, { method: "cash", amount: 5000 });
    await expectCode(v.cashier.as.mutation(api.payments.voidPayment, { venueId: v.cocody, paymentId: wrong.paymentId, reason: "erreur de saisie" }), "FORBIDDEN");
    await v.owner.as.mutation(api.payments.voidPayment, { venueId: v.cocody, paymentId: wrong.paymentId, reason: "Montant mal saisi" });
    expect((await bill(v, sessionId)).paid).toBe(0);

    const right = await collect(v, sessionId, { method: "cash", amount: 13500 });
    await v.owner.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer });
    await expectCode(v.owner.as.mutation(api.payments.voidPayment, { venueId: v.cocody, paymentId: right.paymentId, reason: "Montant mal saisi" }), "CONFLICT");
    // L'annulation a bien retiré les 5 000 de l'attendu.
    expect((await v.owner.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: drawer, countedAmount: 13500 })).expected).toBe(13500);
  });

  test("rembourser : jamais au-delà de l'encaissé ; en espèces, depuis une caisse choisie ; un avoir corrige le ticket", async () => {
    const v = await venue();
    const { sessionId } = await tableWithOrder(v);
    const drawer = await v.cashier.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 5000 });
    const checkId = await v.waiter.as.mutation(api.checks.requestBill, { venueId: v.cocody, sessionId });
    const paid = await collect(v, sessionId, { method: "mobile_money", amount: 13500, wallet: "Orange Money" });
    const saleId = await v.cashier.as.mutation(api.bills.issue, { venueId: v.cocody, checkId });
    const refund = (amount: number, extra: object = {}) =>
      v.owner.as.mutation(api.payments.refund, { venueId: v.cocody, paymentId: paid.paymentId, amount, reason: "Poisson refusé", method: "cash", registerSessionId: drawer, idempotencyKey: key(), ...extra });
    await expectCode(refund(20000), "CONFLICT");
    await expectCode(refund(1000, { reason: "" }), "INVALID_ARGUMENT");
    await refund(5000);
    const payment = await v.t.run((ctx) => ctx.db.get(paid.paymentId));
    expect(payment!.status).toBe("partially_refunded");
    const notes = await v.t.run((ctx) => ctx.db.query("bills").withIndex("by_corrects", (q) => q.eq("correctsBillId", saleId)).collect());
    expect(notes.map((n) => [n.kind, n.reference.startsWith("AV-"), n.snapshot.totals.total])).toEqual([["credit_note", true, 5000]]);
    await expectCode(refund(8501), "CONFLICT");
    // L'argent est sorti du tiroir : l'attendu le sait.
    await v.owner.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: drawer });
    expect((await v.owner.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: drawer, countedAmount: 0 })).expected).toBe(0);
  });
});

describe("la porte de sortie de T3 : l'écart provoqué remonte avec son auteur et son motif", () => {
  test("pochettes : Koffi encaisse, garde 1 000, un responsable compte, l'écart est dans le rapport", async () => {
    const v = await venue();
    await v.owner.as.mutation(api.cash.setPaymentSettings, { venueId: v.cocody, cashMode: "per_waiter", mobileMoneyWallets: ["Wave"], amountStep: 25, serviceDayStartHour: 4 });
    const { sessionId, orderId } = await tableWithOrder(v);
    await serveAll(v, orderId);
    // Koffi est chef de rang ici : il encaisse (`payment.collect`) mais ne compte pas les caisses.
    const koffi = v.floor;
    const pouch = await koffi.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 2000 });
    await expectCode(koffi.as.mutation(api.cash.open, { venueId: v.cocody, openingFloat: 0 }), "CONFLICT");
    await collect(v, sessionId, { method: "cash", amount: 13500, receivedAmount: 15000 }, koffi);
    await koffi.as.mutation(api.cash.addMovement, { venueId: v.cocody, sessionId: pouch, type: "payout", amount: 1500, reason: "Sac de glace" });
    await koffi.as.mutation(api.sessions.close, { venueId: v.cocody, sessionId });

    // Il ne compte pas sa propre pochette.
    await expectCode(koffi.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: pouch }), "FORBIDDEN");
    // Le propriétaire compte. Attendu : 2 000 + 13 500 − 1 500 = 14 000 ; il trouve 13 000.
    await v.owner.as.mutation(api.cash.startCount, { venueId: v.cocody, sessionId: pouch });
    expect(await v.owner.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: pouch, countedAmount: 13000 })).toEqual({ expected: 14000, counted: 13000, discrepancy: -1000 });
    // Un seul recomptage ; les deux comptages restent.
    await v.owner.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: pouch, countedAmount: 13000 });
    await expectCode(v.owner.as.mutation(api.cash.submitCount, { venueId: v.cocody, sessionId: pouch, countedAmount: 14000 }), "CONFLICT");
    await expectCode(v.owner.as.mutation(api.cash.close, { venueId: v.cocody, sessionId: pouch }), "INVALID_ARGUMENT");
    await v.owner.as.mutation(api.cash.close, { venueId: v.cocody, sessionId: pouch, reason: "Monnaie gardée par le serveur, à retenir" });

    const report = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody });
    const row = report.cashSessions.find((s) => s._id === pouch)!;
    expect({
      name: row.name,
      holder: row.holder,
      expected: row.expected,
      counted: row.counted,
      discrepancy: row.discrepancy,
      counts: row.counts.map((c) => [c.amount, c.by]),
      reason: row.closeReason,
      closedBy: row.closedBy,
    }).toEqual({
      name: "Pochette de rang",
      holder: "rang",
      expected: 14000,
      counted: 13000,
      discrepancy: -1000,
      counts: [
        [13000, "Propriétaire Maquis Awa"],
        [13000, "Propriétaire Maquis Awa"],
      ],
      reason: "Monnaie gardée par le serveur, à retenir",
      closedBy: "Propriétaire Maquis Awa",
    });
    expect(report.totals).toEqual({ collected: 13500, refunded: 0, net: 13500, count: 1 });
    expect(report.byCollector).toEqual([{ name: "rang", amount: 13500, cash: 13500, count: 1 }]);
    // Un comptable lit le rapport ; un serveur, non.
    await expectCode(v.waiter.as.query(api.reports.serviceDay, { venueId: v.cocody }), "FORBIDDEN");
  });

  test("le rapport dit tout : moyens, offerts, annulations après envoi, impayés, tables encore ouvertes", async () => {
    const v = await venue();
    const a = await tableWithOrder(v);
    await serveAll(v, a.orderId);
    await v.owner.as.mutation(api.checks.comp, { venueId: v.cocody, sessionId: a.sessionId, checkId: null, orderItemId: a.bissap, reason: "Anniversaire du client" });
    await collect(v, a.sessionId, { method: "mobile_money", amount: 10000, wallet: "Wave" });
    await v.owner.as.mutation(api.sessions.closeWithDebt, { venueId: v.cocody, sessionId: a.sessionId, reason: "Parti sans finir de payer" });

    const b = await tableWithOrder(v, v.table2);
    const [ticket] = await v.t.run((ctx) => ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", b.orderId)).collect());
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId: ticket!._id, action: "start" });
    await v.owner.as.mutation(api.orders.cancelItem, { venueId: v.cocody, itemId: b.poisson, reason: "Plus de poisson frais" });

    const report = await v.owner.as.query(api.reports.serviceDay, { venueId: v.cocody });
    expect(report.byMethod.map((m) => [m.label, m.amount])).toEqual([["Wave", 10000]]);
    expect(report.adjustments.map((x) => [x.type, x.amount, x.by, x.reason])).toEqual([["comp", 1500, "Propriétaire Maquis Awa", "Anniversaire du client"]]);
    expect(report.debts.map((d) => [d.table, d.amount, d.reason])).toEqual([["1", 13500 - 1500 - 10000, "Parti sans finir de payer"]]);
    expect(report.cancellations.map((c) => [c.table, c.item, c.amount, c.reason])).toEqual([["2", "Poisson braisé", 5000, "Plus de poisson frais"]]);
    expect(report.openTables.map((t) => [t.table, t.due])).toEqual([["2", 8500]]);
  });
});
