/**
 * Un service complet, de l'ouverture de la table à sa clôture — tranche T2.
 *
 * « Maquis Awa », Cocody : une cuisine, un bar, une table 1. Le serveur ouvre la table et
 * commande en trois services ; la cuisine et le bar produisent ; le serveur sert, puis clôt.
 * Chaque étape vérifie ce que voit l'écran concerné, pas seulement la base.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode, inviteAndJoin } from "./setup";

async function serviceReady() {
  const r = await restaurantWithMenu();
  const { owner, cocody } = r;
  await owner.as.mutation(api.publications.publish, { venueId: cocody, menuId: r.menuId });
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId: cocody, names: ["Terrasse"] });
  const tableId = await owner.as.mutation(api.floor.createTable, {
    venueId: cocody,
    serviceAreaId: areaId!,
    number: "1",
    seats: 4,
    shape: "square",
  });
  const cuisine = await owner.as.mutation(api.stations.create, { venueId: cocody, name: "Cuisine", type: "kitchen" });
  const bar = await owner.as.mutation(api.stations.create, { venueId: cocody, name: "Bar", type: "bar" });
  await owner.as.mutation(api.stations.routeSection, { venueId: cocody, sectionId: r.sections.boissons, stationId: bar });
  const cook = await inviteAndJoin(
    r.t,
    owner,
    { organizationId: r.organizationId, roleId: r.roleId("kitchen"), venueIds: [cocody] },
    { email: "cuisine@maquis.ci" },
  );
  return { ...r, tableId, cuisine, bar, cook };
}

type Service = Awaited<ReturnType<typeof serviceReady>>;

let keySeq = 0;
const key = () => `test-envoi-${String(++keySeq).padStart(8, "0")}`;

function line(productId: Id<"products">, courseNumber = 1, quantity = 1) {
  return { productId, optionIds: [], quantity, courseNumber };
}

async function openAndOrder(s: Service) {
  const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId, guestCount: 3 });
  const idempotencyKey = key();
  const sent = await s.waiter.as.mutation(api.orders.submit, {
    venueId: s.cocody,
    sessionId,
    lines: [line(s.products.bissap, 1, 3), line(s.products.alloco, 2), line(s.products.poulet, 3, 2)],
    heldCourses: [3],
    idempotencyKey,
  });
  if (!sent.ok) throw new Error(JSON.stringify(sent.problems));
  return { sessionId, orderId: sent.orderId, reference: sent.reference, idempotencyKey };
}

async function ticketsOf(s: Service, orderId: Id<"orders">) {
  return s.t.run((ctx) => ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", orderId)).collect());
}

describe("service complet", () => {
  test("une commande se découpe en un bon par poste et par service", async () => {
    const s = await serviceReady();
    const { orderId, reference } = await openAndOrder(s);
    expect(reference).toBe("A-001");
    const tickets = await ticketsOf(s, orderId);
    expect(tickets.map((t) => [t.reference, t.status, t.itemCount]).sort()).toEqual([
      ["A-001-BAR-1", "queued", 3],
      ["A-001-CUI-2", "queued", 1],
      ["A-001-CUI-3", "held", 2],
    ]);
    // Le bar ne voit que le bissap ; la cuisine ne voit pas le service retenu.
    const bar = await s.cook.as.query(api.kitchen.board, { venueId: s.cocody, stationId: s.bar });
    expect(bar.active.map((t) => t.lines.map((l) => `${l.quantity} ${l.name}`))).toEqual([["3 Bissap"]]);
    const cuisine = await s.cook.as.query(api.kitchen.board, { venueId: s.cocody, stationId: s.cuisine });
    expect(cuisine.active.map((t) => t.reference)).toEqual(["A-001-CUI-2"]);
    expect(cuisine.allDay).toEqual([{ name: "Alloco", quantity: 1 }]);
  });

  test("les prix viennent de la carte publiée, jamais de l'écran", async () => {
    const s = await serviceReady();
    const { orderId } = await openAndOrder(s);
    const order = await s.t.run((ctx) => ctx.db.get(orderId));
    // 3 × 500 + 1000 + 2 × 3500
    expect(order!.totals.subtotal).toBe(9500);
    const items = await s.t.run((ctx) => ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", orderId)).collect());
    expect(items.map((i) => [i.nameSnapshot, i.unitPrice, i.lineTotal]).sort()).toEqual([
      ["Alloco", 1000, 1000],
      ["Bissap", 500, 1500],
      ["Poulet braisé", 3500, 7000],
    ]);
    // Un prix changé APRÈS l'envoi ne touche pas la commande (R6).
    await s.owner.as.mutation(api.products.setPrice, { venueId: s.cocody, productId: s.products.bissap, basePrice: 800 });
    const again = await s.t.run((ctx) => ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", orderId)).collect());
    expect(again.find((i) => i.nameSnapshot === "Bissap")!.unitPrice).toBe(500);
  });

  test("un double envoi ne crée pas deux commandes (R7)", async () => {
    const s = await serviceReady();
    const { sessionId, orderId, idempotencyKey } = await openAndOrder(s);
    const replay = await s.waiter.as.mutation(api.orders.submit, {
      venueId: s.cocody,
      sessionId,
      lines: [line(s.products.bissap)],
      heldCourses: [],
      idempotencyKey,
    });
    expect(replay).toMatchObject({ ok: true, orderId, replayed: true });
    const orders = await s.t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders).toHaveLength(1);
  });

  test("de la cuisine à la table, puis la clôture", async () => {
    const s = await serviceReady();
    const { sessionId, orderId } = await openAndOrder(s);
    const byRef = async (ref: string) => (await ticketsOf(s, orderId)).find((t) => t.reference === ref)!;
    const status = async () => (await s.t.run((ctx) => ctx.db.get(orderId)))!.status;

    const alloco = await byRef("A-001-CUI-2");
    await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: alloco._id, action: "start" });
    expect(await status()).toBe("in_preparation");
    await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: alloco._id, action: "ready" });
    expect(await status()).toBe("partially_ready");
    // Un double appui ne fait rien ; revenir en arrière est refusé en disant pourquoi.
    expect(await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: alloco._id, action: "ready" })).toEqual({ changed: false });
    await expectCode(s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: alloco._id, action: "start" }), "CONFLICT");

    const toServe = await s.waiter.as.query(api.orders.readyToServe, { venueId: s.cocody });
    expect(toServe.tickets.map((t) => [t.reference, t.tableNumber, t.isMine])).toEqual([["A-001-CUI-2", "1", true]]);
    await s.waiter.as.mutation(api.orders.serveTicket, { venueId: s.cocody, ticketId: alloco._id });
    expect(await status()).toBe("partially_served");
    expect((await s.waiter.as.query(api.orders.readyToServe, { venueId: s.cocody })).tickets).toEqual([]);

    // La table ne se clôt pas avec des plats en cours.
    await expectCode(s.waiter.as.mutation(api.sessions.close, { venueId: s.cocody, sessionId }), "CONFLICT");

    // « Envoyez la suite » : le service 3 part en cuisine.
    expect(await s.waiter.as.mutation(api.orders.fireCourse, { venueId: s.cocody, sessionId, courseNumber: 3 })).toBe(1);
    const cuisine = await s.cook.as.query(api.kitchen.board, { venueId: s.cocody, stationId: s.cuisine });
    expect(cuisine.active.map((t) => t.reference)).toEqual(["A-001-CUI-3"]);

    for (const ref of ["A-001-CUI-3", "A-001-BAR-1"]) {
      const t = await byRef(ref);
      await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: t._id, action: "ready" });
      await s.waiter.as.mutation(api.orders.serveTicket, { venueId: s.cocody, ticketId: t._id });
    }
    expect(await status()).toBe("served");

    await s.waiter.as.mutation(api.sessions.close, { venueId: s.cocody, sessionId });
    const [session, table] = await s.t.run(async (ctx) => [await ctx.db.get(sessionId), await ctx.db.get(s.tableId)] as const);
    expect(session!.status).toBe("closed");
    expect([table!.status, table!.activeSessionId]).toEqual(["available", undefined]);
    // Rejouer la clôture ne fait rien.
    await s.waiter.as.mutation(api.sessions.close, { venueId: s.cocody, sessionId });
  });

  test("un plat rappelé repasse devant en cuisine", async () => {
    const s = await serviceReady();
    const { orderId } = await openAndOrder(s);
    const tickets = await ticketsOf(s, orderId);
    const alloco = tickets.find((t) => t.reference === "A-001-CUI-2")!;
    await s.waiter.as.mutation(api.orders.fireCourse, { venueId: s.cocody, sessionId: alloco.tableSessionId, courseNumber: 3 });
    await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: alloco._id, action: "ready" });
    await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: alloco._id, action: "recall" });
    const board = await s.cook.as.query(api.kitchen.board, { venueId: s.cocody, stationId: s.cuisine });
    expect(board.active.map((t) => [t.reference, t.status])).toEqual([
      ["A-001-CUI-2", "recalled"],
      ["A-001-CUI-3", "queued"],
    ]);
  });
});

describe("règles du service", () => {
  test("une table n'a qu'une session ouverte (R1)", async () => {
    const s = await serviceReady();
    await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    await expectCode(s.floor.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId }), "CONFLICT");
  });

  test("un plat épuisé est refusé ligne par ligne, rien n'est créé", async () => {
    const s = await serviceReady();
    await s.owner.as.mutation(api.availability.setProduct, { venueId: s.cocody, productId: s.products.poulet, isAvailable: false });
    const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    const sent = await s.waiter.as.mutation(api.orders.submit, {
      venueId: s.cocody,
      sessionId,
      lines: [line(s.products.bissap), line(s.products.poulet)],
      heldCourses: [],
      idempotencyKey: key(),
    });
    expect(sent).toMatchObject({ ok: false, problems: [{ index: 1, code: "ITEM_UNAVAILABLE", productName: "Poulet braisé" }] });
    expect(await s.t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);
  });

  test("seuls les services 2 à 4 peuvent attendre", async () => {
    const s = await serviceReady();
    const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    await expectCode(
      s.waiter.as.mutation(api.orders.submit, { venueId: s.cocody, sessionId, lines: [line(s.products.bissap)], heldCourses: [1], idempotencyKey: key() }),
      "INVALID_ARGUMENT",
    );
  });

  test("annuler avant production : une correction ; après : un droit, un motif, un audit", async () => {
    const s = await serviceReady();
    const { orderId } = await openAndOrder(s);
    const items = await s.t.run((ctx) => ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", orderId)).collect());
    const bissap = items.find((i) => i.nameSnapshot === "Bissap")!;
    const alloco = items.find((i) => i.nameSnapshot === "Alloco")!;

    // Le bissap n'est pas commencé : le serveur corrige sans motif. Son bon disparaît.
    await s.waiter.as.mutation(api.orders.cancelItem, { venueId: s.cocody, itemId: bissap._id });
    const barTicket = (await ticketsOf(s, orderId)).find((t) => t.reference === "A-001-BAR-1")!;
    expect(barTicket.status).toBe("cancelled");
    const order = (await s.t.run((ctx) => ctx.db.get(orderId)))!;
    expect(order.totals.subtotal).toBe(8000);

    // L'alloco est en préparation : le serveur n'a pas le droit ; le chef de rang, si, avec motif.
    const cui = (await ticketsOf(s, orderId)).find((t) => t.reference === "A-001-CUI-2")!;
    await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: cui._id, action: "start" });
    await expectCode(s.waiter.as.mutation(api.orders.cancelItem, { venueId: s.cocody, itemId: alloco._id, reason: "erreur" }), "FORBIDDEN");
    await expectCode(s.floor.as.mutation(api.orders.cancelItem, { venueId: s.cocody, itemId: alloco._id }), "INVALID_ARGUMENT");
    await s.floor.as.mutation(api.orders.cancelItem, { venueId: s.cocody, itemId: alloco._id, reason: "client pressé" });
    const audit = await s.t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(audit.filter((a) => a.action === "order.item.cancel_after_fire").map((a) => a.reason)).toEqual(["client pressé"]);
  });

  test("la cuisine ne sert pas, le serveur ne cuisine pas", async () => {
    const s = await serviceReady();
    const { orderId } = await openAndOrder(s);
    const cui = (await ticketsOf(s, orderId)).find((t) => t.reference === "A-001-CUI-2")!;
    await expectCode(s.waiter.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: cui._id, action: "start" }), "FORBIDDEN");
    await s.cook.as.mutation(api.kitchen.advance, { venueId: s.cocody, ticketId: cui._id, action: "ready" });
    await expectCode(s.cook.as.mutation(api.orders.serveTicket, { venueId: s.cocody, ticketId: cui._id }), "FORBIDDEN");
  });

  test("le routage montre le poste de chaque produit, exceptions comprises", async () => {
    const s = await serviceReady();
    await s.owner.as.mutation(api.stations.routeProduct, { venueId: s.cocody, productId: s.products.bissap, stationId: s.cuisine });
    const routing = await s.owner.as.query(api.stations.routing, { venueId: s.cocody });
    const boissons = routing.find((r) => r.sectionId === s.sections.boissons)!;
    const others = boissons.products.filter((p) => p._id !== s.products.bissap);
    expect(boissons.stationId).toBe(others.length > 0 ? "mixed" : s.cuisine);
    expect(boissons.products.find((p) => p._id === s.products.bissap)!.stationId).toBe(s.cuisine);
    expect(others.every((p) => p.stationId === s.bar)).toBe(true);
  });

  test("un poste qui a des bons en cours ne se retire pas", async () => {
    const s = await serviceReady();
    await openAndOrder(s);
    await expectCode(s.owner.as.mutation(api.stations.archive, { venueId: s.cocody, stationId: s.bar }), "CONFLICT");
  });

  test("sans poste configuré, une « Cuisine » est créée au premier envoi", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const [areaId] = await r.owner.as.mutation(api.floor.createAreas, { venueId: r.cocody, names: ["Salle"] });
    const tableId = await r.owner.as.mutation(api.floor.createTable, { venueId: r.cocody, serviceAreaId: areaId!, number: "7", seats: 2, shape: "round" });
    const sessionId = await r.waiter.as.mutation(api.sessions.open, { venueId: r.cocody, tableId });
    const sent = await r.waiter.as.mutation(api.orders.submit, {
      venueId: r.cocody,
      sessionId,
      lines: [line(r.products.alloco)],
      heldCourses: [],
      idempotencyKey: key(),
    });
    expect(sent).toMatchObject({ ok: true, reference: "A-001" });
    const stations = await r.owner.as.query(api.stations.list, { venueId: r.cocody });
    expect(stations.map((x) => [x.name, x.isDefault])).toEqual([["Cuisine", true]]);
  });
});

describe("rejeu d'une file hors ligne (D-062)", () => {
  const ref = (n: number) => `0190a1b2-c3d4-7e5f-8a9b-${String(n).padStart(12, "0")}`;

  test("ouvrir deux fois avec la même référence ne crée qu'une table ; la commande la désigne par cette référence", async () => {
    const s = await serviceReady();
    const first = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId, clientRef: ref(1) });
    const again = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId, clientRef: ref(1) });
    expect(again).toBe(first);
    const sent = await s.waiter.as.mutation(api.orders.submit, {
      venueId: s.cocody,
      sessionRef: { clientRef: ref(1), tableId: s.tableId },
      lines: [line(s.products.alloco)],
      heldCourses: [],
      idempotencyKey: key(),
      clientCreatedAt: Date.now() - 60_000,
    });
    expect(sent.ok).toBe(true);
    if (sent.ok) expect((await s.t.run((ctx) => ctx.db.get(sent.orderId)))!.tableSessionId).toBe(first);
  });

  test("ouverte hors ligne pendant qu'un collègue l'ouvrait : une seule table, et c'est noté", async () => {
    const s = await serviceReady();
    const online = await s.floor.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    const offline = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId, clientRef: ref(2) });
    expect(offline).toBe(online);
    const audit = await s.t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(audit.some((a) => a.action === "table.session.offline_merge")).toBe(true);
    // La commande rejouée désigne une référence inconnue : elle rejoint la table ouverte.
    const sent = await s.waiter.as.mutation(api.orders.submit, {
      venueId: s.cocody,
      sessionRef: { clientRef: ref(3), tableId: s.tableId },
      lines: [line(s.products.bissap)],
      heldCourses: [],
      idempotencyKey: key(),
    });
    if (sent.ok) expect((await s.t.run((ctx) => ctx.db.get(sent.orderId)))!.tableSessionId).toBe(online);
    else throw new Error("commande refusée");
  });

  test("un geste de plus de six heures est refusé", async () => {
    const s = await serviceReady();
    const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    await expectCode(
      s.waiter.as.mutation(api.orders.submit, {
        venueId: s.cocody,
        sessionId,
        lines: [line(s.products.alloco)],
        heldCourses: [],
        idempotencyKey: key(),
        clientCreatedAt: Date.now() - 7 * 60 * 60_000,
      }),
      "INVALID_ARGUMENT",
    );
  });

  test("« déjà préparée » : enregistrée comme servie, jamais montrée à la cuisine", async () => {
    const s = await serviceReady();
    const sessionId = await s.waiter.as.mutation(api.sessions.open, { venueId: s.cocody, tableId: s.tableId });
    const sent = await s.waiter.as.mutation(api.orders.submit, {
      venueId: s.cocody,
      sessionId,
      lines: [line(s.products.alloco, 1, 2)],
      heldCourses: [],
      idempotencyKey: key(),
      clientCreatedAt: Date.now() - 20 * 60_000,
      recordOnly: true,
    });
    if (!sent.ok) throw new Error("commande refusée");
    const order = (await s.t.run((ctx) => ctx.db.get(sent.orderId)))!;
    expect([order.status, order.enteredOffline]).toEqual(["served", true]);
    expect((await ticketsOf(s, sent.orderId)).map((t) => t.status)).toEqual(["served"]);
    const board = await s.cook.as.query(api.kitchen.board, { venueId: s.cocody, stationId: s.cuisine });
    expect([board.active, board.ready]).toEqual([[], []]);
    // Rien en cours : la table se clôt.
    await s.waiter.as.mutation(api.sessions.close, { venueId: s.cocody, sessionId });
    // Et la cuisine ne peut pas s'en servir pour enregistrer des plats servis.
    await expectCode(
      s.cook.as.mutation(api.orders.submit, { venueId: s.cocody, sessionId, lines: [line(s.products.alloco)], heldCourses: [], idempotencyKey: key(), recordOnly: true }),
      "FORBIDDEN",
    );
  });
});
