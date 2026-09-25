/**
 * Le paiement en ligne — tranche T5 (D-109 à D-128).
 *
 * « Maquis Awa », Cocody, table 1. Le restaurant a branché son compte Wave ; Aya, Koffi et Mariam
 * sont à table, admis par le code. La porte de sortie de T5 : la batterie du §12 de PAYMENTS.md
 * passe, webhook rejoué et falsifié compris — chaque test ci-dessous en porte la ligne.
 *
 * Wave n'a pas d'environnement de test : c'est le VRAI adaptateur qui parle à un faux Wave
 * (`fakeWave.ts`), par `fetch`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { expectCode } from "./setup";
import { installFakeWave, signed, type FakeWave } from "./fakeWave";
import { line, tableWithGuest } from "./guestFixtures";

// La clé maîtresse des secrets, pour la durée des tests (jamais écrite ailleurs).
process.env.PAYMENT_SECRETS_KEY ??= btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256)));

const API_KEY = "wave_ci_prod_cle_de_test_du_maquis_awa";
const WEBHOOK_SECRET = "wave_ci_prod_WHS_secret_du_webhook_awa";
const AYA = "telephone-de-aya-000000000001";
const KOFFI = "telephone-de-koffi-00000000002";
const MARIAM = "telephone-de-mariam-0000000003";

let seq = 0;
const key = () => `cle-paiement-${String(++seq).padStart(8, "0")}`;

let wave: FakeWave;
beforeEach(() => {
  vi.useFakeTimers();
  wave = installFakeWave({ apiKey: API_KEY });
});
afterEach(() => {
  wave.restore();
  vi.useRealTimers();
});

async function waveVenue() {
  const s = await tableWithGuest();
  const venueId = s.cocody;
  await s.owner.as.action(api.paymentAccounts.saveSecrets, { venueId, apiKey: API_KEY, webhookSecret: WEBHOOK_SECRET });
  expect(await s.owner.as.action(api.paymentAccounts.testConnection, { venueId })).toEqual({ ok: true, balanceAccess: true, error: null });
  const view = await s.owner.as.query(api.paymentAccounts.forVenue, { venueId });
  const path = new URL(view.account!.webhookUrl!).pathname;
  const hook = async (body: string, options: { secret?: string; at?: number } = {}) =>
    s.t.fetch(path, { method: "POST", headers: await signed(options.secret ?? WEBHOOK_SECRET, body, options.at), body });
  expect((await hook(JSON.stringify({ id: "EV_test_1", type: "test.test_event" }))).status).toBe(200);
  await s.owner.as.mutation(api.paymentAccounts.activate, { venueId });
  await s.owner.as.mutation(api.venues.setOrderingMode, { venueId, orderingMode: "guest_direct" });
  const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId, tableId: s.tableId });
  const code = (await s.waiter.as.query(api.sessions.detail, { venueId, sessionId })).code!;
  const admit = async (phone: string) => expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(phone), code })).toEqual({ ok: true });
  const order = async (phone: string, productId: string, quantity = 1) => {
    const r = await s.t.mutation(api.guestService.submitLines, { ...s.as(phone), idempotencyKey: key(), lines: [line(productId, quantity)] });
    expect(r).toMatchObject({ ok: true });
  };
  const pay = (phone: string, target: "remainder" | "my_items" = "remainder", idempotencyKey = key()) =>
    s.t.action(api.onlinePayments.guestStart, { ...s.as(phone), target, idempotencyKey });
  const intents = () => s.t.run((ctx) => ctx.db.query("paymentIntents").collect());
  const payments = () => s.t.run((ctx) => ctx.db.query("payments").collect());
  const bill = () => s.owner.as.query(api.checks.forSession, { venueId, sessionId });
  const settle = () => s.t.finishAllScheduledFunctions(vi.runAllTimers);
  return { ...s, venueId, path, hook, sessionId, code, admit, order, pay, intents, payments, bill, settle };
}

type V = Awaited<ReturnType<typeof waveVenue>>;

/** Aya (1 poulet, 3 500) et Koffi (1 poisson, 5 000) : 8 500 sur la table. */
async function dinner(v: V) {
  await v.admit(AYA);
  await v.admit(KOFFI);
  await v.order(AYA, v.products.poulet);
  await v.order(KOFFI, v.products.poisson);
}

function lastSession() {
  return [...wave.sessions.values()].at(-1)!;
}

describe("le compte Wave du restaurant (D-116, D-117, D-128)", () => {
  test("aucune requête ne rend un secret ; un compte non prouvé ne s'active pas", async () => {
    const s = await tableWithGuest();
    await s.owner.as.action(api.paymentAccounts.saveSecrets, { venueId: s.cocody, apiKey: API_KEY, webhookSecret: WEBHOOK_SECRET });
    const view = await s.owner.as.query(api.paymentAccounts.forVenue, { venueId: s.cocody });
    const text = JSON.stringify(view);
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain(WEBHOOK_SECRET);
    expect(view.account).toMatchObject({ status: "draft", apiKeyLast4: API_KEY.slice(-4), webhookSecretLast4: WEBHOOK_SECRET.slice(-4) });
    // Stockés chiffrés : même la base ne contient pas le clair.
    const raw = await s.t.run((ctx) => ctx.db.query("paymentProviderAccounts").collect());
    expect(JSON.stringify(raw)).not.toContain("cle_de_test_du_maquis");
    // Ni connexion testée, ni événement de test reçu : refusé.
    await expectCode(s.owner.as.mutation(api.paymentAccounts.activate, { venueId: s.cocody }), "CONFLICT");
  });

  test("un serveur ne configure pas le paiement en ligne ; le journal nomme les champs, jamais leur valeur", async () => {
    const s = await tableWithGuest();
    await expectCode(s.waiter.as.action(api.paymentAccounts.saveSecrets, { venueId: s.cocody, apiKey: API_KEY }), "FORBIDDEN");
    await s.owner.as.action(api.paymentAccounts.saveSecrets, { venueId: s.cocody, apiKey: API_KEY });
    const logs = await s.t.run((ctx) => ctx.db.query("auditLogs").collect());
    const entry = logs.find((l) => l.action === "payment.provider.secrets")!;
    expect(entry.after).toEqual({ changed: ["apiKey"] });
    expect(JSON.stringify(logs)).not.toContain(API_KEY.slice(-4) + "\"");
  });

  test("webhook sur une adresse inconnue : 404, rien d'écrit", async () => {
    const v = await waveVenue();
    const response = await v.t.fetch(`/webhooks/wave/${"x".repeat(43)}`, { method: "POST", body: "{}" });
    expect(response.status).toBe(404);
  });
});

describe("PAYMENTS §12 — la batterie de sortie de T5", () => {
  test("double clic sur « Payer » → une seule session Wave, une seule intention", async () => {
    const v = await waveVenue();
    await dinner(v);
    const k = key();
    const [a, b] = await Promise.all([v.pay(AYA, "remainder", k), v.pay(AYA, "remainder", k)]);
    const ready = [a, b].filter((r) => r.ok && r.status === "ready");
    expect(ready.length + [a, b].filter((r) => r.ok && r.status === "pending").length).toBe(2);
    // Un autre appui (nouvelle clé) retrouve la même intention, le même lien.
    const again = await v.pay(AYA);
    expect(again).toMatchObject({ ok: true, status: "ready", amount: 8500 });
    expect(wave.creates()).toBe(1);
    expect(await v.intents()).toHaveLength(1);
  });

  test("réponse de création perdue → retrouvée par notre référence, jamais recréée (D-119)", async () => {
    const v = await waveVenue();
    await dinner(v);
    wave.behaviour.loseNextCreateResponse = true;
    expect(await v.pay(AYA)).toEqual({ ok: false, reason: "provider_unavailable" });
    const [intent] = await v.intents();
    expect(intent!.status).toBe("initializing");
    // Tant que le bail court, on ne relance rien.
    expect(await v.pay(AYA)).toEqual({ ok: true, status: "pending" });
    vi.advanceTimersByTime(61_000);
    expect(await v.pay(AYA)).toMatchObject({ ok: true, status: "ready" });
    expect(wave.creates()).toBe(1);
    expect((await v.intents())[0]).toMatchObject({ status: "processing", providerRef: lastSession().id });
  });

  test("webhook rejoué → aucun effet : un paiement, deux réponses 200", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    const body = wave.event(lastSession().id);
    expect((await v.hook(body)).status).toBe(200);
    expect((await v.hook(body)).status).toBe(200);
    const paid = await v.payments();
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ amount: 8500, method: "mobile_money", provider: "wave_ci", status: "succeeded" });
    expect(paid[0]!.collectedByMemberId).toBeUndefined();
    const events = await v.t.run((ctx) => ctx.db.query("webhookEvents").collect());
    expect(events.find((e) => e.eventType === "checkout.session.completed")!.replayCount).toBe(1);
    // La caisse le voit sans recharger : l'addition est soldée.
    expect((await v.bill()).due).toBe(0);
  });

  test("webhook falsifié → rejeté : mauvais secret, corps modifié, rien d'enregistré", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    const body = wave.event(lastSession().id);
    expect((await v.hook(body, { secret: "wave_ci_prod_WHS_un_faussaire_quelconque" })).status).toBe(401);
    const headers = await signed(WEBHOOK_SECRET, body);
    const forged = body.replace('"amount":"8500"', '"amount":"100"');
    expect((await v.t.fetch(v.path, { method: "POST", headers, body: forged })).status).toBe(401);
    expect(await v.payments()).toHaveLength(0);
    const account = (await v.t.run((ctx) => ctx.db.query("paymentProviderAccounts").collect()))[0]!;
    expect(account.signatureFailures!.count).toBe(2);
  });

  test("le secret d'un AUTRE restaurant ne désigne rien ici", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    // Plateau branche son propre compte, avec son propre secret, et signe un événement qui désigne
    // la session de Cocody : l'adresse de Plateau ne mène qu'aux intentions de Plateau.
    await v.owner.as.action(api.paymentAccounts.saveSecrets, { venueId: v.plateau, apiKey: API_KEY, webhookSecret: "wave_ci_prod_WHS_secret_de_plateau_00" });
    const plateauPath = new URL((await v.owner.as.query(api.paymentAccounts.forVenue, { venueId: v.plateau })).account!.webhookUrl!).pathname;
    const body = wave.event(lastSession().id);
    const response = await v.t.fetch(plateauPath, { method: "POST", headers: await signed("wave_ci_prod_WHS_secret_de_plateau_00", body), body });
    expect(response.status).toBe(200);
    expect(await v.payments()).toHaveLength(0);
    const alerts = await v.t.run((ctx) => ctx.db.query("paymentAlerts").collect());
    expect(alerts.find((a) => a.kind === "foreign_event")?.venueId).toBe(v.plateau);
  });

  test("webhook périmé → rejeté, dans un sens comme dans l'autre", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    const body = wave.event(lastSession().id);
    expect((await v.hook(body, { at: Date.now() - 6 * 60_000 })).status).toBe(401);
    expect((await v.hook(body, { at: Date.now() + 6 * 60_000 })).status).toBe(401);
    expect(await v.payments()).toHaveLength(0);
  });

  test("paiement réussi + webhook en retard → un seul paiement (le rattrapage confirme d'abord)", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    vi.advanceTimersByTime(91_000);
    await v.t.action(internal.onlinePayments.sweep, {});
    expect(await v.payments()).toHaveLength(1);
    expect((await v.hook(wave.event(lastSession().id))).status).toBe(200);
    expect(await v.payments()).toHaveLength(1);
    expect((await v.intents())[0]!.status).toBe("succeeded");
  });

  test("paiement échoué → addition intacte, intention toujours payable", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.fail(lastSession().id);
    expect((await v.hook(wave.event(lastSession().id, "checkout.session.payment_failed"))).status).toBe(200);
    expect(await v.payments()).toHaveLength(0);
    expect((await v.bill()).due).toBe(8500);
    expect((await v.intents())[0]).toMatchObject({ status: "processing", lastErrorCode: "insufficient-funds" });
  });

  test("remboursement supérieur à l'encaissé → refusé, y compris pendant qu'un remboursement en ligne est en cours", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    await v.hook(wave.event(lastSession().id));
    const [payment] = await v.payments();
    await v.owner.as.mutation(api.payments.refund, { venueId: v.venueId, paymentId: payment!._id, amount: 8500, reason: "Client parti", method: "original", idempotencyKey: key() });
    // Le remboursement Wave n'a pas encore répondu : il compte déjà (D-123).
    await expectCode(
      v.owner.as.mutation(api.payments.refund, { venueId: v.venueId, paymentId: payment!._id, amount: 1, reason: "Encore un peu", method: "original", idempotencyKey: key() }),
      "CONFLICT",
    );
    await v.settle();
    const refunds = await v.t.run((ctx) => ctx.db.query("refunds").collect());
    expect(refunds).toHaveLength(1);
    expect(refunds[0]!.status).toBe("succeeded");
    expect((await v.payments())[0]!.status).toBe("refunded");
    expect(wave.sessions.get(lastSession().id)!.refunded).toBe(true);
  });

  test("remboursement partiel → en espèces, depuis une caisse ; par Wave, refusé (total seulement)", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    await v.hook(wave.event(lastSession().id));
    const [payment] = await v.payments();
    await expectCode(
      v.owner.as.mutation(api.payments.refund, { venueId: v.venueId, paymentId: payment!._id, amount: 3500, reason: "Poulet raté", method: "original", idempotencyKey: key() }),
      "CONFLICT",
    );
    const register = await v.owner.as.mutation(api.cash.open, { venueId: v.venueId, openingFloat: 10_000 });
    await v.owner.as.mutation(api.payments.refund, {
      venueId: v.venueId,
      paymentId: payment!._id,
      amount: 3500,
      reason: "Poulet raté",
      method: "cash",
      registerSessionId: register,
      idempotencyKey: key(),
    });
    expect((await v.payments())[0]!.status).toBe("partially_refunded");
    // L'attendu de la caisse baisse de ce qui en est sorti ; le dû de la table ne bouge pas.
    const expected = await v.t.run(async (ctx) => (await import("../../convex/lib/billing")).computeExpectedCash(ctx, (await ctx.db.get(register))!));
    expect(expected).toBe(6500);
    expect((await v.bill()).due).toBe(0);
  });

  test("paiement mixte espèces + Wave → dû à zéro, la table se clôt, la caisse ne compte que l'espèce", async () => {
    const v = await waveVenue();
    await dinner(v);
    const register = await v.owner.as.mutation(api.cash.open, { venueId: v.venueId, openingFloat: 0 });
    // Koffi règle son poisson en espèces au comptoir ; Aya paie le reste par Wave.
    const split = await v.owner.as.mutation(api.checks.split, {
      venueId: v.venueId,
      sessionId: v.sessionId,
      label: "Koffi",
      lines: [{ orderItemId: (await v.bill()).checks[0]!.lines.find((l) => l.name === "Poisson braisé")!.orderItemId, quantity: 1 }],
    });
    await v.owner.as.mutation(api.payments.collect, { venueId: v.venueId, sessionId: v.sessionId, checkId: split, method: "cash", amount: 5000, receivedAmount: 5000, idempotencyKey: key() });
    expect(await v.pay(AYA)).toMatchObject({ ok: true, status: "ready", amount: 3500 });
    wave.pay(lastSession().id);
    await v.hook(wave.event(lastSession().id));
    expect((await v.bill()).due).toBe(0);
    await serveEverything(v);
    await v.waiter.as.mutation(api.sessions.close, { venueId: v.venueId, sessionId: v.sessionId });
    const expected = await v.t.run(async (ctx) => (await import("../../convex/lib/billing")).computeExpectedCash(ctx, (await ctx.db.get(register))!));
    expect(expected).toBe(5000);
  });

  test("« mes articles » : l'addition Convive N vaut exactement ses plats, le reste de la table le reste", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.order(KOFFI, v.products.bissap, 3);
    expect(await v.pay(KOFFI, "my_items")).toMatchObject({ ok: true, status: "ready", amount: 6500 });
    const bill = await v.bill();
    const mine = bill.checks.find((c) => c.label === "Convive 2")!;
    expect(mine.balance.due).toBe(6500);
    expect(bill.checks.find((c) => c.kind === "remainder")!.balance.due).toBe(3500);
    expect(bill.total).toBe(10_000);
  });

  test("devise incohérente → non imputé, signalé", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    const session = wave.pay(lastSession().id);
    session.currency = "XAF";
    expect((await v.hook(wave.event(session.id))).status).toBe(200);
    expect(await v.payments()).toHaveLength(0);
    const alerts = await v.t.run((ctx) => ctx.db.query("paymentAlerts").collect());
    expect(alerts.map((a) => a.kind)).toContain("currency_mismatch");
  });

  test("montant du client ≠ montant du serveur → le serveur gagne ; un montant reçu différent s'enregistre tel quel, signalé", async () => {
    const v = await waveVenue();
    await dinner(v);
    // Le téléphone n'a AUCUN moyen de proposer un montant : le validateur le refuse.
    await expect(v.t.action(api.onlinePayments.guestStart, { ...v.as(AYA), target: "remainder", idempotencyKey: key(), amount: 100 } as never)).rejects.toThrow();
    expect(await v.pay(AYA)).toMatchObject({ amount: 8500 });
    expect(wave.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    // Wave dit avoir encaissé 8 000 : c'est l'argent reçu qui s'enregistre (D-115), avec une alerte.
    const s = wave.pay(lastSession().id);
    s.amount = "8000";
    await v.hook(wave.event(s.id));
    expect((await v.payments())[0]!.amount).toBe(8000);
    expect((await v.bill()).due).toBe(500);
    const alerts = await v.t.run((ctx) => ctx.db.query("paymentAlerts").collect());
    expect(alerts.map((a) => a.kind)).toContain("amount_mismatch");
  });
});

describe("une intention ouverte protège son addition (D-114)", () => {
  test("offrir, remiser, partager, annuler un plat, clôturer : refusés ; annuler le paiement en ligne les rend possibles", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    const rest = (await v.bill()).checks.find((c) => c.kind === "remainder")!;
    const poulet = rest.lines.find((l) => l.name === "Poulet braisé")!.orderItemId;
    await expectCode(v.owner.as.mutation(api.checks.comp, { venueId: v.venueId, sessionId: v.sessionId, checkId: rest._id, orderItemId: poulet, reason: "Plat froid" }), "CONFLICT");
    await expectCode(v.owner.as.mutation(api.checks.discount, { venueId: v.venueId, sessionId: v.sessionId, checkId: rest._id, amount: 500, reason: "Fidélité" }), "CONFLICT");
    await expectCode(v.owner.as.mutation(api.checks.split, { venueId: v.venueId, sessionId: v.sessionId, lines: [{ orderItemId: poulet, quantity: 1 }] }), "CONFLICT");
    await expectCode(v.owner.as.mutation(api.orders.cancelItem, { venueId: v.venueId, itemId: poulet, reason: "Erreur de saisie" }), "CONFLICT");
    await expectCode(v.owner.as.mutation(api.sessions.closeWithDebt, { venueId: v.venueId, sessionId: v.sessionId, reason: "Client parti" }), "CONFLICT");

    const [intent] = await v.intents();
    await v.owner.as.mutation(api.onlinePayments.cancel, { venueId: v.venueId, intentId: intent!._id });
    await v.settle();
    expect((await v.intents())[0]!.status).toBe("cancelled");
    expect(wave.sessions.get(lastSession().id)!.checkout_status).toBe("expired");
    await v.owner.as.mutation(api.checks.discount, { venueId: v.venueId, sessionId: v.sessionId, checkId: rest._id, amount: 500, reason: "Fidélité" });
  });

  test("annuler au moment où le client paie : l'argent est enregistré, pas perdu", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    const [intent] = await v.intents();
    await v.owner.as.mutation(api.onlinePayments.cancel, { venueId: v.venueId, intentId: intent!._id });
    await v.settle();
    expect((await v.intents())[0]!.status).toBe("succeeded");
    expect(await v.payments()).toHaveLength(1);
  });

  test("l'addition soldée au comptoir ferme la session Wave encore ouverte", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    await v.owner.as.mutation(api.cash.open, { venueId: v.venueId, openingFloat: 0 });
    await v.owner.as.mutation(api.payments.collect, { venueId: v.venueId, sessionId: v.sessionId, checkId: null, method: "cash", amount: 8500, receivedAmount: 10_000, idempotencyKey: key() });
    await v.settle();
    expect(wave.sessions.get(lastSession().id)!.checkout_status).toBe("expired");
    expect((await v.intents())[0]!.status).toBe("cancelled");
  });

  test("« mes articles » expiré sans paiement : l'addition Convive N se défait", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(KOFFI, "my_items");
    wave.expire(lastSession().id);
    vi.advanceTimersByTime(91_000);
    await v.t.action(internal.onlinePayments.sweep, {});
    expect((await v.intents())[0]!.status).toBe("expired");
    const bill = await v.bill();
    expect(bill.checks.map((c) => c.kind)).toEqual(["remainder"]);
    expect(bill.due).toBe(8500);
  });

  test("un paiement en ligne ne s'annule pas comme une saisie : il se rembourse", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    wave.pay(lastSession().id);
    await v.hook(wave.event(lastSession().id));
    await expectCode(v.owner.as.mutation(api.payments.voidPayment, { venueId: v.venueId, paymentId: (await v.payments())[0]!._id, reason: "Erreur de saisie" }), "CONFLICT");
  });

  test("payé après la clôture → enregistré quand même, et un trop-perçu à rendre (D-115)", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    const [intent] = await v.intents();
    // L'intention a été classée expirée à tort (horloge, réseau) ; la table est soldée et close.
    await v.t.run((ctx) => ctx.db.patch(intent!._id, { status: "expired" }));
    await v.owner.as.mutation(api.cash.open, { venueId: v.venueId, openingFloat: 0 });
    await v.owner.as.mutation(api.payments.collect, { venueId: v.venueId, sessionId: v.sessionId, checkId: null, method: "cash", amount: 8500, receivedAmount: 8500, idempotencyKey: key() });
    await serveEverything(v);
    await v.waiter.as.mutation(api.sessions.close, { venueId: v.venueId, sessionId: v.sessionId });
    wave.pay(lastSession().id);
    await v.hook(wave.event(lastSession().id));
    expect(await v.payments()).toHaveLength(2);
    const { alerts } = await v.owner.as.query(api.onlinePayments.alerts, { venueId: v.venueId });
    expect(alerts.find((a) => a.kind === "overpaid_closed")).toMatchObject({ severity: "critical", amount: 8500 });
  });
});

describe("le convive (D-112, D-113, C11)", () => {
  test("sans le code : ni montant, ni paiement ; admis : les deux montants", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.t.mutation(api.guestService.saveCart, { ...v.as(MARIAM), lines: [line(v.products.bissap)] });
    expect((await v.t.query(api.guestService.presence, v.as(MARIAM)))!.payment).toBeNull();
    expect(await v.pay(MARIAM)).toEqual({ ok: false, reason: "code_required" });
    const aya = (await v.t.query(api.guestService.presence, v.as(AYA)))!.payment!;
    expect(aya).toMatchObject({ currency: "XOF", remainderDue: 8500, myItemsDue: 3500, current: null });
  });

  test("un autre convive paie déjà le reste : « en cours ailleurs », jamais une seconde session", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    expect(await v.pay(KOFFI)).toEqual({ ok: false, reason: "in_progress_elsewhere" });
    expect((await v.t.query(api.guestService.presence, v.as(KOFFI)))!.payment!.remainderBusy).toBe(true);
    expect(wave.creates()).toBe(1);
  });

  test("au retour de Wave, « vérifier » relit chez Wave — la redirection seule ne prouve rien (R15)", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.pay(AYA);
    expect(await v.t.action(api.onlinePayments.guestCheck, v.as(AYA))).toEqual({ status: "pending" });
    wave.pay(lastSession().id);
    expect(await v.t.action(api.onlinePayments.guestCheck, v.as(AYA))).toEqual({ status: "paid" });
    expect((await v.t.query(api.guestService.presence, v.as(AYA)))!.payment!.current).toMatchObject({ status: "succeeded", launchUrl: null });
  });

  test("Wave injoignable : pas de paiement inventé, l'intention attend", async () => {
    const v = await waveVenue();
    await dinner(v);
    wave.behaviour.unreachable = true;
    expect(await v.pay(AYA)).toEqual({ ok: false, reason: "provider_unavailable" });
    expect(await v.payments()).toHaveLength(0);
  });

  test("table de simulation : jamais de session Wave", async () => {
    const v = await waveVenue();
    await dinner(v);
    await v.t.run((ctx) => ctx.db.patch(v.sessionId, { isSimulation: true }));
    expect(await v.pay(AYA)).toEqual({ ok: false, reason: "simulation" });
    expect(wave.creates()).toBe(0);
  });
});

describe("le rapprochement du lendemain (D-121, D-122)", () => {
  test("trois écarts : vu chez Wave pas ici (rattrapé), ici pas chez Wave (après deux passes), montant différent", async () => {
    const v = await waveVenue();
    await dinner(v);
    const day = new Date(Date.now()).toISOString().slice(0, 10);
    // 1. Aya paie, le webhook arrive : rapproché, montant juste.
    await v.pay(AYA);
    const s1 = wave.pay(lastSession().id);
    await v.hook(wave.event(s1.id));
    // 2. Un second paiement dont webhook ET rattrapage se sont perdus : le relevé le rattrape.
    await v.order(KOFFI, v.products.bissap, 2);
    await v.pay(KOFFI);
    const s2 = wave.pay(lastSession().id);
    const ref2 = (await v.intents()).find((i) => i.providerRef === s2.id)!.reference;
    wave.transaction(day, { transaction_id: s1.transaction_id, transaction_type: "api_checkout", amount: "8000", fee: "80", checkout_api_session_id: s1.id, client_reference: s1.client_reference });
    wave.transaction(day, { transaction_id: s2.transaction_id, transaction_type: "api_checkout", amount: "1000", fee: "60", checkout_api_session_id: s2.id, client_reference: ref2 });
    const accountId = (await v.t.run((ctx) => ctx.db.query("paymentProviderAccounts").collect()))[0]!._id;
    await v.t.action(internal.onlinePayments.reconcileAll, { now: Date.now() + 86_400_000 });
    let payments = await v.payments();
    expect(payments).toHaveLength(2);
    const alerts = await v.t.run((ctx) => ctx.db.query("paymentAlerts").collect());
    // Première passe : l'absent au relevé n'est pas encore « en retard ».
    expect(alerts.map((a) => a.kind).sort()).toEqual(["amount_mismatch", "missing_here"]);
    const [rec] = await v.t.run((ctx) => ctx.db.query("providerReconciliations").withIndex("by_account_day", (q) => q.eq("providerAccountId", accountId).eq("dayUtc", day)).collect());
    expect(rec).toMatchObject({ passes: 1, amountMismatch: 1, missingHere: 1, missingAtProvider: 0, fees: 140, checkoutTotal: 9000 });
    // 3. Un paiement enregistré ici le lendemain, qu'aucun relevé ne montre : « en retard » seulement
    // après la seconde passe sur son jour.
    await v.t.run(async (ctx) => {
      const p = (await ctx.db.query("payments").collect())[0]!;
      const { _id, _creationTime, ...rest } = p;
      await ctx.db.insert("payments", { ...rest, providerRef: "cos-fantome", idempotencyKey: "online:cos-fantome", createdAt: p.createdAt + 86_400_000 });
    });
    await v.t.action(internal.onlinePayments.reconcileAll, { now: Date.now() + 2 * 86_400_000 });
    expect((await v.t.run((ctx) => ctx.db.query("paymentAlerts").collect())).some((a) => a.kind === "missing_at_provider")).toBe(false);
    await v.t.action(internal.onlinePayments.reconcileAll, { now: Date.now() + 3 * 86_400_000 });
    const after = await v.t.run((ctx) => ctx.db.query("paymentAlerts").collect());
    expect(after.find((a) => a.kind === "missing_at_provider")).toMatchObject({ severity: "critical" });
    payments = await v.payments();
    // L'indicateur : versé, et en retard pour le fantôme.
    const settlement = await v.t.run(async (ctx) => {
      const { settlementOf } = await import("../../convex/onlinePayments");
      return Promise.all(payments.map((p) => settlementOf(ctx, p)));
    });
    expect(settlement.sort()).toEqual(["late", "settled", "settled"]);
  });

  test("une clé sans le droit « Solde » : rapprochement indisponible, dit comme tel", async () => {
    const v = await waveVenue();
    await v.t.run(async (ctx) => {
      for (const a of await ctx.db.query("paymentProviderAccounts").collect()) await ctx.db.patch(a._id, { balanceAccess: false });
    });
    await v.t.action(internal.onlinePayments.reconcileAll, {});
    const rows = await v.t.run((ctx) => ctx.db.query("providerReconciliations").collect());
    expect(rows.map((r) => r.status)).toEqual(["unavailable", "unavailable"]);
  });
});

async function serveEverything(v: V) {
  const tickets = await v.t.run((ctx) => ctx.db.query("kitchenTickets").collect());
  for (const t of tickets) {
    if (t.status === "served") continue;
    await v.owner.as.mutation(api.kitchen.advance, { venueId: v.venueId, ticketId: t._id, action: "ready" });
    await v.waiter.as.mutation(api.orders.serveTicket, { venueId: v.venueId, ticketId: t._id });
  }
}

void (null as unknown as Id<"payments">);
