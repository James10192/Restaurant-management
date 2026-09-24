/**
 * ISOLATION MULTI-TENANT — le test le plus important du produit (PERMISSIONS.md §9).
 *
 * Deux organisations réelles, A et B. Le propriétaire de A appelle CHAQUE fonction
 * publique du backend avec des identifiants appartenant à B — y compris en mélangeant
 * (son organisation + un rôle de B, son établissement + une invitation de B). Toutes
 * doivent répondre NOT_FOUND, ou ne rien renvoyer de B.
 *
 * Le dernier test fait la liste des fonctions publiques réellement exportées et échoue
 * si l'une d'elles n'a pas de cas ici : ajouter une fonction sans la tester contre la
 * fuite de tenant fait tomber la CI.
 */

import { describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { activateAndUnlock, enrollDevice, pinMember } from "./deviceFixtures";
import { expectCode, inviteAndJoin, modules, openOrganization, setup, type Session } from "./setup";

async function twoTenants() {
  const t = setup();
  const a = await openOrganization(t, "awa@maquis-a.ci", "Maquis A", "Maquis A — Cocody");
  const b = await openOrganization(t, "bakary@lounge-b.ci", "Lounge B", "Lounge B — Plateau");
  const venueA2 = await a.owner.as.mutation(api.venues.create, {
    organizationId: a.organizationId,
    name: "Maquis A — Marcory",
    venueType: "maquis",
  });
  const waiterB = await inviteAndJoin(
    t,
    b.owner,
    { organizationId: b.organizationId, roleId: b.roleId("waiter"), venueIds: [b.venueId] },
    { email: "serveur@lounge-b.ci" },
  );
  const pendingB = await b.owner.as.action(api.team.invite, {
    organizationId: b.organizationId,
    email: "future@lounge-b.ci",
    roleId: b.roleId("cashier"),
    venueIds: [b.venueId],
  });
  const invitationB = await t.run(async (ctx) =>
    (await ctx.db.query("organizationInvitations").collect()).find((i) => i.email === "future@lounge-b.ci")!,
  );
  const waiterA = await inviteAndJoin(
    t,
    a.owner,
    { organizationId: a.organizationId, roleId: a.roleId("waiter"), venueIds: [a.venueId] },
    { email: "serveur@maquis-a.ci" },
  );
  const catalogA = await catalogFor(a.owner, a.venueId, "A");
  const catalogB = await catalogFor(b.owner, b.venueId, "B");
  const ruleB = await b.owner.as.mutation(api.availability.createRule, {
    venueId: b.venueId,
    targetType: "product",
    targetId: catalogB.productId,
    ruleType: "available",
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 420,
    endMinute: 660,
  });
  const floorA = await floorFor(a.owner, a.venueId);
  const floorB = await floorFor(b.owner, b.venueId);
  return {
    t, a, b, venueA2, waiterA, waiterB, pendingB, invitationB, catalogA, catalogB, ruleB, floorA, floorB,
    /** Le service de B, monté seulement par les cas qui en ont besoin (il occupe la table de B). */
    serviceB: undefined as ServiceFixture | undefined,
    /** L'argent de B (T3), monté seulement par les cas qui en ont besoin. */
    moneyB: undefined as MoneyFixture | undefined,
  };
}

type ServiceFixture = Awaited<ReturnType<typeof serviceFor>>;

/**
 * Un service en cours : un poste, la table ouverte, une commande envoyée (un bon en file),
 * et une commande de client qui attend d'être validée.
 */
async function serviceFor(
  t: ReturnType<typeof setup>,
  owner: Session,
  venueId: Id<"venues">,
  floor: { tableId: Id<"restaurantTables"> },
  catalog: { productId: Id<"products">; variantId: Id<"productVariants"> },
  tag: string,
) {
  const stationId = await owner.as.mutation(api.stations.create, { venueId, name: `Bar ${tag}`, type: "bar" });
  const sessionId = await owner.as.mutation(api.sessions.open, { venueId, tableId: floor.tableId });
  // Le plat de B n'est servi qu'en semaine, de 7 h à 11 h : on commande un lundi matin.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T08:30:00Z"));
  const sent = await owner.as
    .mutation(api.orders.submit, {
      venueId,
      sessionId,
      lines: [{ productId: catalog.productId, variantId: catalog.variantId, optionIds: [], quantity: 2, courseNumber: 1 }],
      heldCourses: [],
      idempotencyKey: `isolation-${tag}-0000000001`,
    })
    .finally(() => vi.useRealTimers());
  if (!sent.ok) throw new Error(`commande refusée : ${JSON.stringify(sent)}`);
  return t.run(async (ctx) => {
    const ticket = (await ctx.db.query("kitchenTickets").withIndex("by_order", (q) => q.eq("orderId", sent.orderId)).unique())!;
    const item = (await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", sent.orderId)).unique())!;
    const order = (await ctx.db.get(sent.orderId))!;
    const pendingOrderId = await ctx.db.insert("orders", {
      venueId,
      tableSessionId: sessionId,
      reference: `${order.reference}-P`,
      status: "pending_acceptance",
      channel: "guest",
      submittedAt: Date.now(),
      totals: order.totals,
      currency: order.currency,
      idempotencyKey: `isolation-${tag}-pending-000001`,
    });
    return { stationId, sessionId, orderId: sent.orderId, ticketId: ticket._id, itemId: item._id, pendingOrderId, idempotencyKey: `isolation-${tag}-0000000001` };
  });
}

type World = Awaited<ReturnType<typeof twoTenants>>;

async function withServiceB(w: World): Promise<ServiceFixture> {
  w.serviceB ??= await serviceFor(w.t, w.b.owner, w.b.venueId, w.floorB, w.catalogB, "B");
  return w.serviceB;
}

/** Un client attablé chez B, avec un panier, et une demande en attente. */
async function guestAtB(w: World) {
  const service = await withServiceB(w);
  const scanned = await w.t.mutation(api.guest.exchange, { token: w.floorB.token });
  if (!scanned.ok) throw new Error("scan refusé");
  const guest = { pass: scanned.pass, venueSlug: scanned.venueSlug, guestKey: "telephone-chez-b-0000000001" };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T08:30:00Z"));
  try {
    await w.t.mutation(api.guestService.saveCart, { ...guest, lines: [{ productId: w.catalogB.productId, variantId: w.catalogB.variantId, optionIds: [], quantity: 1 }] });
  } finally {
    vi.useRealTimers();
  }
  await w.t.mutation(api.guestService.requestService, { ...guest, type: "call_waiter" });
  const [cart, request] = await w.t.run(async (ctx) => [(await ctx.db.query("carts").collect())[0]!, (await ctx.db.query("serviceRequests").collect())[0]!] as const);
  return { service, guest, cartId: cart._id, requestId: request._id };
}

type MoneyFixture = {
  service: ServiceFixture;
  cashSessionId: Id<"cashRegisterSessions">;
  checkId: Id<"checks">;
  paymentId: Id<"payments">;
  billId: Id<"bills">;
  registerId: Id<"cashRegisters">;
};

/** L'argent de B : une caisse ouverte, une addition réglée par carte, son ticket. */
async function moneyAtB(w: World): Promise<MoneyFixture> {
  w.moneyB ??= await buildMoneyAtB(w);
  return w.moneyB;
}

async function buildMoneyAtB(w: World): Promise<MoneyFixture> {
  const service = await withServiceB(w);
  const b = w.b.owner;
  const cashSessionId = await b.as.mutation(api.cash.open, { venueId: w.b.venueId, openingFloat: 0 });
  const checkId = await b.as.mutation(api.checks.requestBill, { venueId: w.b.venueId, sessionId: service.sessionId });
  const bill = await b.as.query(api.checks.forSession, { venueId: w.b.venueId, sessionId: service.sessionId });
  const paid = await b.as.mutation(api.payments.collect, {
    venueId: w.b.venueId,
    sessionId: service.sessionId,
    checkId,
    method: "card",
    amount: bill.due,
    idempotencyKey: "isolation-argent-b-00000001",
  });
  if (!paid.ok) throw new Error("paiement de B refusé");
  const billId = await b.as.mutation(api.bills.issue, { venueId: w.b.venueId, checkId });
  const registerId = (await w.t.run((ctx) => ctx.db.get(cashSessionId)))!.cashRegisterId!;
  return { service, cashSessionId, checkId, paymentId: paid.paymentId, billId, registerId };
}

/** A ouvre sa propre table, pour les franchissements « son établissement + un objet de B ». */
async function openA(w: World): Promise<Id<"tableSessions">> {
  return w.a.owner.as.mutation(api.sessions.open, { venueId: w.a.venueId, tableId: w.floorA.tableId });
}

/** Une zone et une table, avec son QR. */
async function floorFor(owner: Session, venueId: Id<"venues">) {
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId, names: ["Salle"] });
  const tableId = await owner.as.mutation(api.floor.createTable, {
    venueId,
    serviceAreaId: areaId!,
    number: "1",
    seats: 4,
    shape: "square",
  });
  const sheet = await owner.as.query(api.qr.sheet, { venueId });
  return { areaId: areaId!, tableId, token: sheet.areas[0]!.cards[0]!.token };
}

/** Une carte complète et publiée : section, produit, variante, groupe d'options. */
async function catalogFor(owner: Session, venueId: Id<"venues">, tag: string) {
  const menuId = await owner.as.mutation(api.menus.create, { venueId, name: `Carte ${tag}` });
  const [sectionId] = await owner.as.mutation(api.menus.createSections, { venueId, menuId, names: [`Plats ${tag}`] });
  const productId = await owner.as.mutation(api.products.create, {
    venueId,
    menuSectionId: sectionId!,
    name: `Plat ${tag}`,
    basePrice: 2000,
  });
  const variantId = await owner.as.mutation(api.products.addVariant, { venueId, productId, name: "Grand", price: 3000 });
  const groupId = await owner.as.mutation(api.modifiers.createGroup, {
    venueId,
    name: `Cuisson ${tag}`,
    selectionType: "single",
    minSelect: 0,
    maxSelect: 1,
    isRequired: false,
    options: [
      { name: "Saignant", priceDelta: 0 },
      { name: "À point", priceDelta: 0 },
    ],
  });
  await owner.as.mutation(api.products.setModifierGroups, { venueId, productId, modifierGroupIds: [groupId] });
  const optionId = (await owner.as.query(api.modifiers.list, { venueId }))[0]!.options[0]!._id;
  await owner.as.mutation(api.publications.publish, { venueId, menuId });
  const [publication] = await owner.as.query(api.publications.history, { venueId, menuId });
  return { menuId, sectionId: sectionId!, productId, variantId, groupId, optionId, publicationId: publication!._id };
}

/** Les deux formes de franchissement : l'établissement de B, puis le sien avec un objet de B. */
async function bothRefused(viaForeignVenue: Promise<unknown>, viaCrossedId: Promise<unknown>) {
  await expectCode(viaForeignVenue, "NOT_FOUND");
  await expectCode(viaCrossedId, "NOT_FOUND");
}

/**
 * Un cas par fonction publique. La clé est `module.fonction` ; le test de couverture
 * compare ces clés à la liste réelle.
 */
const CASES: Record<string, (w: Awaited<ReturnType<typeof twoTenants>>) => Promise<void>> = {
  "users.me": async ({ a }) => {
    const me = await a.owner.as.query(api.users.me, {});
    expect(me?.email).toBe("awa@maquis-a.ci");
  },
  "users.updateProfile": async ({ t, a, b }) => {
    await a.owner.as.mutation(api.users.updateProfile, { name: "Awa Koné" });
    const other = await t.run((ctx) => ctx.db.get(b.owner.userId));
    expect(other?.name).toBe("Propriétaire Lounge B");
  },
  "organizations.listMine": async ({ a }) => {
    const mine = await a.owner.as.query(api.organizations.listMine, {});
    expect(mine.map((o) => o.name)).toEqual(["Maquis A"]);
  },
  "organizations.get": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.organizations.get, { organizationId: b.organizationId }), "NOT_FOUND");
  },
  "organizations.venueAccess": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.organizations.venueAccess, { venueId: b.venueId }), "NOT_FOUND");
  },
  "organizations.create": async ({ a }) => {
    // Créer n'expose rien d'autrui ; on vérifie que la nouvelle organisation est bien à A.
    const { organizationId } = await a.owner.as.mutation(api.organizations.create, {
      name: "Maquis A bis",
      countryCode: "SN",
      venue: { name: "Dakar", venueType: "restaurant" },
    });
    const org = await a.owner.as.query(api.organizations.get, { organizationId });
    expect(org.isOwner).toBe(true);
    expect(org.defaultCurrency).toBe("XOF");
  },
  "organizations.update": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.organizations.update, { organizationId: b.organizationId, name: "Piraté" }),
      "NOT_FOUND",
    );
  },
  "venues.listForOrganization": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.venues.listForOrganization, { organizationId: b.organizationId }), "NOT_FOUND");
  },
  "venues.get": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.venues.get, { venueId: b.venueId }), "NOT_FOUND");
  },
  "venues.create": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.venues.create, { organizationId: b.organizationId, name: "Intrus", venueType: "bar" }),
      "NOT_FOUND",
    );
  },
  "venues.update": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.venues.update, { venueId: b.venueId, name: "Piraté" }), "NOT_FOUND");
  },
  "roles.catalog": async ({ a }) => {
    const catalog = await a.owner.as.query(api.roles.catalog, {});
    expect(catalog.some((p) => p.key.startsWith("platform."))).toBe(false);
  },
  "roles.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.roles.list, { organizationId: b.organizationId }), "NOT_FOUND");
  },
  "roles.listForGrant": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.roles.listForGrant, { scope: { organizationId: b.organizationId } }), "NOT_FOUND");
    await expectCode(a.owner.as.query(api.roles.listForGrant, { scope: { venueId: b.venueId } }), "NOT_FOUND");
  },
  "roles.create": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.roles.create, { organizationId: b.organizationId, label: "Intrus", permissions: ["menu.read"] }),
      "NOT_FOUND",
    );
  },
  "roles.update": async ({ a, b }) => {
    // Clé étrangère croisée : SON organisation, le rôle de B.
    await expectCode(
      a.owner.as.mutation(api.roles.update, {
        organizationId: a.organizationId,
        roleId: b.roleId("waiter"),
        permissions: ["menu.read"],
        reason: "Tentative de franchissement",
      }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.roles.update, {
        organizationId: b.organizationId,
        roleId: b.roleId("waiter"),
        label: "Piraté",
        reason: "Tentative de franchissement",
      }),
      "NOT_FOUND",
    );
  },
  "roles.archive": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.roles.archive, {
        organizationId: a.organizationId,
        roleId: b.roleId("analyst"),
        reason: "Tentative de franchissement",
      }),
      "NOT_FOUND",
    );
  },
  "team.listMembers": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.team.listMembers, { scope: { organizationId: b.organizationId } }), "NOT_FOUND");
    await expectCode(a.owner.as.query(api.team.listMembers, { scope: { venueId: b.venueId } }), "NOT_FOUND");
  },
  "team.listInvitations": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.team.listInvitations, { scope: { organizationId: b.organizationId } }), "NOT_FOUND");
    await expectCode(a.owner.as.query(api.team.listInvitations, { scope: { venueId: b.venueId } }), "NOT_FOUND");
  },
  "team.invite": async ({ a, b }) => {
    const base = { email: "intrus@exemple.ci" };
    await expectCode(
      a.owner.as.action(api.team.invite, { ...base, organizationId: b.organizationId, roleId: b.roleId("waiter"), venueIds: [] }),
      "NOT_FOUND",
    );
    // Son organisation + un rôle de B.
    await expectCode(
      a.owner.as.action(api.team.invite, { ...base, organizationId: a.organizationId, roleId: b.roleId("waiter"), venueIds: [] }),
      "NOT_FOUND",
    );
    // Son organisation + son rôle + un établissement de B.
    await expectCode(
      a.owner.as.action(api.team.invite, {
        ...base,
        organizationId: a.organizationId,
        roleId: a.roleId("waiter"),
        venueIds: [b.venueId],
      }),
      "NOT_FOUND",
    );
  },
  "team.previewInvitation": async ({ a, pendingB }) => {
    // Un jeton inventé ne renvoie rien. Le vrai lien de B, lui, montre l'aperçu à son
    // détenteur — c'est son rôle — mais signale que l'adresse ne correspond pas.
    expect(await a.owner.as.query(api.team.previewInvitation, { token: "inexistant" })).toBeNull();
    const token = pendingB.link.split("/invitation/")[1]!;
    const preview = await a.owner.as.query(api.team.previewInvitation, { token });
    expect(preview?.viewerEmailMatches).toBe(false);
    expect(preview?.maskedEmail).not.toContain("future@");
  },
  "team.myInvitations": async ({ a }) => {
    expect(await a.owner.as.query(api.team.myInvitations, {})).toEqual([]);
  },
  "team.acceptInvitation": async ({ a, pendingB }) => {
    const token = pendingB.link.split("/invitation/")[1]!;
    await expectCode(a.owner.as.mutation(api.team.acceptInvitation, { token }), "FORBIDDEN");
    await expectCode(a.owner.as.mutation(api.team.acceptInvitation, { token: "inexistant" }), "NOT_FOUND");
  },
  "team.acceptInvitationById": async ({ a, invitationB }) => {
    await expectCode(a.owner.as.mutation(api.team.acceptInvitationById, { invitationId: invitationB._id }), "NOT_FOUND");
  },
  "team.revokeInvitation": async ({ a, b, invitationB }) => {
    await expectCode(
      a.owner.as.mutation(api.team.revokeInvitation, { organizationId: a.organizationId, invitationId: invitationB._id }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.team.revokeInvitation, { organizationId: b.organizationId, invitationId: invitationB._id }),
      "NOT_FOUND",
    );
  },
  "team.setMemberRoles": async ({ a, b, waiterA, waiterB }) => {
    await expectCode(
      a.owner.as.mutation(api.team.setMemberRoles, {
        memberId: waiterB.memberId,
        scope: { organizationId: a.organizationId },
        roleIds: [a.roleId("waiter")],
      }),
      "NOT_FOUND",
    );
    // Son propre membre, mais dans un établissement de B.
    await expectCode(
      a.owner.as.mutation(api.team.setMemberRoles, {
        memberId: waiterA.memberId,
        scope: { venueId: b.venueId },
        roleIds: [],
      }),
      "NOT_FOUND",
    );
  },
  "team.setMemberStatus": async ({ a, waiterB }) => {
    await expectCode(
      a.owner.as.mutation(api.team.setMemberStatus, {
        organizationId: a.organizationId,
        memberId: waiterB.memberId,
        status: "suspended",
      }),
      "NOT_FOUND",
    );
  },
  /* ─── Carte ─── */
  "menus.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.menus.list, { venueId: b.venueId }), "NOT_FOUND");
  },
  "menus.editor": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.menus.editor, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.query(api.menus.editor, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "menus.sectionChoices": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.menus.sectionChoices, { venueId: b.venueId }), "NOT_FOUND");
  },
  "menus.create": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.menus.create, { venueId: b.venueId, name: "Intrus" }), "NOT_FOUND");
  },
  "menus.update": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.update, { venueId: b.venueId, menuId: catalogB.menuId, name: "Piraté" }),
      a.owner.as.mutation(api.menus.update, { venueId: a.venueId, menuId: catalogB.menuId, name: "Piraté" }),
    );
  },
  "menus.archive": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.archive, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.mutation(api.menus.archive, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "menus.reorder": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.reorder, { venueId: b.venueId, menuIds: [catalogB.menuId] }),
      a.owner.as.mutation(api.menus.reorder, { venueId: a.venueId, menuIds: [catalogA.menuId, catalogB.menuId] }),
    );
  },
  "menus.createSections": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.createSections, { venueId: b.venueId, menuId: catalogB.menuId, names: ["X"] }),
      a.owner.as.mutation(api.menus.createSections, { venueId: a.venueId, menuId: catalogB.menuId, names: ["X"] }),
    );
  },
  "menus.updateSection": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.updateSection, { venueId: b.venueId, sectionId: catalogB.sectionId, name: "X" }),
      a.owner.as.mutation(api.menus.updateSection, { venueId: a.venueId, sectionId: catalogB.sectionId, name: "X" }),
    );
  },
  "menus.reorderSections": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.menus.reorderSections, { venueId: b.venueId, menuId: catalogB.menuId, sectionIds: [catalogB.sectionId] }),
      a.owner.as.mutation(api.menus.reorderSections, {
        venueId: a.venueId,
        menuId: catalogA.menuId,
        sectionIds: [catalogA.sectionId, catalogB.sectionId],
      }),
    );
  },
  "products.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.products.list, { venueId: b.venueId }), "NOT_FOUND");
    const mine = await a.owner.as.query(api.products.list, { venueId: a.venueId, search: "Plat" });
    expect(mine.map((p) => p.name)).toEqual(["Plat A"]);
  },
  "products.get": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.products.get, { venueId: b.venueId, productId: catalogB.productId }),
      a.owner.as.query(api.products.get, { venueId: a.venueId, productId: catalogB.productId }),
    );
  },
  "products.create": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.create, { venueId: b.venueId, menuSectionId: catalogB.sectionId, name: "X", basePrice: 1 }),
      a.owner.as.mutation(api.products.create, { venueId: a.venueId, menuSectionId: catalogB.sectionId, name: "X", basePrice: 1 }),
    );
  },
  "products.update": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.update, { venueId: b.venueId, productId: catalogB.productId, name: "Piraté" }),
      a.owner.as.mutation(api.products.update, { venueId: a.venueId, productId: catalogB.productId, name: "Piraté" }),
    );
    // Son produit, rangé dans la section de B, ou lié à un produit de B.
    await expectCode(
      a.owner.as.mutation(api.products.update, { venueId: a.venueId, productId: catalogA.productId, menuSectionId: catalogB.sectionId }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.products.update, { venueId: a.venueId, productId: catalogA.productId, relatedProductIds: [catalogB.productId] }),
      "NOT_FOUND",
    );
  },
  "products.setPrice": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setPrice, { venueId: b.venueId, productId: catalogB.productId, basePrice: 1 }),
      a.owner.as.mutation(api.products.setPrice, { venueId: a.venueId, productId: catalogB.productId, basePrice: 1 }),
    );
  },
  "products.setActive": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setActive, { venueId: b.venueId, productId: catalogB.productId, isActive: false }),
      a.owner.as.mutation(api.products.setActive, { venueId: a.venueId, productId: catalogB.productId, isActive: false }),
    );
  },
  "products.reorder": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.reorder, { venueId: b.venueId, menuSectionId: catalogB.sectionId, productIds: [catalogB.productId] }),
      a.owner.as.mutation(api.products.reorder, {
        venueId: a.venueId,
        menuSectionId: catalogA.sectionId,
        productIds: [catalogA.productId, catalogB.productId],
      }),
    );
  },
  "products.duplicate": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.duplicate, { venueId: b.venueId, productId: catalogB.productId }),
      a.owner.as.mutation(api.products.duplicate, { venueId: a.venueId, productId: catalogB.productId }),
    );
  },
  "products.addVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.addVariant, { venueId: b.venueId, productId: catalogB.productId, name: "X", price: 1 }),
      a.owner.as.mutation(api.products.addVariant, { venueId: a.venueId, productId: catalogB.productId, name: "X", price: 1 }),
    );
  },
  "products.updateVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.updateVariant, { venueId: b.venueId, variantId: catalogB.variantId, name: "X" }),
      a.owner.as.mutation(api.products.updateVariant, { venueId: a.venueId, variantId: catalogB.variantId, name: "X" }),
    );
  },
  "products.setVariantPrice": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setVariantPrice, { venueId: b.venueId, variantId: catalogB.variantId, price: 1 }),
      a.owner.as.mutation(api.products.setVariantPrice, { venueId: a.venueId, variantId: catalogB.variantId, price: 1 }),
    );
  },
  "products.removeVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.removeVariant, { venueId: b.venueId, variantId: catalogB.variantId }),
      a.owner.as.mutation(api.products.removeVariant, { venueId: a.venueId, variantId: catalogB.variantId }),
    );
  },
  "products.reorderVariants": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.reorderVariants, { venueId: b.venueId, productId: catalogB.productId, variantIds: [catalogB.variantId] }),
      a.owner.as.mutation(api.products.reorderVariants, { venueId: a.venueId, productId: catalogB.productId, variantIds: [catalogB.variantId] }),
    );
  },
  "products.setModifierGroups": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.products.setModifierGroups, { venueId: b.venueId, productId: catalogB.productId, modifierGroupIds: [] }),
      a.owner.as.mutation(api.products.setModifierGroups, {
        venueId: a.venueId,
        productId: catalogA.productId,
        modifierGroupIds: [catalogB.groupId],
      }),
    );
  },
  "products.generateUploadUrl": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.products.generateUploadUrl, { venueId: b.venueId }), "NOT_FOUND");
  },
  "products.addImage": async ({ t, a, b, catalogB }) => {
    const file = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0])])));
    const args = { storageId: file, thumbStorageId: file, width: 800, height: 600 };
    await bothRefused(
      a.owner.as.action(api.products.addImage, { venueId: b.venueId, productId: catalogB.productId, ...args }),
      a.owner.as.action(api.products.addImage, { venueId: a.venueId, productId: catalogB.productId, ...args }),
    );
    // Refusé, rien n'a été effacé : la garde passe AVANT toute lecture de fichier.
    expect(await t.run((ctx) => ctx.db.system.get(file))).not.toBeNull();
  },
  "products.removeImage": async ({ t, a, b, catalogB }) => {
    const file = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await bothRefused(
      a.owner.as.mutation(api.products.removeImage, { venueId: b.venueId, productId: catalogB.productId, storageId: file }),
      a.owner.as.mutation(api.products.removeImage, { venueId: a.venueId, productId: catalogB.productId, storageId: file }),
    );
  },
  "modifiers.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.modifiers.list, { venueId: b.venueId }), "NOT_FOUND");
    const mine = await a.owner.as.query(api.modifiers.list, { venueId: a.venueId });
    expect(mine.map((g) => g.name)).toEqual(["Cuisson A"]);
  },
  "modifiers.createGroup": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.modifiers.createGroup, {
        venueId: b.venueId,
        name: "X",
        selectionType: "single",
        minSelect: 0,
        maxSelect: 1,
        isRequired: false,
        options: [],
      }),
      "NOT_FOUND",
    );
  },
  "modifiers.updateGroup": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.updateGroup, { venueId: b.venueId, modifierGroupId: catalogB.groupId, name: "X" }),
      a.owner.as.mutation(api.modifiers.updateGroup, { venueId: a.venueId, modifierGroupId: catalogB.groupId, name: "X" }),
    );
  },
  "modifiers.deleteGroup": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.deleteGroup, { venueId: b.venueId, modifierGroupId: catalogB.groupId }),
      a.owner.as.mutation(api.modifiers.deleteGroup, { venueId: a.venueId, modifierGroupId: catalogB.groupId }),
    );
  },
  "modifiers.addOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.addOption, { venueId: b.venueId, modifierGroupId: catalogB.groupId, name: "X", priceDelta: 0 }),
      a.owner.as.mutation(api.modifiers.addOption, { venueId: a.venueId, modifierGroupId: catalogB.groupId, name: "X", priceDelta: 0 }),
    );
  },
  "modifiers.updateOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.updateOption, { venueId: b.venueId, optionId: catalogB.optionId, name: "X" }),
      a.owner.as.mutation(api.modifiers.updateOption, { venueId: a.venueId, optionId: catalogB.optionId, name: "X" }),
    );
  },
  "modifiers.setOptionPrice": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.setOptionPrice, { venueId: b.venueId, optionId: catalogB.optionId, priceDelta: 1 }),
      a.owner.as.mutation(api.modifiers.setOptionPrice, { venueId: a.venueId, optionId: catalogB.optionId, priceDelta: 1 }),
    );
  },
  "modifiers.removeOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.removeOption, { venueId: b.venueId, optionId: catalogB.optionId }),
      a.owner.as.mutation(api.modifiers.removeOption, { venueId: a.venueId, optionId: catalogB.optionId }),
    );
  },
  "modifiers.reorderOptions": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.modifiers.reorderOptions, { venueId: b.venueId, modifierGroupId: catalogB.groupId, optionIds: [] }),
      a.owner.as.mutation(api.modifiers.reorderOptions, { venueId: a.venueId, modifierGroupId: catalogB.groupId, optionIds: [] }),
    );
  },
  "publications.pendingChanges": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.publications.pendingChanges, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.query(api.publications.pendingChanges, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "publications.publish": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.publications.publish, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.mutation(api.publications.publish, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "publications.history": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.query(api.publications.history, { venueId: b.venueId, menuId: catalogB.menuId }),
      a.owner.as.query(api.publications.history, { venueId: a.venueId, menuId: catalogB.menuId }),
    );
  },
  "publications.rollback": async ({ a, b, catalogA, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.publications.rollback, { venueId: b.venueId, menuId: catalogB.menuId, publicationId: catalogB.publicationId }),
      // Sa carte, la version de B : une publication étrangère ne se remet pas en ligne chez soi.
      a.owner.as.mutation(api.publications.rollback, { venueId: a.venueId, menuId: catalogA.menuId, publicationId: catalogB.publicationId }),
    );
  },
  "availability.board": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.availability.board, { venueId: b.venueId }), "NOT_FOUND");
  },
  "availability.setProduct": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.setProduct, { venueId: b.venueId, productId: catalogB.productId, isAvailable: false }),
      a.owner.as.mutation(api.availability.setProduct, { venueId: a.venueId, productId: catalogB.productId, isAvailable: false }),
    );
  },
  "availability.setVariant": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.setVariant, { venueId: b.venueId, variantId: catalogB.variantId, isAvailable: false }),
      a.owner.as.mutation(api.availability.setVariant, { venueId: a.venueId, variantId: catalogB.variantId, isAvailable: false }),
    );
  },
  "availability.setOption": async ({ a, b, catalogB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.setOption, { venueId: b.venueId, optionId: catalogB.optionId, isAvailable: false }),
      a.owner.as.mutation(api.availability.setOption, { venueId: a.venueId, optionId: catalogB.optionId, isAvailable: false }),
    );
  },
  "availability.createRule": async ({ a, b, catalogB }) => {
    const rule = { targetType: "product" as const, ruleType: "unavailable" as const, daysOfWeek: [1], startMinute: 0, endMinute: 60 };
    await expectCode(
      a.owner.as.mutation(api.availability.createRule, { venueId: b.venueId, targetId: catalogB.productId, ...rule }),
      "NOT_FOUND",
    );
    // Sa portée, une cible de B : refusée comme cible inconnue, sans confirmer son existence.
    await expectCode(
      a.owner.as.mutation(api.availability.createRule, { venueId: a.venueId, targetId: catalogB.productId, ...rule }),
      "INVALID_ARGUMENT",
    );
  },
  "availability.deleteRule": async ({ a, b, ruleB }) => {
    await bothRefused(
      a.owner.as.mutation(api.availability.deleteRule, { venueId: b.venueId, ruleId: ruleB }),
      a.owner.as.mutation(api.availability.deleteRule, { venueId: a.venueId, ruleId: ruleB }),
    );
  },
  /* ─── Salle et QR ─── */
  "floor.overview": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.floor.overview, { venueId: b.venueId }), "NOT_FOUND");
  },
  "floor.createAreas": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.floor.createAreas, { venueId: b.venueId, names: ["X"] }), "NOT_FOUND");
  },
  "floor.updateArea": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.updateArea, { venueId: b.venueId, serviceAreaId: floorB.areaId, name: "X" }),
      a.owner.as.mutation(api.floor.updateArea, { venueId: a.venueId, serviceAreaId: floorB.areaId, name: "X" }),
    );
  },
  "floor.reorderAreas": async ({ a, b, floorA, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.reorderAreas, { venueId: b.venueId, serviceAreaIds: [floorB.areaId] }),
      a.owner.as.mutation(api.floor.reorderAreas, { venueId: a.venueId, serviceAreaIds: [floorA.areaId, floorB.areaId] }),
    );
  },
  "floor.deleteArea": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.deleteArea, { venueId: b.venueId, serviceAreaId: floorB.areaId }),
      a.owner.as.mutation(api.floor.deleteArea, { venueId: a.venueId, serviceAreaId: floorB.areaId }),
    );
  },
  "floor.createTable": async ({ a, b, floorB }) => {
    const table = { number: "99", seats: 2, shape: "round" as const };
    await bothRefused(
      a.owner.as.mutation(api.floor.createTable, { venueId: b.venueId, serviceAreaId: floorB.areaId, ...table }),
      a.owner.as.mutation(api.floor.createTable, { venueId: a.venueId, serviceAreaId: floorB.areaId, ...table }),
    );
  },
  "floor.createTableRange": async ({ a, b, floorB }) => {
    const range = { from: 10, to: 12, seats: 2, shape: "round" as const };
    await bothRefused(
      a.owner.as.mutation(api.floor.createTableRange, { venueId: b.venueId, serviceAreaId: floorB.areaId, ...range }),
      a.owner.as.mutation(api.floor.createTableRange, { venueId: a.venueId, serviceAreaId: floorB.areaId, ...range }),
    );
  },
  "floor.updateTable": async ({ a, b, floorA, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.updateTable, { venueId: b.venueId, tableId: floorB.tableId, inService: false }),
      a.owner.as.mutation(api.floor.updateTable, { venueId: a.venueId, tableId: floorB.tableId, inService: false }),
    );
    // Sa table, déplacée dans la zone de B.
    await expectCode(
      a.owner.as.mutation(api.floor.updateTable, { venueId: a.venueId, tableId: floorA.tableId, serviceAreaId: floorB.areaId }),
      "NOT_FOUND",
    );
  },
  "floor.saveLayout": async ({ a, b, floorA, floorB }) => {
    const at = { x: 10, y: 10, width: 80, height: 80, rotation: 0 };
    await bothRefused(
      a.owner.as.mutation(api.floor.saveLayout, { venueId: b.venueId, serviceAreaId: floorB.areaId, tables: [] }),
      a.owner.as.mutation(api.floor.saveLayout, {
        venueId: a.venueId,
        serviceAreaId: floorA.areaId,
        tables: [{ tableId: floorB.tableId, ...at }],
      }),
    );
  },
  "floor.removeTable": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.floor.removeTable, { venueId: b.venueId, tableId: floorB.tableId }),
      a.owner.as.mutation(api.floor.removeTable, { venueId: a.venueId, tableId: floorB.tableId }),
    );
  },
  "qr.sheet": async ({ a, b, floorB }) => {
    await expectCode(a.owner.as.query(api.qr.sheet, { venueId: b.venueId }), "NOT_FOUND");
    // Sa portée, la zone de B : aucun jeton de B ne sort.
    await expectCode(a.owner.as.query(api.qr.sheet, { venueId: a.venueId, serviceAreaId: floorB.areaId }), "INVALID_ARGUMENT");
  },
  "qr.ensure": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.qr.ensure, { venueId: b.venueId }), "NOT_FOUND");
  },
  "qr.rotate": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.qr.rotate, { venueId: b.venueId, tableId: floorB.tableId }),
      a.owner.as.mutation(api.qr.rotate, { venueId: a.venueId, tableId: floorB.tableId }),
    );
  },

  /* ─── Surface client ─── */
  "guest.exchange": async ({ t, floorA }) => {
    // Le jeton de A ouvre la table de A, et rien d'autre : le laissez-passer désigne A.
    const result = await t.mutation(api.guest.exchange, { token: floorA.token });
    expect(result).toMatchObject({ ok: true, venueSlug: "maquis-a-cocody" });
  },
  "guest.tableMenu": async ({ t, floorA }) => {
    const result = await t.mutation(api.guest.exchange, { token: floorA.token });
    if (!result.ok) throw new Error("scan refusé");
    // Présenté sous l'adresse de B, le laissez-passer de A ne donne rien.
    expect(await t.query(api.guest.tableMenu, { pass: result.pass, venueSlug: "lounge-b-plateau" })).toBeNull();
    const menu = await t.query(api.guest.tableMenu, { pass: result.pass, venueSlug: result.venueSlug });
    expect(menu?.menus.map((m) => m.menu.name)).toEqual(["Carte A"]);
  },
  "guest.publicMenu": async ({ t }) => {
    // B n'a pas consenti : rien, exactement comme pour un établissement inexistant.
    expect(await t.query(api.guest.publicMenu, { venueSlug: "lounge-b-plateau" })).toBeNull();
    expect(await t.query(api.guest.publicMenu, { venueSlug: "inexistant" })).toBeNull();
  },
  "guest.availability": async ({ t, b }) => {
    // Lecture publique voulue : des indicateurs, aucun nom, aucun prix.
    const live = await t.query(api.guest.availability, { venueId: b.venueId });
    expect(JSON.stringify(live)).not.toContain("Plat B");
    expect(JSON.stringify(live)).not.toContain("2000");
  },
  "venues.publicMenuReadiness": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.venues.publicMenuReadiness, { venueId: b.venueId }), "NOT_FOUND");
  },
  "guest.sitemap": async ({ t }) => {
    // Aucun des deux n'a consenti : le plan du site est vide.
    expect(await t.query(api.guest.sitemap, {})).toEqual([]);
  },
  /* ─── Import et duplication ─── */
  "menuImport.apply": async ({ a, b, catalogB }) => {
    const rows = [{ line: 2, section: "Intrus", name: "Intrus", price: 1, allergens: [], tags: [] }];
    await bothRefused(
      a.owner.as.mutation(api.menuImport.apply, { venueId: b.venueId, menuId: catalogB.menuId, rows }),
      a.owner.as.mutation(api.menuImport.apply, { venueId: a.venueId, menuId: catalogB.menuId, rows }),
    );
  },
  "menuImport.sources": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.menuImport.sources, { venueId: b.venueId }), "NOT_FOUND");
    // Depuis son second établissement, A ne voit que ses propres cartes.
    const sources = await a.owner.as.query(api.menuImport.sources, { venueId: a.venueId });
    expect(sources.map((s) => s.venueName)).toEqual([]);
  },
  "menuImport.duplicateFromVenue": async ({ a, b, venueA2, catalogB }) => {
    // Recopier la carte de B chez A : B est hors de portée, la carte est introuvable.
    await expectCode(
      a.owner.as.mutation(api.menuImport.duplicateFromVenue, { venueId: venueA2, sourceVenueId: b.venueId, sourceMenuId: catalogB.menuId }),
      "NOT_FOUND",
    );
    // Son établissement comme source, la carte de B comme menu : introuvable aussi.
    await expectCode(
      a.owner.as.mutation(api.menuImport.duplicateFromVenue, { venueId: venueA2, sourceVenueId: a.venueId, sourceMenuId: catalogB.menuId }),
      "NOT_FOUND",
    );
  },
  /* ─── Service en salle : postes ─── */
  "stations.list": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.stations.list, { venueId: b.venueId }), "NOT_FOUND");
  },
  "stations.create": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.stations.create, { venueId: b.venueId, name: "Intrus", type: "bar" }), "NOT_FOUND");
  },
  "stations.update": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.stations.update, { venueId: w.b.venueId, stationId: s.stationId, name: "Intrus" }),
      w.a.owner.as.mutation(api.stations.update, { venueId: w.a.venueId, stationId: s.stationId, name: "Intrus" }),
    );
  },
  "stations.archive": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.stations.archive, { venueId: w.b.venueId, stationId: s.stationId }),
      w.a.owner.as.mutation(api.stations.archive, { venueId: w.a.venueId, stationId: s.stationId }),
    );
  },
  "stations.reorder": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.stations.reorder, { venueId: w.b.venueId, stationIds: [s.stationId] }),
      w.a.owner.as.mutation(api.stations.reorder, { venueId: w.a.venueId, stationIds: [s.stationId] }),
    );
  },
  "stations.routeSection": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.stations.routeSection, { venueId: w.b.venueId, sectionId: w.catalogB.sectionId, stationId: null }),
      w.a.owner.as.mutation(api.stations.routeSection, { venueId: w.a.venueId, sectionId: w.catalogB.sectionId, stationId: null }),
    );
    // Sa propre section vers le poste de B : le poste est introuvable.
    await expectCode(
      w.a.owner.as.mutation(api.stations.routeSection, { venueId: w.a.venueId, sectionId: w.catalogA.sectionId, stationId: s.stationId }),
      "NOT_FOUND",
    );
  },
  "stations.routeProduct": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.stations.routeProduct, { venueId: w.b.venueId, productId: w.catalogB.productId, stationId: null }),
      w.a.owner.as.mutation(api.stations.routeProduct, { venueId: w.a.venueId, productId: w.catalogA.productId, stationId: s.stationId }),
    );
  },
  "stations.routing": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.stations.routing, { venueId: b.venueId }), "NOT_FOUND");
  },
  /* ─── Service en salle : tables ─── */
  "sessions.open": async ({ a, b, floorB }) => {
    await bothRefused(
      a.owner.as.mutation(api.sessions.open, { venueId: b.venueId, tableId: floorB.tableId }),
      a.owner.as.mutation(api.sessions.open, { venueId: a.venueId, tableId: floorB.tableId }),
    );
  },
  "sessions.assignWaiter": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.sessions.assignWaiter, { venueId: w.b.venueId, sessionId: s.sessionId }),
      w.a.owner.as.mutation(api.sessions.assignWaiter, { venueId: w.a.venueId, sessionId: s.sessionId }),
    );
    // Sa propre table confiée au serveur de B : ce membre n'existe pas chez A.
    const mine = await openA(w);
    const memberB = await w.t.run(async (ctx) =>
      (await ctx.db.query("organizationMembers").withIndex("by_user", (q) => q.eq("userId", w.waiterB.userId)).unique())!,
    );
    await expectCode(
      w.a.owner.as.mutation(api.sessions.assignWaiter, { venueId: w.a.venueId, sessionId: mine, memberId: memberB._id }),
      "NOT_FOUND",
    );
  },
  "sessions.close": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.sessions.close, { venueId: w.b.venueId, sessionId: s.sessionId }),
      w.a.owner.as.mutation(api.sessions.close, { venueId: w.a.venueId, sessionId: s.sessionId }),
    );
  },
  "sessions.floor": async (w) => {
    await withServiceB(w);
    await expectCode(w.a.owner.as.query(api.sessions.floor, { venueId: w.b.venueId }), "NOT_FOUND");
    const floor = await w.a.owner.as.query(api.sessions.floor, { venueId: w.a.venueId });
    expect(JSON.stringify(floor)).not.toContain("Plat B");
  },
  "sessions.detail": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.query(api.sessions.detail, { venueId: w.b.venueId, sessionId: s.sessionId }),
      w.a.owner.as.query(api.sessions.detail, { venueId: w.a.venueId, sessionId: s.sessionId }),
    );
  },
  /* ─── Service en salle : commandes ─── */
  "orders.menu": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.orders.menu, { venueId: b.venueId }), "NOT_FOUND");
    const menu = await a.owner.as.query(api.orders.menu, { venueId: a.venueId });
    expect(JSON.stringify(menu)).not.toContain("Plat B");
  },
  "orders.submit": async (w) => {
    const s = await withServiceB(w);
    const line = { productId: w.catalogB.productId, optionIds: [], quantity: 1, courseNumber: 1 };
    await bothRefused(
      w.a.owner.as.mutation(api.orders.submit, { venueId: w.b.venueId, sessionId: s.sessionId, lines: [line], heldCourses: [], idempotencyKey: "intrus-000000000001" }),
      w.a.owner.as.mutation(api.orders.submit, { venueId: w.a.venueId, sessionId: s.sessionId, lines: [line], heldCourses: [], idempotencyKey: "intrus-000000000002" }),
    );
    // Sa table, le plat de B : introuvable dans SA carte, la commande n'est pas créée.
    const mine = await openA(w);
    const refused = await w.a.owner.as.mutation(api.orders.submit, {
      venueId: w.a.venueId,
      sessionId: mine,
      lines: [line],
      heldCourses: [],
      idempotencyKey: "intrus-000000000003",
    });
    expect(refused).toMatchObject({ ok: false, problems: [{ code: "PRODUCT_NOT_FOUND" }] });
    // La clé d'envoi de B ne rejoue pas la commande de B : A obtient la sienne.
    const own = await w.a.owner.as.mutation(api.orders.submit, {
      venueId: w.a.venueId,
      sessionId: mine,
      lines: [{ productId: w.catalogA.productId, optionIds: [], quantity: 1, courseNumber: 1 }],
      heldCourses: [],
      idempotencyKey: s.idempotencyKey,
    });
    expect(own).toMatchObject({ ok: true, replayed: false });
    if (own.ok) expect(own.orderId).not.toBe(s.orderId);
  },
  "orders.fireCourse": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.orders.fireCourse, { venueId: w.b.venueId, sessionId: s.sessionId, courseNumber: 2 }),
      w.a.owner.as.mutation(api.orders.fireCourse, { venueId: w.a.venueId, sessionId: s.sessionId, courseNumber: 2 }),
    );
  },
  "orders.serveTicket": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.orders.serveTicket, { venueId: w.b.venueId, ticketId: s.ticketId }),
      w.a.owner.as.mutation(api.orders.serveTicket, { venueId: w.a.venueId, ticketId: s.ticketId }),
    );
  },
  "orders.readyToServe": async (w) => {
    await withServiceB(w);
    await expectCode(w.a.owner.as.query(api.orders.readyToServe, { venueId: w.b.venueId }), "NOT_FOUND");
    expect((await w.a.owner.as.query(api.orders.readyToServe, { venueId: w.a.venueId })).tickets).toEqual([]);
  },
  "orders.cancelItem": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.orders.cancelItem, { venueId: w.b.venueId, itemId: s.itemId, reason: "intrusion" }),
      w.a.owner.as.mutation(api.orders.cancelItem, { venueId: w.a.venueId, itemId: s.itemId, reason: "intrusion" }),
    );
  },
  "orders.cancelOrder": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.orders.cancelOrder, { venueId: w.b.venueId, orderId: s.orderId, reason: "intrusion" }),
      w.a.owner.as.mutation(api.orders.cancelOrder, { venueId: w.a.venueId, orderId: s.orderId, reason: "intrusion" }),
    );
  },
  "orders.accept": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.orders.accept, { venueId: w.b.venueId, orderId: s.pendingOrderId }),
      w.a.owner.as.mutation(api.orders.accept, { venueId: w.a.venueId, orderId: s.pendingOrderId }),
    );
  },
  "orders.reject": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.orders.reject, { venueId: w.b.venueId, orderId: s.pendingOrderId, reason: "intrusion" }),
      w.a.owner.as.mutation(api.orders.reject, { venueId: w.a.venueId, orderId: s.pendingOrderId, reason: "intrusion" }),
    );
  },
  "orders.pendingAcceptance": async (w) => {
    await withServiceB(w);
    await expectCode(w.a.owner.as.query(api.orders.pendingAcceptance, { venueId: w.b.venueId }), "NOT_FOUND");
    expect(JSON.stringify(await w.a.owner.as.query(api.orders.pendingAcceptance, { venueId: w.a.venueId }))).not.toContain("-P");
  },
  /* ─── Service en salle : production ─── */
  "kitchen.board": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.query(api.kitchen.board, { venueId: w.b.venueId, stationId: s.stationId }),
      w.a.owner.as.query(api.kitchen.board, { venueId: w.a.venueId, stationId: s.stationId }),
    );
  },
  "kitchen.advance": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.kitchen.advance, { venueId: w.b.venueId, ticketId: s.ticketId, action: "ready" }),
      w.a.owner.as.mutation(api.kitchen.advance, { venueId: w.a.venueId, ticketId: s.ticketId, action: "ready" }),
    );
  },
  /* ─── Appareils et PIN (D-060) ─── */
  "devices.createEnrollment": async (w) => {
    const s = await withServiceB(w);
    await expectCode(w.a.owner.as.mutation(api.devices.createEnrollment, { venueId: w.b.venueId, label: "Intrus", deviceType: "shared" }), "NOT_FOUND");
    // Son établissement, le poste de B ; puis le serveur de B comme propriétaire d'un téléphone.
    await expectCode(
      w.a.owner.as.mutation(api.devices.createEnrollment, { venueId: w.a.venueId, label: "Intrus", deviceType: "kds", stationId: s.stationId }),
      "NOT_FOUND",
    );
    await expectCode(
      w.a.owner.as.mutation(api.devices.createEnrollment, { venueId: w.a.venueId, label: "Intrus", deviceType: "personal", memberId: w.waiterB.memberId }),
      "NOT_FOUND",
    );
  },
  "devices.enroll": async (w) => {
    const device = await enrollDevice(w.t, w.a.owner, w.a.venueId, { deviceType: "shared" });
    const stored = await w.t.run((ctx) => ctx.db.get(device.deviceId));
    expect(stored!.venueId).toBe(w.a.venueId);
  },
  "devices.list": async ({ t, a, b }) => {
    await enrollDevice(t, b.owner, b.venueId, { deviceType: "shared", label: "Tablette B" });
    await expectCode(a.owner.as.query(api.devices.list, { venueId: b.venueId }), "NOT_FOUND");
    expect(await a.owner.as.query(api.devices.list, { venueId: a.venueId })).toEqual([]);
  },
  "devices.revoke": async ({ t, a, b }) => {
    const deviceB = await enrollDevice(t, b.owner, b.venueId, { deviceType: "shared" });
    await bothRefused(
      a.owner.as.mutation(api.devices.revoke, { venueId: b.venueId, deviceId: deviceB.deviceId }),
      a.owner.as.mutation(api.devices.revoke, { venueId: a.venueId, deviceId: deviceB.deviceId }),
    );
    expect((await t.run((ctx) => ctx.db.get(deviceB.deviceId)))!.revokedAt).toBeUndefined();
  },
  "staff.createPinMember": async ({ a, b }) => {
    await expectCode(
      a.owner.as.mutation(api.staff.createPinMember, { organizationId: b.organizationId, displayName: "Intrus", roleId: b.roleId("waiter"), venueIds: [] }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.staff.createPinMember, { organizationId: a.organizationId, displayName: "Intrus", roleId: b.roleId("waiter"), venueIds: [] }),
      "NOT_FOUND",
    );
    await expectCode(
      a.owner.as.mutation(api.staff.createPinMember, { organizationId: a.organizationId, displayName: "Intrus", roleId: a.roleId("waiter"), venueIds: [b.venueId] }),
      "NOT_FOUND",
    );
  },
  "staff.issueActivationCode": async ({ a, b, waiterB }) => {
    await expectCode(a.owner.as.mutation(api.staff.issueActivationCode, { organizationId: b.organizationId, memberId: waiterB.memberId }), "NOT_FOUND");
    await expectCode(a.owner.as.mutation(api.staff.issueActivationCode, { organizationId: a.organizationId, memberId: waiterB.memberId }), "NOT_FOUND");
  },
  "staff.disablePin": async ({ a, b, waiterB }) => {
    await expectCode(a.owner.as.mutation(api.staff.disablePin, { organizationId: b.organizationId, memberId: waiterB.memberId }), "NOT_FOUND");
    await expectCode(a.owner.as.mutation(api.staff.disablePin, { organizationId: a.organizationId, memberId: waiterB.memberId }), "NOT_FOUND");
  },
  "operators.roster": async ({ t, a, b }) => {
    const deviceA = await enrollDevice(t, a.owner, a.venueId, { deviceType: "shared" });
    const koffiB = await pinMember(b.owner, b.organizationId, b.roleId("waiter"), [b.venueId], "Koffi B");
    const deviceB = await enrollDevice(t, b.owner, b.venueId, { deviceType: "shared" });
    await activateAndUnlock(t, deviceB.deviceToken, koffiB.code, "2468");
    const roster = await t.query(api.operators.roster, { deviceToken: deviceA.deviceToken });
    expect(roster.venueName).toBe("Maquis A — Cocody");
    expect(JSON.stringify(roster)).not.toContain("Koffi B");
  },
  "operators.activate": async ({ t, a, b }) => {
    const deviceA = await enrollDevice(t, a.owner, a.venueId, { deviceType: "shared" });
    const koffiB = await pinMember(b.owner, b.organizationId, b.roleId("waiter"), [b.venueId], "Koffi B");
    // Le code de B sur un appareil de A : refusé, et le PIN de B n'est pas posé.
    expect(await t.mutation(api.operators.activate, { deviceToken: deviceA.deviceToken, code: koffiB.code, pin: "2468" })).toMatchObject({ ok: false, reason: "invalid_code" });
    const credential = await t.run((ctx) => ctx.db.query("staffCredentials").withIndex("by_member", (q) => q.eq("memberId", koffiB.memberId)).unique());
    expect(credential!.status).toBe("pending");
  },
  "operators.unlock": async ({ t, a, b }) => {
    const deviceA = await enrollDevice(t, a.owner, a.venueId, { deviceType: "shared" });
    const koffiB = await pinMember(b.owner, b.organizationId, b.roleId("waiter"), [b.venueId], "Koffi B");
    const deviceB = await enrollDevice(t, b.owner, b.venueId, { deviceType: "shared" });
    await activateAndUnlock(t, deviceB.deviceToken, koffiB.code, "2468");
    // Le bon PIN d'un membre de B, sur la tablette de A : rien.
    expect(await t.action(api.operators.unlock, { deviceToken: deviceA.deviceToken, memberId: koffiB.memberId, pin: "2468" })).toMatchObject({ ok: false, reason: "not_here" });
  },
  "operators.refresh": async ({ t, a, b }) => {
    const deviceA = await enrollDevice(t, a.owner, a.venueId, { deviceType: "shared" });
    const koffiB = await pinMember(b.owner, b.organizationId, b.roleId("waiter"), [b.venueId], "Koffi B");
    const deviceB = await enrollDevice(t, b.owner, b.venueId, { deviceType: "shared" });
    const opB = await activateAndUnlock(t, deviceB.deviceToken, koffiB.code, "2468");
    // Le secret de renouvellement de B, présenté par l'appareil de A : refusé.
    expect(await t.action(api.operators.refresh, { deviceToken: deviceA.deviceToken, refreshSecret: opB.refreshSecret })).toEqual({ ok: false });
  },
  "operators.lock": async ({ t, a, b }) => {
    const deviceA = await enrollDevice(t, a.owner, a.venueId, { deviceType: "shared" });
    const koffiB = await pinMember(b.owner, b.organizationId, b.roleId("waiter"), [b.venueId], "Koffi B");
    const deviceB = await enrollDevice(t, b.owner, b.venueId, { deviceType: "shared" });
    const opB = await activateAndUnlock(t, deviceB.deviceToken, koffiB.code, "2468");
    await t.mutation(api.operators.lock, { deviceToken: deviceA.deviceToken });
    expect((await t.run((ctx) => ctx.db.get(opB.sessionId)))!.endedAt).toBeUndefined();
  },
  /* ─── Le client à table (D-061) ─── */
  "guestService.presence": async (w) => {
    const b = await guestAtB(w);
    // Le laissez-passer de B présenté sous l'adresse de A : rien.
    expect(await w.t.query(api.guestService.presence, { ...b.guest, venueSlug: "maquis-a-cocody" })).toBeNull();
    // Le laissez-passer de A, avec le téléphone du client de B : A ne voit pas le panier de B.
    const scannedA = await w.t.mutation(api.guest.exchange, { token: w.floorA.token });
    if (!scannedA.ok) throw new Error("scan refusé");
    const seen = await w.t.query(api.guestService.presence, { pass: scannedA.pass, venueSlug: scannedA.venueSlug, guestKey: b.guest.guestKey });
    expect(seen).toMatchObject({ tableOpen: false, cart: null, orders: [] });
  },
  "guestService.saveCart": async (w) => {
    const b = await guestAtB(w);
    expect(await w.t.mutation(api.guestService.saveCart, { ...b.guest, venueSlug: "maquis-a-cocody", lines: [] })).toEqual({ ok: false, reason: "invalid_pass" });
    // Chez A, le plat de B n'existe pas.
    await openA(w);
    const scannedA = await w.t.mutation(api.guest.exchange, { token: w.floorA.token });
    if (!scannedA.ok) throw new Error("scan refusé");
    const saved = await w.t.mutation(api.guestService.saveCart, {
      pass: scannedA.pass,
      venueSlug: scannedA.venueSlug,
      guestKey: "telephone-chez-a-0000000001",
      lines: [{ productId: w.catalogB.productId, optionIds: [], quantity: 1 }],
    });
    expect(saved).toMatchObject({ ok: true, problems: [{ code: "PRODUCT_NOT_FOUND" }] });
  },
  "guestService.submitCart": async (w) => {
    const b = await guestAtB(w);
    expect(await w.t.mutation(api.guestService.submitCart, { ...b.guest, venueSlug: "maquis-a-cocody", idempotencyKey: "intrus-000000000009" })).toEqual({ ok: false, reason: "invalid_pass" });
  },
  "guestService.requestService": async (w) => {
    const b = await guestAtB(w);
    expect(await w.t.mutation(api.guestService.requestService, { ...b.guest, venueSlug: "maquis-a-cocody", type: "call_waiter" })).toEqual({ ok: false, reason: "invalid_pass" });
  },
  "guestService.enterCode": async (w) => {
    const b = await guestAtB(w);
    expect(await w.t.mutation(api.guestService.enterCode, { ...b.guest, venueSlug: "maquis-a-cocody", code: "1234" })).toEqual({ ok: false, reason: "invalid_pass" });
    // Le code de B, donné chez A : la table de A n'est pas ouverte, rien n'est admis.
    const code = (await w.t.run((ctx) => ctx.db.get(b.service.sessionId)))!.activationCode!;
    const scannedA = await w.t.mutation(api.guest.exchange, { token: w.floorA.token });
    if (!scannedA.ok) throw new Error("scan refusé");
    expect(await w.t.mutation(api.guestService.enterCode, { pass: scannedA.pass, venueSlug: scannedA.venueSlug, guestKey: b.guest.guestKey, code })).toEqual({ ok: false, reason: "table_not_open" });
  },
  "guestService.submitLines": async (w) => {
    const b = await guestAtB(w);
    expect(
      await w.t.mutation(api.guestService.submitLines, { ...b.guest, venueSlug: "maquis-a-cocody", idempotencyKey: "intrus-000000000012", lines: [] }),
    ).toEqual({ ok: false, reason: "invalid_pass" });
  },
  "guestService.submitFeedback": async (w) => {
    const b = await guestAtB(w);
    expect(await w.t.mutation(api.guestService.submitFeedback, { ...b.guest, venueSlug: "maquis-a-cocody", rating: 1, topics: [] })).toEqual({ ok: false, reason: "invalid_pass" });
  },
  "sessions.rotateCode": async (w) => {
    const b = await guestAtB(w);
    const before = (await w.t.run((ctx) => ctx.db.get(b.service.sessionId)))!.activationCode;
    await bothRefused(
      w.a.owner.as.mutation(api.sessions.rotateCode, { venueId: w.b.venueId, sessionId: b.service.sessionId }),
      w.a.owner.as.mutation(api.sessions.rotateCode, { venueId: w.a.venueId, sessionId: b.service.sessionId }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(b.service.sessionId)))!.activationCode).toBe(before);
  },
  "sessions.admitGuest": async (w) => {
    const b = await guestAtB(w);
    const [guest] = await w.t.run((ctx) => ctx.db.query("guestSessions").collect());
    await bothRefused(
      w.a.owner.as.mutation(api.sessions.admitGuest, { venueId: w.b.venueId, sessionId: b.service.sessionId, guestSessionId: guest!._id }),
      w.a.owner.as.mutation(api.sessions.admitGuest, { venueId: w.a.venueId, sessionId: b.service.sessionId, guestSessionId: guest!._id }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(guest!._id)))!.admittedAt).toBeUndefined();
  },
  "sessions.removeGuest": async (w) => {
    const b = await guestAtB(w);
    const [guest] = await w.t.run((ctx) => ctx.db.query("guestSessions").collect());
    await bothRefused(
      w.a.owner.as.mutation(api.sessions.removeGuest, { venueId: w.b.venueId, sessionId: b.service.sessionId, guestSessionId: guest!._id }),
      w.a.owner.as.mutation(api.sessions.removeGuest, { venueId: w.a.venueId, sessionId: b.service.sessionId, guestSessionId: guest!._id }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(guest!._id)))!.removedAt).toBeUndefined();
  },
  "feedback.list": async (w) => {
    await expectCode(w.a.owner.as.query(api.feedback.list, { venueId: w.b.venueId }), "NOT_FOUND");
    expect((await w.a.owner.as.query(api.feedback.list, { venueId: w.a.venueId })).items).toEqual([]);
  },
  "feedback.markSeen": async (w) => {
    const id = await w.t.run((ctx) =>
      ctx.db.insert("feedback", { venueId: w.b.venueId, rating: 1, topics: [], isPublicRedirect: false, status: "new", createdAt: Date.now() }),
    );
    await bothRefused(
      w.a.owner.as.mutation(api.feedback.markSeen, { venueId: w.b.venueId, feedbackId: id }),
      w.a.owner.as.mutation(api.feedback.markSeen, { venueId: w.a.venueId, feedbackId: id }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(id)))!.status).toBe("new");
  },
  "carts.forSession": async (w) => {
    const b = await guestAtB(w);
    await bothRefused(
      w.a.owner.as.query(api.carts.forSession, { venueId: w.b.venueId, sessionId: b.service.sessionId }),
      w.a.owner.as.query(api.carts.forSession, { venueId: w.a.venueId, sessionId: b.service.sessionId }),
    );
  },
  "carts.importCart": async (w) => {
    const b = await guestAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.carts.importCart, { venueId: w.b.venueId, cartId: b.cartId, idempotencyKey: "intrus-000000000010" }),
      w.a.owner.as.mutation(api.carts.importCart, { venueId: w.a.venueId, cartId: b.cartId, idempotencyKey: "intrus-000000000011" }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(b.cartId)))!.status).toBe("active");
  },
  "carts.takeCart": async (w) => {
    const b = await guestAtB(w);
    const seen = (await w.t.run((ctx) => ctx.db.get(b.cartId)))!.updatedAt;
    await bothRefused(
      w.a.owner.as.mutation(api.carts.takeCart, { venueId: w.b.venueId, cartId: b.cartId, seenUpdatedAt: seen }),
      w.a.owner.as.mutation(api.carts.takeCart, { venueId: w.a.venueId, cartId: b.cartId, seenUpdatedAt: seen }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(b.cartId)))!.status).toBe("active");
  },
  "carts.dismissCart": async (w) => {
    const b = await guestAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.carts.dismissCart, { venueId: w.b.venueId, cartId: b.cartId }),
      w.a.owner.as.mutation(api.carts.dismissCart, { venueId: w.a.venueId, cartId: b.cartId }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(b.cartId)))!.status).toBe("active");
  },
  "serviceRequests.open": async (w) => {
    await guestAtB(w);
    await expectCode(w.a.owner.as.query(api.serviceRequests.open, { venueId: w.b.venueId }), "NOT_FOUND");
    expect((await w.a.owner.as.query(api.serviceRequests.open, { venueId: w.a.venueId })).requests).toEqual([]);
  },
  "serviceRequests.acknowledge": async (w) => {
    const b = await guestAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.serviceRequests.acknowledge, { venueId: w.b.venueId, requestId: b.requestId }),
      w.a.owner.as.mutation(api.serviceRequests.acknowledge, { venueId: w.a.venueId, requestId: b.requestId }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(b.requestId)))!.status).toBe("open");
  },
  "serviceRequests.resolve": async (w) => {
    const b = await guestAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.serviceRequests.resolve, { venueId: w.b.venueId, requestId: b.requestId }),
      w.a.owner.as.mutation(api.serviceRequests.resolve, { venueId: w.a.venueId, requestId: b.requestId }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(b.requestId)))!.status).toBe("open");
  },
  "venues.setOrderingMode": async ({ t, a, b }) => {
    await expectCode(a.owner.as.mutation(api.venues.setOrderingMode, { venueId: b.venueId, orderingMode: "guest_with_approval" }), "NOT_FOUND");
    const settings = await t.run(async (ctx) => (await ctx.db.query("venueSettings").withIndex("by_venue", (q) => q.eq("venueId", b.venueId)).unique())!);
    expect(settings.service.orderingMode).toBe("staff_only");
  },
  "orders.lookupSubmission": async (w) => {
    await withServiceB(w);
    const idempotencyKey = "isolation-B-0000000001";
    await expectCode(w.a.owner.as.query(api.orders.lookupSubmission, { venueId: w.b.venueId, idempotencyKey }), "NOT_FOUND");
    // Dans son propre établissement, A ne voit pas la clé de B : elle n'existe pas chez lui.
    expect(await w.a.owner.as.query(api.orders.lookupSubmission, { venueId: w.a.venueId, idempotencyKey })).toBeNull();
    expect(await w.b.owner.as.query(api.orders.lookupSubmission, { venueId: w.b.venueId, idempotencyKey })).toMatchObject({ reference: "A-001" });
  },
  "operators.touch": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.operators.touch, { venueId: b.venueId }), "NOT_FOUND");
    expect(typeof (await a.owner.as.mutation(api.operators.touch, { venueId: a.venueId })).now).toBe("number");
  },
  "operators.me": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.operators.me, { venueId: b.venueId }), "NOT_FOUND");
    expect((await a.owner.as.query(api.operators.me, { venueId: a.venueId })).venueName).toBe("Maquis A — Cocody");
  },
  /* ── T3 : l'argent ─────────────────────────────────────────────────────── */
  "checks.forSession": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.query(api.checks.forSession, { venueId: w.b.venueId, sessionId: m.service.sessionId }),
      w.a.owner.as.query(api.checks.forSession, { venueId: w.a.venueId, sessionId: m.service.sessionId }),
    );
  },
  "checks.requestBill": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.checks.requestBill, { venueId: w.b.venueId, sessionId: s.sessionId }),
      w.a.owner.as.mutation(api.checks.requestBill, { venueId: w.a.venueId, sessionId: s.sessionId }),
    );
  },
  "checks.split": async (w) => {
    const s = await withServiceB(w);
    const lines = [{ orderItemId: s.itemId, quantity: 1 }];
    await bothRefused(
      w.a.owner.as.mutation(api.checks.split, { venueId: w.b.venueId, sessionId: s.sessionId, lines }),
      w.a.owner.as.mutation(api.checks.split, { venueId: w.a.venueId, sessionId: s.sessionId, lines }),
    );
  },
  "checks.unsplit": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.checks.unsplit, { venueId: w.b.venueId, checkId: m.checkId }),
      w.a.owner.as.mutation(api.checks.unsplit, { venueId: w.a.venueId, checkId: m.checkId }),
    );
  },
  "checks.comp": async (w) => {
    const s = await withServiceB(w);
    const args = { checkId: null, orderItemId: s.itemId, reason: "intrusion de A" };
    await bothRefused(
      w.a.owner.as.mutation(api.checks.comp, { venueId: w.b.venueId, sessionId: s.sessionId, ...args }),
      w.a.owner.as.mutation(api.checks.comp, { venueId: w.a.venueId, sessionId: s.sessionId, ...args }),
    );
  },
  "checks.discount": async (w) => {
    const s = await withServiceB(w);
    const args = { checkId: null, amount: 100, reason: "intrusion de A" };
    await bothRefused(
      w.a.owner.as.mutation(api.checks.discount, { venueId: w.b.venueId, sessionId: s.sessionId, ...args }),
      w.a.owner.as.mutation(api.checks.discount, { venueId: w.a.venueId, sessionId: s.sessionId, ...args }),
    );
  },
  "payments.collect": async (w) => {
    const s = await withServiceB(w);
    const args = { checkId: null, method: "card" as const, amount: 100, idempotencyKey: "isolation-intrusion-000001" };
    await bothRefused(
      w.a.owner.as.mutation(api.payments.collect, { venueId: w.b.venueId, sessionId: s.sessionId, ...args }),
      w.a.owner.as.mutation(api.payments.collect, { venueId: w.a.venueId, sessionId: s.sessionId, ...args }),
    );
    // Sa propre table, mais l'addition de B.
    const m = await moneyAtB(w);
    const mine = await openA(w);
    await expectCode(w.a.owner.as.mutation(api.payments.collect, { venueId: w.a.venueId, sessionId: mine, ...args, checkId: m.checkId }), "NOT_FOUND");
  },
  "payments.voidPayment": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.payments.voidPayment, { venueId: w.b.venueId, paymentId: m.paymentId, reason: "intrusion de A" }),
      w.a.owner.as.mutation(api.payments.voidPayment, { venueId: w.a.venueId, paymentId: m.paymentId, reason: "intrusion de A" }),
    );
  },
  "payments.refund": async (w) => {
    const m = await moneyAtB(w);
    const args = { paymentId: m.paymentId, amount: 100, reason: "intrusion de A", method: "original" as const, idempotencyKey: "isolation-intrusion-000002" };
    await bothRefused(
      w.a.owner.as.mutation(api.payments.refund, { venueId: w.b.venueId, ...args }),
      w.a.owner.as.mutation(api.payments.refund, { venueId: w.a.venueId, ...args }),
    );
    expect((await w.t.run((ctx) => ctx.db.get(m.paymentId)))!.status).toBe("succeeded");
  },
  "bills.issue": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.bills.issue, { venueId: w.b.venueId, checkId: m.checkId }),
      w.a.owner.as.mutation(api.bills.issue, { venueId: w.a.venueId, checkId: m.checkId }),
    );
  },
  "bills.get": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.query(api.bills.get, { venueId: w.b.venueId, billId: m.billId }),
      w.a.owner.as.query(api.bills.get, { venueId: w.a.venueId, billId: m.billId }),
    );
  },
  "bills.recordPrint": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.bills.recordPrint, { venueId: w.b.venueId, billId: m.billId }),
      w.a.owner.as.mutation(api.bills.recordPrint, { venueId: w.a.venueId, billId: m.billId }),
    );
  },
  "cash.overview": async (w) => {
    await moneyAtB(w);
    await expectCode(w.a.owner.as.query(api.cash.overview, { venueId: w.b.venueId }), "NOT_FOUND");
    expect((await w.a.owner.as.query(api.cash.overview, { venueId: w.a.venueId })).sessions).toEqual([]);
  },
  "cash.createRegister": async ({ a, b }) => {
    await expectCode(a.owner.as.mutation(api.cash.createRegister, { venueId: b.venueId, name: "Bar" }), "NOT_FOUND");
    await a.owner.as.mutation(api.cash.createRegister, { venueId: a.venueId, name: "Bar" });
  },
  "cash.open": async (w) => {
    const m = await moneyAtB(w);
    await expectCode(w.a.owner.as.mutation(api.cash.open, { venueId: w.b.venueId, openingFloat: 0 }), "NOT_FOUND");
    await expectCode(w.a.owner.as.mutation(api.cash.open, { venueId: w.a.venueId, registerId: m.registerId, openingFloat: 0 }), "NOT_FOUND");
  },
  "cash.startCount": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.cash.startCount, { venueId: w.b.venueId, sessionId: m.cashSessionId }),
      w.a.owner.as.mutation(api.cash.startCount, { venueId: w.a.venueId, sessionId: m.cashSessionId }),
    );
  },
  "cash.cancelCount": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.cash.cancelCount, { venueId: w.b.venueId, sessionId: m.cashSessionId }),
      w.a.owner.as.mutation(api.cash.cancelCount, { venueId: w.a.venueId, sessionId: m.cashSessionId }),
    );
  },
  "cash.submitCount": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.cash.submitCount, { venueId: w.b.venueId, sessionId: m.cashSessionId, countedAmount: 0 }),
      w.a.owner.as.mutation(api.cash.submitCount, { venueId: w.a.venueId, sessionId: m.cashSessionId, countedAmount: 0 }),
    );
  },
  "cash.close": async (w) => {
    const m = await moneyAtB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.cash.close, { venueId: w.b.venueId, sessionId: m.cashSessionId, reason: "intrusion de A" }),
      w.a.owner.as.mutation(api.cash.close, { venueId: w.a.venueId, sessionId: m.cashSessionId, reason: "intrusion de A" }),
    );
  },
  "cash.addMovement": async (w) => {
    const m = await moneyAtB(w);
    const args = { sessionId: m.cashSessionId, type: "payout" as const, amount: 100, reason: "intrusion de A" };
    await bothRefused(
      w.a.owner.as.mutation(api.cash.addMovement, { venueId: w.b.venueId, ...args }),
      w.a.owner.as.mutation(api.cash.addMovement, { venueId: w.a.venueId, ...args }),
    );
  },
  "cash.setPaymentSettings": async ({ t, a, b }) => {
    const args = { cashMode: "per_waiter" as const, mobileMoneyWallets: ["Wave"], amountStep: 5, serviceDayStartHour: 6 };
    await expectCode(a.owner.as.mutation(api.cash.setPaymentSettings, { venueId: b.venueId, ...args }), "NOT_FOUND");
    await a.owner.as.mutation(api.cash.setPaymentSettings, { venueId: a.venueId, ...args });
    const settingsB = await t.run((ctx) => ctx.db.query("venueSettings").withIndex("by_venue", (q) => q.eq("venueId", b.venueId)).unique());
    expect(settingsB!.payments.cashMode).toBeUndefined();
  },
  "cash.paymentSettings": async ({ a, b }) => {
    await expectCode(a.owner.as.query(api.cash.paymentSettings, { venueId: b.venueId }), "NOT_FOUND");
    expect((await a.owner.as.query(api.cash.paymentSettings, { venueId: a.venueId })).cashMode).toBe("central");
  },
  "sessions.closeWithDebt": async (w) => {
    const s = await withServiceB(w);
    await bothRefused(
      w.a.owner.as.mutation(api.sessions.closeWithDebt, { venueId: w.b.venueId, sessionId: s.sessionId, reason: "intrusion de A" }),
      w.a.owner.as.mutation(api.sessions.closeWithDebt, { venueId: w.a.venueId, sessionId: s.sessionId, reason: "intrusion de A" }),
    );
  },
  "sessions.debts": async (w) => {
    await moneyAtB(w);
    await expectCode(w.a.owner.as.query(api.sessions.debts, { venueId: w.b.venueId }), "NOT_FOUND");
    expect(await w.a.owner.as.query(api.sessions.debts, { venueId: w.a.venueId })).toEqual([]);
  },
  "reports.serviceDay": async (w) => {
    await moneyAtB(w);
    await expectCode(w.a.owner.as.query(api.reports.serviceDay, { venueId: w.b.venueId }), "NOT_FOUND");
    const mine = await w.a.owner.as.query(api.reports.serviceDay, { venueId: w.a.venueId });
    expect([mine.totals!.collected, mine.cashSessions, mine.openTables]).toEqual([0, [], []]);
  },
};

describe("isolation multi-tenant : A ne voit ni ne touche rien de B", () => {
  for (const [name, run] of Object.entries(CASES)) {
    test(name, async () => {
      const world = await twoTenants();
      await run(world);
      // Et rien de B n'a bougé : même nom, même établissement, mêmes membres.
      const org = await world.b.owner.as.query(api.organizations.get, { organizationId: world.b.organizationId });
      expect(org.name).toBe("Lounge B");
      expect(org.venues.map((v) => v.name)).toEqual(["Lounge B — Plateau"]);
      const members = await world.b.owner.as.query(api.team.listMembers, { scope: { organizationId: world.b.organizationId } });
      expect(members.filter((m) => m.kind === "account").map((m) => m.email).sort()).toEqual(["bakary@lounge-b.ci", "serveur@lounge-b.ci"]);
      expect(members.find((m) => m.email === "serveur@lounge-b.ci")?.status).toBe("active");
      // Et la carte de B est intacte : produit, prix, disponibilité, version en ligne.
      const productB = await world.b.owner.as.query(api.products.get, { venueId: world.b.venueId, productId: world.catalogB.productId });
      expect([productB.name, productB.basePrice, productB.isActive, productB.isAvailable]).toEqual(["Plat B", 2000, true, true]);
      expect(productB.variants.map((x) => [x.name, x.price])).toEqual([["Grand", 3000]]);
      const groupsB = await world.b.owner.as.query(api.modifiers.list, { venueId: world.b.venueId });
      expect(groupsB.map((g) => [g.name, g.options.map((o) => [o.name, o.priceDelta, o.isAvailable])])).toEqual([
        ["Cuisson B", [["Saignant", 0, true], ["À point", 0, true]]],
      ]);
      const historyB = await world.b.owner.as.query(api.publications.history, { venueId: world.b.venueId, menuId: world.catalogB.menuId });
      expect(historyB.map((h) => [h.version, h.isCurrent])).toEqual([[1, true]]);
      const boardB = await world.b.owner.as.query(api.availability.board, { venueId: world.b.venueId });
      expect(boardB.rules).toHaveLength(1);
      const planB = await world.b.owner.as.query(api.floor.overview, { venueId: world.b.venueId });
      const tableStatus = world.serviceB ? "occupied" : "available";
      expect(planB.areas.map((a) => [a.name, a.tables.map((x) => [x.number, x.status, x.qr?.version])])).toEqual([
        ["Salle", [["1", tableStatus, 1]]],
      ]);
      // Et le service de B n'a pas bougé : même commande, même bon, même attente de validation.
      if (world.serviceB) {
        const s = world.serviceB;
        const state = await world.t.run(async (ctx) => ({
          order: (await ctx.db.get(s.orderId))?.status,
          pending: (await ctx.db.get(s.pendingOrderId))?.status,
          ticket: (await ctx.db.get(s.ticketId))?.status,
          item: (await ctx.db.get(s.itemId))?.status,
          session: (await ctx.db.get(s.sessionId))?.status,
          station: (await ctx.db.get(s.stationId))?.name,
          sectionRouting: (await ctx.db.get(world.catalogB.productId))?.prepStationId ?? null,
        }));
        expect(state).toEqual({
          order: "accepted",
          pending: "pending_acceptance",
          ticket: "queued",
          item: "ordered",
          session: world.moneyB ? "settling" : "ordering",
          station: "Bar B",
          sectionRouting: null,
        });
      }
      // Et l'argent de B n'a pas bougé : paiement, caisse, addition, ticket.
      if (world.moneyB) {
        const m = world.moneyB;
        const money = await world.t.run(async (ctx) => ({
          payment: (await ctx.db.get(m.paymentId))?.status,
          cash: (await ctx.db.get(m.cashSessionId))?.status,
          check: (await ctx.db.get(m.checkId))?.status,
          bill: (await ctx.db.get(m.billId))?.deliveredVia,
          refunds: (await ctx.db.query("refunds").collect()).length,
          adjustments: (await ctx.db.query("orderAdjustments").collect()).length,
          movements: (await ctx.db.query("cashMovements").collect()).length,
        }));
        expect(money).toEqual({ payment: "succeeded", cash: "open", check: "open", bill: [], refunds: 0, adjustments: 0, movements: 0 });
      }
    });
  }

  test("chaque fonction publique a un cas d'isolation", async () => {
    const exported: string[] = [];
    for (const [path, load] of Object.entries(modules)) {
      if (path.includes("/_generated/") || path.includes("/lib/")) continue;
      // Configuration, pas de fonctions : les charger n'apporte rien (et `convex.config`
      // tire la configuration de composants tiers, non chargeable hors déploiement).
      if (/\/(convex\.config|auth\.config|schema|http)\.ts$/.test(path)) continue;
      const moduleName = path.replace(/^.*\/convex\//, "").replace(/\.ts$/, "");
      const mod = (await load()) as Record<string, { isPublic?: boolean } | undefined>;
      for (const [name, fn] of Object.entries(mod)) {
        if (fn?.isPublic === true) exported.push(`${moduleName}.${name}`);
      }
    }
    expect(exported.length).toBeGreaterThan(20);
    expect(exported.filter((name) => !(name in CASES))).toEqual([]);
    expect(Object.keys(CASES).filter((name) => !exported.includes(name))).toEqual([]);
  });
});
