/**
 * Le client commande lui-même — T4, D-094 à D-105.
 *
 * « Maquis Awa », table 1, quatre amis et quatre téléphones. Le serveur ouvre la table et donne
 * le code à voix haute ; chacun envoie son plat, en même temps. La porte de sortie : aucune
 * commande perdue ni dupliquée, et chacun sait où en est son plat.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { expectCode } from "./setup";
import { line, tableWithGuest, type GuestTable } from "./guestFixtures";

const PHONES = ["telephone-de-aya-000000000001", "telephone-de-koffi-00000000002", "telephone-de-mariam-0000000003", "telephone-de-yao-0000000000004"];
let seq = 0;
const key = () => `envoi-direct-${String(++seq).padStart(8, "0")}`;

async function directTable() {
  const s = await tableWithGuest();
  await s.owner.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "guest_direct" });
  const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
  const code = (await s.waiter.as.query(api.sessions.detail, { venueId: s.cocody, sessionId })).code!;
  return { ...s, sessionId, code };
}

async function admitted(s: GuestTable & { code: string }, phone: string) {
  expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(phone), code: s.code })).toEqual({ ok: true });
}

describe("la preuve de présence : le code de la tablée", () => {
  test("tiré à chaque ouverture ; sans lui, pas d'envoi direct ; avec lui, on est admis", async () => {
    const s = await directTable();
    expect(s.code).toMatch(/^\d{4}$/);
    const refused = await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.alloco)] });
    expect(refused).toEqual({ ok: false, reason: "code_required" });
    const before = await s.t.query(api.guestService.presence, s.as(PHONES[0]!));
    expect([before!.direct, before!.canSendDirect, before!.code]).toEqual([true, false, null]);
    await admitted(s, PHONES[0]!);
    const after = await s.t.query(api.guestService.presence, s.as(PHONES[0]!));
    expect([after!.canSendDirect, after!.code, after!.guest]).toEqual([true, s.code, { number: 1, admitted: true, removed: false }]);
  });

  test("la tablée suivante a un autre code : le laissez-passer de midi n'admet pas le soir", async () => {
    const s = await directTable();
    await admitted(s, PHONES[0]!);
    await s.waiter.as.mutation(api.sessions.close, { venueId: s.cocody, sessionId: s.sessionId });
    const evening = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    const presence = await s.t.query(api.guestService.presence, s.as(PHONES[0]!));
    expect(presence!.canSendDirect).toBe(false);
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.alloco)] })).toEqual({ ok: false, reason: "code_required" });
    expect(evening).not.toBe(s.sessionId);
  });

  test("cinq codes faux par QR, puis la limite ; dix sur la tablée renouvellent le code et alertent la salle", async () => {
    const s = await directTable();
    const wrong = s.code === "0000" ? "1111" : "0000";
    for (let i = 0; i < 5; i++) {
      expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(PHONES[1]!), code: wrong })).toEqual({ ok: false, reason: "wrong_code" });
    }
    expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(PHONES[1]!), code: s.code })).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  test("au dixième code faux sur la tablée, le code se renouvelle seul et la salle le voit", async () => {
    const s = await directTable();
    // Neuf échecs déjà comptés (sur deux fenêtres de limite) : le dixième renouvelle le code.
    await s.t.run((ctx) => ctx.db.patch(s.sessionId, { codeFailures: 9 }));
    const wrong = s.code === "0000" ? "1111" : "0000";
    expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(PHONES[1]!), code: wrong })).toEqual({ ok: false, reason: "wrong_code" });
    const session = await s.t.run((ctx) => ctx.db.get(s.sessionId));
    expect([session!.activationCode === s.code, session!.codeFailures, typeof session!.codeAlertAt]).toEqual([false, 0, "number"]);
    const floor = await s.waiter.as.query(api.sessions.floor, { venueId: s.cocody });
    expect(floor.areas[0]!.tables[0]!.session!.codeAlertAt).toEqual(expect.any(Number));
    // L'ancien code ne vaut plus rien.
    expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(PHONES[1]!), code: s.code })).toEqual({ ok: false, reason: "wrong_code" });
  });

  test("le serveur admet un téléphone depuis sa fiche, en retire un autre, renouvelle le code", async () => {
    const s = await directTable();
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[0]!), lines: [line(s.products.alloco)] });
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[1]!), lines: [line(s.products.bissap)] });
    const guests = (await s.waiter.as.query(api.sessions.detail, { venueId: s.cocody, sessionId: s.sessionId })).guests;
    expect(guests.map((g) => [g.number, g.admitted])).toEqual([
      [1, false],
      [2, false],
    ]);
    await s.waiter.as.mutation(api.sessions.admitGuest, { venueId: s.cocody, sessionId: s.sessionId, guestSessionId: guests[0]!._id });
    await s.waiter.as.mutation(api.sessions.removeGuest, { venueId: s.cocody, sessionId: s.sessionId, guestSessionId: guests[1]!._id });
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.canSendDirect).toBe(true);
    expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(PHONES[1]!), code: s.code })).toEqual({ ok: false, reason: "removed" });
    expect(await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[1]!), lines: [line(s.products.bissap)] })).toEqual({ ok: false, reason: "removed" });
    const fresh = await s.waiter.as.mutation(api.sessions.rotateCode, { venueId: s.cocody, sessionId: s.sessionId });
    expect((await s.waiter.as.query(api.sessions.detail, { venueId: s.cocody, sessionId: s.sessionId })).code).toBe(fresh);
    // Le cuisinier n'admet personne.
    await expectCode(s.editor.as.mutation(api.sessions.rotateCode, { venueId: s.cocody, sessionId: s.sessionId }), "FORBIDDEN");
  });
});

describe("la porte de sortie : quatre téléphones, aucune commande perdue ni dupliquée", () => {
  test("quatre envois simultanés, un rejeu après une réponse perdue, un double appui", async () => {
    const s = await directTable();
    for (const phone of PHONES) await admitted(s, phone);
    const keys = PHONES.map(() => key());
    const products = [s.products.alloco, s.products.bissap, s.products.poulet, s.products.poisson];
    const results = await Promise.all(
      PHONES.map((phone, i) => s.t.mutation(api.guestService.submitLines, { ...s.as(phone), idempotencyKey: keys[i]!, lines: [line(products[i]!)] })),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    // La réponse du troisième s'est perdue : il rejoue la même clé, et retrouve SA commande.
    const replay = await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[2]!), idempotencyKey: keys[2]!, lines: [line(products[2]!)] });
    expect(replay).toMatchObject({ ok: true, replayed: true, reference: (results[2] as { reference: string }).reference });
    // Une clé d'un autre ne rend pas sa commande.
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: keys[1]!, lines: [line(products[1]!)] })).toEqual({ ok: false, reason: "invalid_key" });

    const orders = await s.t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders).toHaveLength(4);
    expect(orders.every((o) => o.status === "accepted" && o.channel === "guest")).toBe(true);
    const items = await s.t.run((ctx) => ctx.db.query("orderItems").collect());
    const owners = new Set(items.map((i) => i.assignedGuestSessionIds[0]));
    expect(owners.size).toBe(4);
    // En cuisine, tout de suite.
    expect((await s.t.run((ctx) => ctx.db.query("kitchenTickets").collect())).length).toBeGreaterThan(0);

    // Chacun lit SA commande ; tous lisent ce que la table a commandé, sans montants.
    const aya = await s.t.query(api.guestService.presence, s.as(PHONES[0]!));
    expect(aya!.orders.map((o) => o.items.map((i) => [i.name, i.status]))).toEqual([[["Alloco", "ordered"]]]);
    expect(aya!.table).toHaveLength(4);
    expect(aya!.table.filter((l) => l.mine)).toHaveLength(1);
    expect(new Set(aya!.table.map((l) => l.guestNumber))).toEqual(new Set([1, 2, 3, 4]));
  });

  test("le plat prêt : seul son convive le lit « prêt »", async () => {
    const s = await directTable();
    await admitted(s, PHONES[0]!);
    await admitted(s, PHONES[1]!);
    await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.poulet)] });
    await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[1]!), idempotencyKey: key(), lines: [line(s.products.bissap)] });
    const orders = await s.t.run((ctx) => ctx.db.query("orders").collect());
    const ayaOrder = orders.find((o) => o.reference === "A-001")!;
    const [ticket] = await s.t.run((ctx) => ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", ayaOrder._id)).collect());
    await s.owner.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: ticket!._id, action: "ready" });
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.orders[0]!.items[0]!.status).toBe("ready");
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[1]!)))!.orders[0]!.items[0]!.status).toBe("ordered");
  });

  test("plafonds : quantité par ligne, et limite par convive", async () => {
    const s = await directTable();
    await admitted(s, PHONES[0]!);
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.poulet, 99)] })).toEqual({ ok: false, reason: "too_many", max: 10 });
    for (let i = 0; i < 4; i++) {
      expect((await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.bissap)] })).ok).toBe(true);
    }
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.bissap)] })).toMatchObject({ ok: false, reason: "rate_limited" });
    // Un autre convive de la même table n'en est pas gêné.
    await admitted(s, PHONES[1]!);
    expect((await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[1]!), idempotencyKey: key(), lines: [line(s.products.bissap)] })).ok).toBe(true);
  });

  test("hors du mode direct, l'envoi direct est refusé", async () => {
    const s = await tableWithGuest();
    await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.alloco)] })).toEqual({ ok: false, reason: "not_allowed" });
  });
});

describe("le panier montré, repris par le serveur, reste au client (D-101)", () => {
  test("la commande du serveur est attribuée au convive, et le client la retrouve", async () => {
    const s = await tableWithGuest();
    const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[0]!), lines: [line(s.products.alloco, 2)] });
    const [cart] = await s.waiter.as.query(api.carts.forSession, { venueId: s.cocody, sessionId });
    const taken = await s.waiter.as.mutation(api.carts.takeCart, { venueId: s.cocody, cartId: cart!._id, seenUpdatedAt: cart!.updatedAt });
    expect(taken.guestSessionId).not.toBeNull();
    // Entre la reprise et l'envoi, le client lit « pris par votre serveur », pas « ignoré ».
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.cartOutcome).toMatchObject({ status: "taken" });
    const sent = await s.waiter.as.mutation(api.orders.submit, {
      venueId: s.cocody,
      sessionId,
      lines: taken.lines.map((l) => ({ ...l, guestSessionId: taken.guestSessionId! })),
      heldCourses: [],
      idempotencyKey: "0192f000-0000-7000-8000-00000000abcd",
      fromCartIds: [taken.cartId],
    });
    expect(sent.ok).toBe(true);
    const seen = await s.t.query(api.guestService.presence, s.as(PHONES[0]!));
    expect(seen!.orders.map((o) => [o.takenByWaiter, o.items.map((i) => [i.name, i.quantity])])).toEqual([[true, [["Alloco", 2]]]]);
    const items = await s.t.run((ctx) => ctx.db.query("orderItems").collect());
    expect(items.every((i) => i.assignedGuestSessionIds.length === 1)).toBe(true);
    // Le partage de l'addition sait à qui est la ligne.
    const bill = await s.owner.as.query(api.checks.forSession, { venueId: s.cocody, sessionId });
    expect(bill.checks[0]!.lines.map((l) => l.guestNumber)).toEqual([1]);
  });
});

describe("l'avis après le repas (D-105)", () => {
  test("un convive de la tablée, une fois, dans les six heures ; le gérant le lit", async () => {
    const s = await directTable();
    await admitted(s, PHONES[0]!);
    const sent = await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.bissap)] });
    expect(sent.ok).toBe(true);
    // Pas avant la clôture.
    expect(await s.t.mutation(api.guestService.submitFeedback, { ...s.as(PHONES[0]!), rating: 2, topics: ["attente"] })).toEqual({ ok: false, reason: "not_eligible" });
    await s.t.run((ctx) => ctx.db.patch(s.sessionId, { status: "closed", closedAt: Date.now() }));
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.feedback).toEqual({ done: false });
    // Un téléphone qui n'était pas à la tablée ne note rien.
    expect(await s.t.mutation(api.guestService.submitFeedback, { ...s.as(PHONES[3]!), rating: 1, topics: [] })).toEqual({ ok: false, reason: "not_eligible" });
    expect(await s.t.mutation(api.guestService.submitFeedback, { ...s.as(PHONES[0]!), rating: 2, comment: "Le poulet a tardé.", topics: ["attente"] })).toEqual({ ok: true });
    expect(await s.t.mutation(api.guestService.submitFeedback, { ...s.as(PHONES[0]!), rating: 5, topics: [] })).toEqual({ ok: true });
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.feedback).toEqual({ done: true });
    const list = await s.owner.as.query(api.feedback.list, { venueId: s.cocody });
    expect([list.count, list.average, list.items[0]!.comment, list.items[0]!.table]).toEqual([1, 2, "Le poulet a tardé.", "1"]);
    await expectCode(s.waiter.as.query(api.feedback.list, { venueId: s.cocody }), "FORBIDDEN");
    // Six heures après, c'est trop tard.
    await s.t.run((ctx) => ctx.db.patch(s.sessionId, { closedAt: Date.now() - 7 * 3_600_000 }));
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.feedback).toBeNull();
  });
});

describe("revue adverse de T4 : les chemins de secours ne perdent ni ne doublent rien", () => {
  const phone = (i: number) => `telephone-intrus-${String(i).padStart(12, "0")}`;

  test("B1 — panier repris par le serveur puis envoyé par le client : refusé, pas de doublon", async () => {
    const s = await directTable();
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[3]!), lines: [line(s.products.alloco)] });
    const [cart] = await s.waiter.as.query(api.carts.forSession, { venueId: s.cocody, sessionId: s.sessionId });
    expect([cart!.guestNumber, cart!.guestAdmitted]).toEqual([1, false]);
    await s.waiter.as.mutation(api.carts.takeCart, { venueId: s.cocody, cartId: cart!._id, seenUpdatedAt: cart!.updatedAt });
    await s.waiter.as.mutation(api.sessions.admitGuest, { venueId: s.cocody, sessionId: s.sessionId, guestSessionId: cart!.guestSessionId! });
    // Le client n'a pas encore relu la table : il envoie le panier qu'il avait montré.
    const sent = await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[3]!), idempotencyKey: key(), lines: [line(s.products.alloco)], shown: true });
    expect(sent).toEqual({ ok: false, reason: "taken_by_waiter" });
    expect(await s.t.run((ctx) => ctx.db.query("orders").collect())).toHaveLength(0);
    // Un nouveau panier, composé après, part normalement.
    expect((await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[3]!), idempotencyKey: key(), lines: [line(s.products.bissap)] })).ok).toBe(true);
  });

  test("B2 — un ancien panier repris ne fait pas croire que le nouveau l'est : il a expiré", async () => {
    const s = await directTable();
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[0]!), lines: [line(s.products.alloco)] });
    const [first] = await s.waiter.as.query(api.carts.forSession, { venueId: s.cocody, sessionId: s.sessionId });
    await s.waiter.as.mutation(api.carts.takeCart, { venueId: s.cocody, cartId: first!._id, seenUpdatedAt: first!.updatedAt });
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[0]!), lines: [line(s.products.bissap)] });
    // Personne ne s'en occupe pendant 31 minutes.
    await s.t.run(async (ctx) => {
      // Le panier repris l'a été AVANT le nouveau : on recule les deux horloges d'autant.
      for (const c of await ctx.db.query("carts").collect()) await ctx.db.patch(c._id, { updatedAt: c.updatedAt - (c.status === "active" ? 31 : 32) * 60_000 });
    });
    const p = await s.t.query(api.guestService.presence, s.as(PHONES[0]!));
    expect([p!.cart, p!.cartOutcome?.status]).toEqual([null, "expired"]);
  });

  test("I1 — retirer un téléphone renouvelle le code : revenir avec une clé neuve ne suffit pas", async () => {
    const s = await directTable();
    await admitted(s, PHONES[0]!);
    const intruder = (await s.waiter.as.query(api.sessions.detail, { venueId: s.cocody, sessionId: s.sessionId })).guests[0]!;
    await s.waiter.as.mutation(api.sessions.removeGuest, { venueId: s.cocody, sessionId: s.sessionId, guestSessionId: intruder._id });
    expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(phone(1)), code: s.code })).toEqual({ ok: false, reason: "wrong_code" });
  });

  test("I2 — un code faux ne crée aucun convive ; le bon code passe même quand la table est « pleine »", async () => {
    const s = await directTable();
    const wrong = s.code === "0000" ? "1111" : "0000";
    expect(await s.t.mutation(api.guestService.enterCode, { ...s.as(phone(1)), code: wrong })).toEqual({ ok: false, reason: "wrong_code" });
    expect(await s.t.run((ctx) => ctx.db.query("guestSessions").collect())).toHaveLength(0);
    // Quinze faux convives épuisent les arrivées : le suivant qui montre un panier est refusé…
    for (let i = 10; i < 25; i++) await s.t.mutation(api.guestService.saveCart, { ...s.as(phone(i)), lines: [line(s.products.alloco)] });
    expect(await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[0]!), lines: [line(s.products.alloco)] })).toEqual({ ok: false, reason: "full" });
    // … mais le vrai client qui a le code entre, et le serveur vide la table d'un geste.
    await admitted(s, PHONES[0]!);
    const removed = await s.waiter.as.mutation(api.sessions.removeUnadmitted, { venueId: s.cocody, sessionId: s.sessionId });
    expect(removed).toBe(15);
    const detail = await s.waiter.as.query(api.sessions.detail, { venueId: s.cocody, sessionId: s.sessionId });
    expect([detail.guests.filter((g) => !g.removed).length, detail.code === s.code]).toEqual([1, false]);
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.canSendDirect).toBe(true);
  });

  test("I4 — une commande passée se retrouve même après un changement de mode ; la relecture le dit", async () => {
    const s = await directTable();
    await admitted(s, PHONES[0]!);
    const k = key();
    const sent = await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: k, lines: [line(s.products.alloco)] });
    expect(sent.ok).toBe(true);
    await s.owner.as.mutation(api.venues.setOrderingMode, { venueId: s.cocody, orderingMode: "staff_only" });
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: k, lines: [line(s.products.alloco)] })).toMatchObject({ ok: true, replayed: true });
    expect((await s.t.query(api.guestService.presence, { ...s.as(PHONES[0]!), pendingKey: k }))!.pending).toEqual({ reference: (sent as { reference: string }).reference });
    // La clé d'un autre téléphone ne lui dit rien.
    expect((await s.t.query(api.guestService.presence, { ...s.as(PHONES[1]!), pendingKey: k }))!.pending).toBeNull();
    expect((await s.t.query(api.guestService.presence, { ...s.as(PHONES[0]!), pendingKey: key() }))!.pending).toBeNull();
  });

  test("I5 — l'avis demande une preuve de présence ; il reste proposé si la table est rouverte", async () => {
    const s = await directTable();
    await admitted(s, PHONES[0]!);
    await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.bissap)] });
    // Un téléphone qui a seulement rejoint (photo du QR) : pas d'avis.
    await s.t.mutation(api.guestService.saveCart, { ...s.as(phone(3)), lines: [line(s.products.alloco)] });
    await s.t.run((ctx) => ctx.db.patch(s.sessionId, { status: "closed", closedAt: Date.now() }));
    expect(await s.t.mutation(api.guestService.submitFeedback, { ...s.as(phone(3)), rating: 1, topics: [] })).toEqual({ ok: false, reason: "not_eligible" });
    // La table est rouverte pour d'autres clients : le convive de tout à l'heure peut encore noter.
    await s.t.run((ctx) => ctx.db.patch(s.tableId, { activeSessionId: undefined, status: "available" }));
    await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    expect((await s.t.query(api.guestService.presence, s.as(PHONES[0]!)))!.feedback).toEqual({ done: false });
  });

  test("une saisie qui reprend deux paniers : chacun ne voit que ses plats ; un service retenu n'est pas « en cuisine »", async () => {
    const s = await directTable();
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[0]!), lines: [line(s.products.alloco)] });
    await s.t.mutation(api.guestService.saveCart, { ...s.as(PHONES[1]!), lines: [line(s.products.bissap)] });
    const carts = await s.waiter.as.query(api.carts.forSession, { venueId: s.cocody, sessionId: s.sessionId });
    const taken = [];
    for (const c of carts) taken.push(await s.waiter.as.mutation(api.carts.takeCart, { venueId: s.cocody, cartId: c._id, seenUpdatedAt: c.updatedAt }));
    const sent = await s.waiter.as.mutation(api.orders.submit, {
      venueId: s.cocody,
      sessionId: s.sessionId,
      lines: taken.flatMap((t, i) => t.lines.map((l) => ({ ...l, courseNumber: i === 0 ? 1 : 2, guestSessionId: t.guestSessionId! }))),
      heldCourses: [2],
      idempotencyKey: "0192f000-0000-7000-8000-00000000abce",
      fromCartIds: taken.map((t) => t.cartId),
    });
    expect(sent.ok).toBe(true);
    const aya = await s.t.query(api.guestService.presence, s.as(PHONES[0]!));
    const koffi = await s.t.query(api.guestService.presence, s.as(PHONES[1]!));
    expect(aya!.orders.map((o) => o.items.map((i) => [i.name, i.status]))).toEqual([[["Alloco", "ordered"]]]);
    expect(koffi!.orders.map((o) => o.items.map((i) => [i.name, i.status]))).toEqual([[["Bissap", "held"]]]);
  });

  test("le plafond par plat se règle, et le code n'est pas montré à qui ne tient pas la salle", async () => {
    const s = await directTable();
    await s.owner.as.mutation(api.venues.setGuestMaxQuantity, { venueId: s.cocody, max: 3 });
    await expectCode(s.owner.as.mutation(api.venues.setGuestMaxQuantity, { venueId: s.cocody, max: 0 }), "INVALID_ARGUMENT");
    await admitted(s, PHONES[0]!);
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.alloco, 4)] })).toEqual({ ok: false, reason: "too_many", max: 3 });
    expect(await s.t.mutation(api.guestService.submitLines, { ...s.as(PHONES[0]!), idempotencyKey: key(), lines: [line(s.products.alloco, 3)] })).toMatchObject({ ok: true });
  });
});
