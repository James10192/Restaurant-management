/**
 * Le client à table — T2, D-061.
 *
 * « Maquis Awa », table 1 : le client scanne, appelle un serveur avant même que la table soit
 * ouverte, compose un panier à montrer que le serveur importe d'un geste ; en mode
 * « validation », il envoie lui-même, sous garde-fous.
 */

import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode } from "./setup";

const PHONE_1 = "telephone-de-aya-000000000001";
const PHONE_2 = "telephone-de-koffi-00000000002";

async function tableWithGuest() {
  const r = await restaurantWithMenu();
  const { owner, cocody } = r;
  await owner.as.mutation(api.publications.publish, { venueId: cocody, menuId: r.menuId });
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId: cocody, names: ["Salle"] });
  const tableId = await owner.as.mutation(api.floor.createTable, { venueId: cocody, serviceAreaId: areaId!, number: "1", seats: 4, shape: "square" });
  const sheet = await owner.as.query(api.qr.sheet, { venueId: cocody });
  const scanned = await r.t.mutation(api.guest.exchange, { token: sheet.areas[0]!.cards[0]!.token });
  if (!scanned.ok) throw new Error("scan refusé");
  const as = (guestKey: string) => ({ pass: scanned.pass, venueSlug: scanned.venueSlug, guestKey });
  return { ...r, tableId, as };
}

type Table = Awaited<ReturnType<typeof tableWithGuest>>;

function line(productId: string, quantity = 1) {
  return { productId, optionIds: [], quantity };
}

let keySeq = 0;
const key = () => `client-envoi-${String(++keySeq).padStart(8, "0")}`;

async function openTable(s: Table) {
  return s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
}

describe("avant l'ouverture de la table", () => {
  test("le client appelle un serveur ; le serveur le voit ; un second appui n'en crée pas un second", async () => {
    const s = await tableWithGuest();
    const first = await s.t.mutation(api.guestService.requestService, { ...s.as(PHONE_1), type: "call_waiter" });
    expect(first).toMatchObject({ ok: true, already: false });
    expect(await s.t.mutation(api.guestService.requestService, { ...s.as(PHONE_2), type: "call_waiter" })).toMatchObject({ ok: true, already: true });
    const floor = await s.waiter.as.query(api.sessions.floor, { venueId: s.cocody });
    expect(floor.areas[0]!.tables[0]).toMatchObject({ session: null, waitingRequests: 1 });
    const queue = await s.waiter.as.query(api.serviceRequests.open, { venueId: s.cocody });
    expect(queue.requests.map((r) => [r.tableNumber, r.label, r.tableOpen])).toEqual([["1", "Appeler un serveur", false]]);
  });

  test("rien ne se compose tant que le personnel n'a pas ouvert la table (D-045)", async () => {
    const s = await tableWithGuest();
    expect(await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_1), lines: [line(s.products.alloco)] })).toEqual({ ok: false, reason: "table_not_open" });
    expect(await s.t.query(api.guestService.presence, s.as(PHONE_1))).toMatchObject({ tableOpen: false, joined: false, cart: null });
  });

  test("un type de demande inconnu ou désactivé est refusé", async () => {
    const s = await tableWithGuest();
    expect(await s.t.mutation(api.guestService.requestService, { ...s.as(PHONE_1), type: "champagne" })).toEqual({ ok: false, reason: "unknown_type" });
  });
});

describe("le panier à montrer (mode par défaut)", () => {
  test("chaque téléphone a son panier ; le serveur l'importe, et c'est sa commande", async () => {
    const s = await tableWithGuest();
    await openTable(s);
    await s.owner.as.mutation(api.availability.setProduct, { venueId: s.cocody, productId: s.products.poisson, isAvailable: false });
    const saved = await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_1), lines: [line(s.products.alloco, 2), line(s.products.poisson)] });
    expect(saved).toMatchObject({ ok: true, problems: [{ index: 1, code: "ITEM_UNAVAILABLE" }] });
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_2), lines: [line(s.products.bissap, 3)] });

    const mine = await s.t.query(api.guestService.presence, s.as(PHONE_1));
    expect(mine).toMatchObject({ tableOpen: true, joined: true, canSend: false, cart: { estimatedTotal: 2000 } });
    expect(mine!.cart!.lines.map((l) => [l.quantity, l.estimatedUnitPrice])).toEqual([[2, 1000]]);

    const carts = await s.waiter.as.query(api.carts.forSession, { venueId: s.cocody, sessionId: (await s.waiter.as.query(api.sessions.floor, { venueId: s.cocody })).areas[0]!.tables[0]!.session!._id });
    expect(carts.map((c) => c.items.map((i) => `${i.quantity} ${i.name}`))).toEqual([["2 Alloco"], ["3 Bissap"]]);

    const idempotencyKey = key();
    const imported = await s.waiter.as.mutation(api.carts.importCart, { venueId: s.cocody, cartId: carts[0]!._id, idempotencyKey });
    if (!imported.ok) throw new Error("import refusé");
    const order = (await s.t.run((ctx) => ctx.db.get(imported.orderId)))!;
    expect([order.channel, order.status, order.placedByMemberId]).toEqual(["staff", "accepted", s.waiter.memberId]);
    // Rejoué : la même commande.
    expect(await s.waiter.as.mutation(api.carts.importCart, { venueId: s.cocody, cartId: carts[0]!._id, idempotencyKey })).toMatchObject({ ok: true, orderId: imported.orderId });
    // Le client voit sa commande, et son panier est vidé.
    const after = await s.t.query(api.guestService.presence, s.as(PHONE_1));
    expect(after).toMatchObject({ cart: null, orders: [{ reference: "A-001", label: "Reçue, bientôt en préparation" }] });
  });

  test("en mode par défaut, le client ne peut pas envoyer lui-même", async () => {
    const s = await tableWithGuest();
    await openTable(s);
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_1), lines: [line(s.products.alloco)] });
    expect(await s.t.mutation(api.guestService.submitCart, { ...s.as(PHONE_1), idempotencyKey: key() })).toEqual({ ok: false, reason: "not_allowed" });
    expect(await s.t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);
  });

  test("ignorer un panier : rien n'est commandé", async () => {
    const s = await tableWithGuest();
    const sessionId = await openTable(s);
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_1), lines: [line(s.products.alloco)] });
    const [cart] = await s.waiter.as.query(api.carts.forSession, { venueId: s.cocody, sessionId });
    await s.waiter.as.mutation(api.carts.dismissCart, { venueId: s.cocody, cartId: cart!._id });
    expect(await s.waiter.as.query(api.carts.forSession, { venueId: s.cocody, sessionId })).toEqual([]);
    expect((await s.t.query(api.guestService.presence, s.as(PHONE_1)))!.cart).toBeNull();
  });
});

describe("la validation par le serveur (réglage)", () => {
  test("le mode se règle avec son droit ; la commande directe reste refusée", async () => {
    const s = await tableWithGuest();
    await expectCode(s.waiter.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "guest_with_approval" }), "FORBIDDEN");
    await expectCode(s.owner.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "guest_direct" }), "INVALID_ARGUMENT");
    await expectCode(s.owner.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "hybrid" }), "INVALID_ARGUMENT");
    await s.owner.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "guest_with_approval" });
    const audit = await s.t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(audit.some((a) => a.action === "venue.settings.ordering_mode")).toBe(true);
  });

  test("envoyée, elle attend ; rien en cuisine ; à 90 s l'alerte monte ; à 10 min elle expire", async () => {
    const s = await tableWithGuest();
    await s.owner.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "guest_with_approval" });
    await openTable(s);
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_1), lines: [line(s.products.alloco)] });
    expect(await s.t.mutation(api.guestService.submitCart, { ...s.as(PHONE_1), idempotencyKey: key() })).toMatchObject({ ok: true, reference: "A-001" });
    expect(await s.t.run((ctx) => ctx.db.query("kitchenTickets").collect())).toEqual([]);
    expect((await s.t.query(api.guestService.presence, s.as(PHONE_1)))!.orders[0]!.label).toBe("Pas encore en cuisine — en attente du serveur");

    const pending = await s.waiter.as.query(api.orders.pendingAcceptance, { venueId: s.cocody });
    expect(pending.map((o) => [o.reference, o.escalated])).toEqual([["A-001", false]]);
    const orderId = pending[0]!._id;
    await s.t.run((ctx) => ctx.db.patch(orderId, { submittedAt: Date.now() - 2 * 60_000 }));
    expect((await s.waiter.as.query(api.orders.pendingAcceptance, { venueId: s.cocody }))[0]!.escalated).toBe(true);

    await s.t.mutation(internal.guestService.expirePending, { orderId });
    const seen = await s.t.query(api.guestService.presence, s.as(PHONE_1));
    expect(seen!.orders[0]).toMatchObject({ label: "Refusée", rejectedReason: "Personne n'a pu la valider à temps. Appelez un serveur." });
  });

  test("acceptée, elle part en cuisine", async () => {
    const s = await tableWithGuest();
    await s.owner.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "guest_with_approval" });
    await openTable(s);
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_1), lines: [line(s.products.alloco)] });
    await s.t.mutation(api.guestService.submitCart, { ...s.as(PHONE_1), idempotencyKey: key() });
    const [pending] = await s.waiter.as.query(api.orders.pendingAcceptance, { venueId: s.cocody });
    await s.waiter.as.mutation(api.orders.accept, { venueId: s.cocody, orderId: pending!._id });
    expect((await s.t.run((ctx) => ctx.db.query("kitchenTickets").collect())).map((t) => t.status)).toEqual(["queued"]);
    // L'expiration programmée ne touche pas une commande déjà acceptée.
    await s.t.mutation(internal.guestService.expirePending, { orderId: pending!._id });
    expect((await s.t.run((ctx) => ctx.db.get(pending!._id)))!.status).toBe("accepted");
  });
});

describe("le personnel traite les demandes", () => {
  test("prendre en charge, puis clore", async () => {
    const s = await tableWithGuest();
    await openTable(s);
    await s.t.mutation(api.guestService.requestService, { ...s.as(PHONE_1), type: "request_bill" });
    const [request] = (await s.waiter.as.query(api.serviceRequests.open, { venueId: s.cocody })).requests;
    expect(request).toMatchObject({ label: "Demander l'addition", status: "open", isMine: true });
    await s.waiter.as.mutation(api.serviceRequests.acknowledge, { venueId: s.cocody, requestId: request!._id });
    expect((await s.floor.as.query(api.serviceRequests.open, { venueId: s.cocody })).requests[0]!.acknowledgedBy).toBe("serveur@maquis.ci");
    await s.waiter.as.mutation(api.serviceRequests.resolve, { venueId: s.cocody, requestId: request!._id });
    expect((await s.waiter.as.query(api.serviceRequests.open, { venueId: s.cocody })).requests).toEqual([]);
  });
});

describe("le laissez-passer reste la seule clé", () => {
  test("un QR révoqué coupe tout : lecture, panier, demandes", async () => {
    const s = await tableWithGuest();
    await openTable(s);
    await s.owner.as.mutation(api.qr.rotate, { venueId: s.cocody, tableId: s.tableId });
    expect(await s.t.query(api.guestService.presence, s.as(PHONE_1))).toBeNull();
    expect(await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONE_1), lines: [line(s.products.alloco)] })).toEqual({ ok: false, reason: "invalid_pass" });
    expect(await s.t.mutation(api.guestService.requestService, { ...s.as(PHONE_1), type: "call_waiter" })).toEqual({ ok: false, reason: "invalid_pass" });
  });
});
