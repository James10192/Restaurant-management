/**
 * Salle, QR et entrée du client : le jeton ouvre une table, jamais plus.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { cleanTableNumber } from "../../convex/floor";
import { guestPassExpiry, signGuestPass, verifyGuestPass } from "../../convex/lib/guestPass";
import { indexabilityChecks, isIndexable } from "../../convex/lib/indexability";
import { restaurantWithMenu, type Restaurant } from "./catalogFixtures";
import { expectCode } from "./setup";

async function withTables(r: Restaurant) {
  const [salle] = await r.owner.as.mutation(api.floor.createAreas, { venueId: r.cocody, names: ["Salle"] });
  await r.owner.as.mutation(api.floor.createTableRange, {
    venueId: r.cocody,
    serviceAreaId: salle!,
    from: 1,
    to: 4,
    seats: 4,
    shape: "square",
  });
  const sheet = await r.owner.as.query(api.qr.sheet, { venueId: r.cocody });
  const card = (n: string) => sheet.areas[0]!.cards.find((c) => c.number === n)!;
  return { salle: salle!, sheet, card };
}

async function scan(r: Restaurant, token: string) {
  return r.t.mutation(api.guest.exchange, { token });
}

describe("tables", () => {
  test("numéros : courts, en majuscules, uniques dans l'établissement", async () => {
    expect(cleanTableNumber(" t3 ")).toBe("T3");
    expect(() => cleanTableNumber("table numéro 3")).toThrow();
    const r = await restaurantWithMenu();
    const { salle } = await withTables(r);
    await expectCode(
      r.owner.as.mutation(api.floor.createTable, { venueId: r.cocody, serviceAreaId: salle, number: "2", seats: 2, shape: "round" }),
      "CONFLICT",
    );
    // Rangée « tout ou rien » : 3 à 6 chevauche 3 et 4, rien n'est créé.
    await expectCode(
      r.owner.as.mutation(api.floor.createTableRange, { venueId: r.cocody, serviceAreaId: salle, from: 3, to: 6, seats: 2, shape: "round" }),
      "CONFLICT",
    );
    const plan = await r.owner.as.query(api.floor.overview, { venueId: r.cocody });
    expect(plan.areas[0]!.tables.map((t) => t.number)).toEqual(["1", "2", "3", "4"]);
  });

  test("une table naît avec son QR, et le plan ne montre jamais le jeton", async () => {
    const r = await restaurantWithMenu();
    const { sheet } = await withTables(r);
    expect(sheet.areas[0]!.cards).toHaveLength(4);
    expect(sheet.areas[0]!.cards[0]!.token).toHaveLength(22);
    const plan = await r.owner.as.query(api.floor.overview, { venueId: r.cocody });
    expect(JSON.stringify(plan)).not.toContain(sheet.areas[0]!.cards[0]!.token);
    expect(plan.areas[0]!.tables[0]!.qr?.version).toBe(1);
  });

  test("une zone qui porte des tables ne se supprime pas", async () => {
    const r = await restaurantWithMenu();
    const { salle } = await withTables(r);
    await expectCode(r.owner.as.mutation(api.floor.deleteArea, { venueId: r.cocody, serviceAreaId: salle }), "CONFLICT");
  });

  test("une disposition qui sort du plan est refusée", async () => {
    const r = await restaurantWithMenu();
    const { salle } = await withTables(r);
    const plan = await r.owner.as.query(api.floor.overview, { venueId: r.cocody });
    const t1 = plan.areas[0]!.tables[0]!;
    await expectCode(
      r.owner.as.mutation(api.floor.saveLayout, {
        venueId: r.cocody,
        serviceAreaId: salle,
        tables: [{ tableId: t1._id, x: 990, y: 10, width: 80, height: 80, rotation: 0 }],
      }),
      "INVALID_ARGUMENT",
    );
    await r.owner.as.mutation(api.floor.saveLayout, {
      venueId: r.cocody,
      serviceAreaId: salle,
      tables: [{ tableId: t1._id, x: 500.4, y: 300, width: 120, height: 80, rotation: -90 }],
    });
    const after = await r.owner.as.query(api.floor.overview, { venueId: r.cocody });
    expect(after.areas[0]!.tables[0]).toMatchObject({ x: 500, width: 120, rotation: 270 });
  });

  test("un serveur voit le plan, ne le modifie pas, n'imprime pas les QR", async () => {
    const r = await restaurantWithMenu();
    const { salle } = await withTables(r);
    const plan = await r.waiter.as.query(api.floor.overview, { venueId: r.cocody });
    expect(plan.canManage).toBe(false);
    await expectCode(r.waiter.as.query(api.qr.sheet, { venueId: r.cocody }), "FORBIDDEN");
    await expectCode(
      r.waiter.as.mutation(api.floor.createTable, { venueId: r.cocody, serviceAreaId: salle, number: "9", seats: 2, shape: "round" }),
      "FORBIDDEN",
    );
  });
});

describe("laissez-passer", () => {
  test("signé, il se vérifie ; altéré ou expiré, il ne vaut rien", async () => {
    const now = Date.now();
    const pass = await signGuestPass({
      venueId: "v" as never,
      tableId: "t" as never,
      qrCodeId: "q" as never,
      qrVersion: 1,
      expiresAt: now + 1000,
    });
    expect(await verifyGuestPass(pass, now)).toMatchObject({ qrVersion: 1 });
    expect(await verifyGuestPass(pass, now + 2000)).toBeNull();
    // Le serveur web lit l'échéance sans secret ; un texte quelconque n'en a pas.
    expect(guestPassExpiry(pass)).toBe(now + 1000);
    expect(guestPassExpiry("gp1.pas-du-json.x")).toBeNull();
    const [prefix, body, signature] = pass.split(".");
    const forged = btoa(JSON.stringify({ v: "v", t: "t", q: "q", n: 1, e: now + 1e9 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyGuestPass(`${prefix}.${forged}.${signature}`, now)).toBeNull();
    expect(await verifyGuestPass(`${prefix}.${body}.${signature!.slice(0, -2)}AA`, now)).toBeNull();
    expect(await verifyGuestPass("n'importe quoi", now)).toBeNull();
  });
});

describe("scan d'un QR", () => {
  test("un jeton valide donne la carte publiée de SA table, jamais le brouillon", async () => {
    const r = await restaurantWithMenu();
    const { card } = await withTables(r);
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await r.owner.as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 9999 });

    const result = await scan(r, card("3").token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const menu = await r.t.query(api.guest.tableMenu, { pass: result.pass, venueSlug: result.venueSlug });
    expect(menu?.table.number).toBe("3");
    const poulet = menu!.menus[0]!.sections[1]!.products[0]!;
    expect([poulet.name, poulet.basePrice]).toEqual(["Poulet braisé", 3500]);
  });

  test("le scan est compté, sans rien changer pour le client", async () => {
    const r = await restaurantWithMenu();
    const { card } = await withTables(r);
    await scan(r, card("1").token);
    await scan(r, card("1").token);
    const plan = await r.owner.as.query(api.floor.overview, { venueId: r.cocody });
    expect(plan.areas[0]!.tables.find((t) => t.number === "1")!.qr?.scanCount).toBe(2);
  });

  test("révoquer un QR ferme la carte aux clients qu'il avait fait entrer", async () => {
    const r = await restaurantWithMenu();
    const { card } = await withTables(r);
    const result = await scan(r, card("2").token);
    if (!result.ok) throw new Error("scan refusé");
    const tableId = card("2").tableId;
    await r.owner.as.mutation(api.qr.rotate, { venueId: r.cocody, tableId });
    expect(await r.t.query(api.guest.tableMenu, { pass: result.pass, venueSlug: result.venueSlug })).toBeNull();
    // L'ancien jeton ne vaut plus rien, mais renvoie vers la carte publique.
    expect(await scan(r, card("2").token)).toEqual({ ok: false, reason: "invalid", venueSlug: "cocody" });
    const sheet = await r.owner.as.query(api.qr.sheet, { venueId: r.cocody });
    const fresh = sheet.areas[0]!.cards.find((c) => c.number === "2")!;
    expect(fresh.version).toBe(2);
    expect((await scan(r, fresh.token)).ok).toBe(true);
  });

  test("une table hors service ou retirée n'ouvre rien", async () => {
    const r = await restaurantWithMenu();
    const { card } = await withTables(r);
    await r.owner.as.mutation(api.floor.updateTable, { venueId: r.cocody, tableId: card("1").tableId, inService: false });
    expect(await scan(r, card("1").token)).toEqual({ ok: false, reason: "table_closed", venueSlug: "cocody" });
    await r.owner.as.mutation(api.floor.removeTable, { venueId: r.cocody, tableId: card("4").tableId });
    expect(await scan(r, card("4").token)).toEqual({ ok: false, reason: "invalid", venueSlug: "cocody" });
  });

  test("un jeton inconnu ne dit rien de personne", async () => {
    const r = await restaurantWithMenu();
    expect(await scan(r, "AAAAAAAAAAAAAAAAAAAAAA")).toEqual({ ok: false, reason: "invalid", venueSlug: null });
  });

  test("un laissez-passer ne s'utilise pas sous l'adresse d'un autre établissement", async () => {
    const r = await restaurantWithMenu();
    const { card } = await withTables(r);
    const result = await scan(r, card("1").token);
    if (!result.ok) throw new Error("scan refusé");
    expect(await r.t.query(api.guest.tableMenu, { pass: result.pass, venueSlug: "plateau" })).toBeNull();
  });
});

describe("carte publique", () => {
  test("introuvable sans consentement, visible avec", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    expect(await r.t.query(api.guest.publicMenu, { venueSlug: "cocody" })).toBeNull();
    await r.t.run((ctx) => ctx.db.patch(r.cocody, { publicMenuEnabled: true }));
    const page = await r.t.query(api.guest.publicMenu, { venueSlug: "cocody" });
    expect(page?.menus[0]!.sections.map((s) => s.name)).toEqual(["Entrées", "Grillades", "Boissons"]);
  });

  test("la disponibilité en direct ne contient ni nom ni prix", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.availability.setProduct, { venueId: r.cocody, productId: r.products.poisson, isAvailable: false });
    const live = await r.t.query(api.guest.availability, { venueId: r.cocody });
    expect(Object.keys(live!.products)).toEqual([r.products.poisson]);
    expect(JSON.stringify(live)).not.toContain("Poisson");
  });
});

describe("porte de qualité du menu public", () => {
  const good = {
    publicMenuEnabled: true,
    productCount: 12,
    describedCount: 7,
    hasAddress: true,
    hasOpeningHours: true,
    descriptionLength: 140,
    lastPublishedAt: Date.UTC(2026, 8, 1),
  };
  const now = Date.UTC(2026, 8, 23);

  test("une page complète est indexable", () => {
    expect(isIndexable(good, now)).toBe(true);
  });

  test("chaque manque est nommé, pour que le restaurateur sache quoi faire", () => {
    const checks = indexabilityChecks({ ...good, productCount: 5, describedCount: 1, hasOpeningHours: false }, now);
    expect(checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(["products", "described", "hours"]);
    expect(isIndexable({ ...good, lastPublishedAt: Date.UTC(2026, 0, 1) }, now)).toBe(false);
    expect(isIndexable({ ...good, publicMenuEnabled: false }, now)).toBe(false);
  });

  test("le consentement se donne dans les réglages, et le plan du site ne liste que les consentants", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    expect(await r.t.query(api.guest.sitemap, {})).toEqual([]);
    await r.owner.as.mutation(api.venues.update, {
      venueId: r.cocody,
      publicMenuEnabled: true,
      openingHours: [{ dayOfWeek: 5, opensAtMinute: 18 * 60, closesAtMinute: 2 * 60 }],
    });
    const sitemap = await r.t.query(api.guest.sitemap, {});
    expect(sitemap.map((e) => [e.slug, e.facts.productCount, e.facts.describedCount, e.facts.hasOpeningHours])).toEqual([
      ["cocody", 4, 2, true],
    ]);
    const readiness = await r.owner.as.query(api.venues.publicMenuReadiness, { venueId: r.cocody });
    expect(readiness.facts.publicMenuEnabled).toBe(true);
    // Le consentement est journalisé : c'est une décision de publier sur le web.
    const logged = await r.t.run(async (ctx) =>
      (await ctx.db.query("auditLogs").collect()).some((l) => l.action === "venue.update" && JSON.stringify(l.after).includes("publicMenuEnabled")),
    );
    expect(logged).toBe(true);
  });

  test("des horaires incohérents sont refusés", async () => {
    const r = await restaurantWithMenu();
    await expectCode(
      r.owner.as.mutation(api.venues.update, { venueId: r.cocody, openingHours: [{ dayOfWeek: 7, opensAtMinute: 600, closesAtMinute: 700 }] }),
      "INVALID_ARGUMENT",
    );
  });
});
