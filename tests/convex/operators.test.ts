/**
 * Appareils enrôlés et PIN de service — D-060.
 *
 * « Maquis Awa », Cocody : une tablette partagée en salle, un écran de cuisine au poste
 * « Cuisine ». Koffi, serveur SANS COMPTE, active son PIN et travaille ; on vérifie ce que le PIN
 * permet, ce qu'il ne permet jamais, et que chaque protection (verrou, désactivation, suspension
 * de l'appareil, révocation, inactivité) coupe l'accès au bon moment.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { restaurantWithMenu } from "./catalogFixtures";
import { activateAndUnlock, asDevice, enrollDevice, pinMember, unlockAs } from "./deviceFixtures";
import { expectCode, OPERATOR_ISSUER } from "./setup";

async function venueWithDevices() {
  const r = await restaurantWithMenu();
  const { owner, cocody } = r;
  await owner.as.mutation(api.publications.publish, { venueId: cocody, menuId: r.menuId });
  const [areaId] = await owner.as.mutation(api.floor.createAreas, { venueId: cocody, names: ["Salle"] });
  const tableId = await owner.as.mutation(api.floor.createTable, { venueId: cocody, serviceAreaId: areaId!, number: "4", seats: 4, shape: "square" });
  const cuisine = await owner.as.mutation(api.stations.create, { venueId: cocody, name: "Cuisine", type: "kitchen" });
  const bar = await owner.as.mutation(api.stations.create, { venueId: cocody, name: "Bar", type: "bar" });
  const tablet = await enrollDevice(r.t, owner, cocody, { deviceType: "shared", label: "Tablette salle" });
  const kds = await enrollDevice(r.t, owner, cocody, { deviceType: "kds", label: "Écran cuisine", stationId: cuisine });
  const koffi = await pinMember(owner, r.organizationId, r.roleId("waiter"), [cocody], "Koffi");
  return { ...r, tableId, cuisine, bar, tablet, kds, koffi };
}

type Venue = Awaited<ReturnType<typeof venueWithDevices>>;

async function koffiAtWork(v: Venue) {
  return activateAndUnlock(v.t, v.tablet.deviceToken, v.koffi.code, "2468");
}

function order(v: Venue, sessionId: Id<"tableSessions">, key: string) {
  return { venueId: v.cocody, sessionId, lines: [{ productId: v.products.alloco, optionIds: [], quantity: 1, courseNumber: 1 }], heldCourses: [], idempotencyKey: key };
}

describe("un serveur sans compte travaille avec son PIN", () => {
  test("activer, s'identifier, ouvrir une table, commander : chaque geste porte le membre et l'appareil", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    expect(koffi.name).toBe("Koffi");

    const roster = await v.t.query(api.operators.roster, { deviceToken: v.tablet.deviceToken });
    expect(roster.people.map((p) => p.name)).toEqual(["Koffi"]);

    const sessionId = await koffi.as.mutation(api.sessions.open, { venueId: v.cocody, tableId: v.tableId });
    const sent = await koffi.as.mutation(api.orders.submit, order(v, sessionId, "pin-envoi-000000001"));
    expect(sent.ok).toBe(true);
    const [session, placed, events] = await v.t.run(async (ctx) => [
      await ctx.db.get(sessionId),
      (await ctx.db.query("orders").collect())[0]!,
      await ctx.db.query("orderEvents").collect(),
    ] as const);
    expect(session!.assignedWaiterMemberId).toBe(koffi.memberId);
    expect(placed.placedByMemberId).toBe(koffi.memberId);
    expect(events.every((e) => e.actorMemberId === koffi.memberId && e.actorDeviceId === v.tablet.deviceId && e.actorOperatorSessionId === koffi.sessionId)).toBe(true);

    const floor = await koffi.as.query(api.sessions.floor, { venueId: v.cocody });
    expect(floor.areas[0]!.tables[0]!.session).toMatchObject({ waiterName: "Koffi", isMine: true });
  });

  test("le PIN plafonne les droits : même le propriétaire ne fait sous PIN que des gestes de service", async () => {
    const v = await venueWithDevices();
    const own = await v.owner.as.mutation(api.staff.issueActivationCode, { organizationId: v.organizationId, memberId: await ownerMember(v) });
    const owner = await activateAndUnlock(v.t, v.tablet.deviceToken, own.code, "7391");
    const sessionId = await owner.as.mutation(api.sessions.open, { venueId: v.cocody, tableId: v.tableId });
    const sent = await owner.as.mutation(api.orders.submit, order(v, sessionId, "pin-envoi-000000002"));
    if (!sent.ok) throw new Error("commande refusée");
    // Annuler une commande est sensible : jamais sous PIN.
    await expectCode(owner.as.mutation(api.orders.cancelOrder, { venueId: v.cocody, orderId: sent.orderId, reason: "essai" }), "FORBIDDEN");
    // Et les fonctions d'administration ne reconnaissent pas un jeton d'opérateur.
    await expectCode(owner.as.mutation(api.publications.publish, { venueId: v.cocody, menuId: v.menuId }), "UNAUTHENTICATED");
    await expectCode(owner.as.query(api.devices.list, { venueId: v.cocody }), "UNAUTHENTICATED");
  });

  test("le code d'activation ne sert qu'une fois, et un PIN trop simple est refusé", async () => {
    const v = await venueWithDevices();
    const weak = await v.t.mutation(api.operators.activate, { deviceToken: v.tablet.deviceToken, code: v.koffi.code, pin: "1234" });
    expect(weak).toMatchObject({ ok: false, reason: "weak_pin" });
    await koffiAtWork(v);
    const again = await v.t.mutation(api.operators.activate, { deviceToken: v.tablet.deviceToken, code: v.koffi.code, pin: "8642" });
    expect(again).toMatchObject({ ok: false, reason: "invalid_code" });
  });

  test("un nouveau code d'activation annule l'ancien PIN sur-le-champ", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    await v.owner.as.mutation(api.staff.issueActivationCode, { organizationId: v.organizationId, memberId: koffi.memberId });
    await expectCode(koffi.as.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
    const retry = await v.t.action(api.operators.unlock, { deviceToken: v.tablet.deviceToken, memberId: koffi.memberId, pin: "2468" });
    expect(retry).toMatchObject({ ok: false, reason: "pin_unavailable" });
  });
});

describe("les protections du PIN", () => {
  test("5 erreurs en 15 minutes verrouillent le PIN", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    const tries = [];
    for (let i = 0; i < 5; i++) tries.push(await v.t.action(api.operators.unlock, { deviceToken: v.tablet.deviceToken, memberId: koffi.memberId, pin: "0000" }));
    expect(tries.slice(0, 4).map((r) => (r.ok ? "ok" : r.reason === "wrong_pin" ? r.attemptsLeft : r.reason))).toEqual([4, 3, 2, 1]);
    expect(tries[4]).toMatchObject({ ok: false, reason: "locked" });
    // Même le bon PIN attend la fin du verrou.
    expect(await v.t.action(api.operators.unlock, { deviceToken: v.tablet.deviceToken, memberId: koffi.memberId, pin: "2468" })).toMatchObject({ ok: false, reason: "locked" });
    const roster = await v.t.query(api.operators.roster, { deviceToken: v.tablet.deviceToken });
    expect(roster.people[0]!.locked).toBe(true);
  });

  test("10 erreurs depuis la dernière réussite désactivent le PIN", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    await v.t.run(async (ctx) => {
      const c = (await ctx.db.query("staffCredentials").withIndex("by_member", (q) => q.eq("memberId", koffi.memberId)).unique())!;
      await ctx.db.patch(c._id, { failuresSinceSuccess: 9 });
    });
    expect(await v.t.action(api.operators.unlock, { deviceToken: v.tablet.deviceToken, memberId: koffi.memberId, pin: "0000" })).toMatchObject({ ok: false, reason: "pin_unavailable" });
    const credential = await v.t.run((ctx) => ctx.db.query("staffCredentials").withIndex("by_member", (q) => q.eq("memberId", koffi.memberId)).unique());
    expect([credential!.status, credential!.pinHash]).toEqual(["disabled", undefined]);
    await expectCode(koffi.as.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
  });

  test("15 erreurs en une heure sur un appareil y suspendent tous les PIN", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    await v.t.run(async (ctx) => ctx.db.patch(v.tablet.deviceId, { recentPinFailures: Array.from({ length: 14 }, () => Date.now()) }));
    await v.t.action(api.operators.unlock, { deviceToken: v.tablet.deviceToken, memberId: koffi.memberId, pin: "0000" });
    expect(await v.t.action(api.operators.unlock, { deviceToken: v.tablet.deviceToken, memberId: koffi.memberId, pin: "2468" })).toMatchObject({ ok: false, reason: "device_suspended" });
    const audit = await v.t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(audit.some((a) => a.action === "device.pin.suspended")).toBe(true);
  });

  test("le PIN n'apparaît jamais dans le journal", async () => {
    const v = await venueWithDevices();
    await koffiAtWork(v);
    await v.t.action(api.operators.unlock, { deviceToken: v.tablet.deviceToken, memberId: v.koffi.memberId, pin: "5173" });
    const everything = await v.t.run(async (ctx) => JSON.stringify([await ctx.db.query("auditLogs").collect(), await ctx.db.query("staffCredentials").collect()]));
    expect(everything).not.toContain("2468");
    expect(everything).not.toContain("5173");
  });
});

describe("l'accès se coupe au bon moment", () => {
  test("révoquer l'appareil coupe la session et oblige à rechoisir son PIN", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    const { pinsReset } = await v.owner.as.mutation(api.devices.revoke, { venueId: v.cocody, deviceId: v.tablet.deviceId });
    expect(pinsReset).toBe(1);
    await expectCode(koffi.as.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
    await expectCode(v.t.query(api.operators.roster, { deviceToken: v.tablet.deviceToken }), "UNAUTHENTICATED");
  });

  test("suspendre le membre coupe son PIN à l'appel suivant", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    await v.owner.as.mutation(api.team.setMemberStatus, { organizationId: v.organizationId, memberId: koffi.memberId, status: "suspended" });
    await expectCode(koffi.as.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
  });

  test("trois minutes sans geste sur une tablette partagée : il faut retaper son PIN", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    await v.t.run((ctx) => ctx.db.patch(koffi.sessionId, { lastActivityAt: Date.now() - 4 * 60_000 }));
    await expectCode(koffi.as.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
    expect(await v.t.action(api.operators.refresh, { deviceToken: v.tablet.deviceToken, refreshSecret: koffi.refreshSecret })).toEqual({ ok: false });
  });

  test("verrouiller l'écran ferme la session ; la personne suivante remplace la précédente", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    expect(await v.t.action(api.operators.refresh, { deviceToken: v.tablet.deviceToken, refreshSecret: koffi.refreshSecret })).toMatchObject({ ok: true });
    await v.t.mutation(api.operators.lock, { deviceToken: v.tablet.deviceToken });
    await expectCode(koffi.as.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
    const again = await unlockAs(v.t, v.tablet.deviceToken, koffi.memberId, "2468");
    const other = await pinMember(v.owner, v.organizationId, v.roleId("waiter"), [v.cocody], "Aya");
    await activateAndUnlock(v.t, v.tablet.deviceToken, other.code, "9153");
    await expectCode(again.as.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
  });
});

describe("les sortes d'appareils", () => {
  test("l'écran de cuisine agit seul, sur son poste seulement", async () => {
    const v = await venueWithDevices();
    const koffi = await koffiAtWork(v);
    const sessionId = await koffi.as.mutation(api.sessions.open, { venueId: v.cocody, tableId: v.tableId });
    const sent = await koffi.as.mutation(api.orders.submit, order(v, sessionId, "pin-envoi-000000003"));
    if (!sent.ok) throw new Error("commande refusée");
    const kds = asDevice(v.t, v.kds.deviceId);
    const board = await kds.query(api.kitchen.board, { venueId: v.cocody, stationId: v.cuisine });
    const ticketId = board.active[0]!._id;
    await kds.mutation(api.kitchen.advance, { venueId: v.cocody, ticketId, action: "ready" });
    const event = await v.t.run(async (ctx) => (await ctx.db.query("orderEvents").collect()).find((e) => e.type === "ticket_ready")!);
    expect([event.actorType, event.actorDeviceId, event.actorMemberId]).toEqual(["device", v.kds.deviceId, undefined]);
    // Un autre poste, une commande, une table : hors de ses droits.
    await expectCode(kds.query(api.kitchen.board, { venueId: v.cocody, stationId: v.bar }), "NOT_FOUND");
    await expectCode(kds.mutation(api.sessions.open, { venueId: v.cocody, tableId: v.tableId }), "FORBIDDEN");
    // Personne ne s'identifie sur un écran de cuisine, et son jeton se renouvelle sans secret.
    expect((await v.t.query(api.operators.roster, { deviceToken: v.kds.deviceToken })).people).toEqual([]);
    expect(await v.t.action(api.operators.refresh, { deviceToken: v.kds.deviceToken, refreshSecret: "" })).toMatchObject({ ok: true });
  });

  test("un téléphone personnel n'accepte que son propriétaire", async () => {
    const v = await venueWithDevices();
    const phone = await enrollDevice(v.t, v.owner, v.cocody, { deviceType: "personal", label: "Téléphone de Koffi", memberId: v.koffi.memberId });
    const koffi = await activateAndUnlock(v.t, phone.deviceToken, v.koffi.code, "2468");
    expect(koffi.name).toBe("Koffi");
    const aya = await pinMember(v.owner, v.organizationId, v.roleId("waiter"), [v.cocody], "Aya");
    expect(await v.t.mutation(api.operators.activate, { deviceToken: phone.deviceToken, code: aya.code, pin: "9153" })).toMatchObject({ ok: false, reason: "invalid_code" });
    expect((await v.t.query(api.operators.roster, { deviceToken: phone.deviceToken })).people.map((p) => p.name)).toEqual(["Koffi"]);
  });

  test("un code d'enrôlement ne sert qu'une fois, et un jeton inventé n'ouvre rien", async () => {
    const v = await venueWithDevices();
    const { code } = await v.owner.as.mutation(api.devices.createEnrollment, { venueId: v.cocody, label: "Caisse", deviceType: "shared" });
    expect((await v.t.mutation(api.devices.enroll, { code })).ok).toBe(true);
    expect(await v.t.mutation(api.devices.enroll, { code })).toEqual({ ok: false, reason: "invalid_code" });
    await expectCode(v.t.query(api.operators.roster, { deviceToken: "x".repeat(43) }), "UNAUTHENTICATED");
    // Un jeton d'opérateur qui désigne une session inexistante ne vaut rien.
    const forged = v.t.withIdentity({ issuer: OPERATOR_ISSUER, subject: "op:inexistant" });
    await expectCode(forged.query(api.sessions.floor, { venueId: v.cocody }), "UNAUTHENTICATED");
  });

  test("un membre sans compte apparaît dans l'équipe, sans adresse", async () => {
    const v = await venueWithDevices();
    const members = await v.owner.as.query(api.team.listMembers, { scope: { organizationId: v.organizationId } });
    expect(members.find((m) => m.name === "Koffi")).toMatchObject({ kind: "pin_only", email: null, userId: null, pin: "pending" });
  });
});

async function ownerMember(v: Venue): Promise<Id<"organizationMembers">> {
  return v.t.run(async (ctx) => {
    const m = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) => q.eq("organizationId", v.organizationId).eq("userId", v.owner.userId))
      .unique();
    return m!._id;
  });
}
