/**
 * Mise en service (T7.b, D-176, D-177) : la progression se lit sur les données, pas sur des cases
 * cochées à la main.
 */

import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode, openOrganization, setup } from "./setup";

const stateOf = (p: { steps: { key: string; state: string }[] } | null) =>
  Object.fromEntries((p?.steps ?? []).map((s) => [s.key, s.state]));

describe("progression dérivée", () => {
  test("une organisation neuve n'a que son identité, et la carte publiée coche deux étapes", async () => {
    const t = setup();
    const org = await openOrganization(t, "awa@maquis.ci", "Maquis Awa", "Cocody");
    const fresh = await org.owner.as.query(api.onboarding.progress, { venueId: org.venueId });
    expect(fresh).toMatchObject({ doneCount: 1, total: 7, complete: false, next: "service" });

    const menuId = await org.owner.as.mutation(api.menus.create, { venueId: org.venueId, name: "Carte" });
    const [section] = await org.owner.as.mutation(api.menus.createSections, { venueId: org.venueId, menuId, names: ["Plats"] });
    await org.owner.as.mutation(api.products.create, { venueId: org.venueId, menuSectionId: section!, name: "Alloco", basePrice: 1000 });
    await org.owner.as.mutation(api.publications.publish, { venueId: org.venueId, menuId });
    const published = await org.owner.as.query(api.onboarding.progress, { venueId: org.venueId });
    expect(stateOf(published)).toMatchObject({ identity: "done", menu: "done", publish: "done", tables: "todo", team: "todo" });
    expect(published?.doneCount).toBe(3);
  });

  test("dépublier la carte fait repasser l'étape « à faire » sans que personne le dise", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    expect(stateOf(await r.owner.as.query(api.onboarding.progress, { venueId: r.cocody })).publish).toBe("done");
    await r.t.run(async (ctx) => {
      for await (const p of ctx.db.query("menuPublications").withIndex("by_venue_current", (q) => q.eq("venueId", r.cocody))) {
        await ctx.db.patch(p._id, { isCurrent: false });
      }
    });
    expect(stateOf(await r.owner.as.query(api.onboarding.progress, { venueId: r.cocody })).publish).toBe("todo");
  });

  test("une table coche « tables » ; seul un scan client coche le QR", async () => {
    const r = await restaurantWithMenu();
    const [areaId] = await r.owner.as.mutation(api.floor.createAreas, { venueId: r.cocody, names: ["Salle"] });
    await r.owner.as.mutation(api.floor.createTable, { venueId: r.cocody, serviceAreaId: areaId!, number: "1", seats: 4, shape: "square" });
    const sheet = await r.owner.as.query(api.qr.sheet, { venueId: r.cocody });
    const before = stateOf(await r.owner.as.query(api.onboarding.progress, { venueId: r.cocody }));
    expect(before).toMatchObject({ tables: "done", qr: "todo", team: "done" });

    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const scanned = await r.t.mutation(api.guest.exchange, { token: sheet.areas[0]!.cards[0]!.token });
    expect(scanned.ok).toBe(true);
    expect(stateOf(await r.owner.as.query(api.onboarding.progress, { venueId: r.cocody })).qr).toBe("done");
    // Un autre établissement de la même organisation n'en profite pas.
    expect(stateOf(await r.owner.as.query(api.onboarding.progress, { venueId: r.plateau })).qr).toBe("todo");
  });
});

describe("ce qui ne se dérive pas", () => {
  test("les modes de service se confirment, une étape se saute puis se reprend, tout est audité", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.onboarding.confirmStep, { venueId: r.cocody, step: "service" });
    await r.owner.as.mutation(api.onboarding.skipStep, { venueId: r.cocody, step: "qr", skipped: true });
    const p = await r.owner.as.query(api.onboarding.progress, { venueId: r.cocody });
    expect(stateOf(p)).toMatchObject({ service: "done", qr: "skipped" });

    await r.owner.as.mutation(api.onboarding.skipStep, { venueId: r.cocody, step: "qr", skipped: false });
    expect(stateOf(await r.owner.as.query(api.onboarding.progress, { venueId: r.cocody })).qr).toBe("todo");

    const actions = await r.t.run(async (ctx) =>
      (
        await ctx.db
          .query("auditLogs")
          .withIndex("by_resource", (q) => q.eq("resourceType", "venueOnboarding").eq("resourceId", r.cocody))
          .collect()
      ).map((a) => a.action),
    );
    expect(actions).toEqual(["venue.onboarding.confirm", "venue.onboarding.skip", "venue.onboarding.resume"]);
  });

  test("on ne confirme pas ce que les données prouvent, et l'identité ne se saute pas", async () => {
    const r = await restaurantWithMenu();
    await expectCode(r.owner.as.mutation(api.onboarding.confirmStep, { venueId: r.cocody, step: "publish" }), "INVALID_ARGUMENT");
    await expectCode(r.owner.as.mutation(api.onboarding.skipStep, { venueId: r.cocody, step: "identity", skipped: true }), "INVALID_ARGUMENT");
  });
});

describe("permissions", () => {
  test("une étape non permise est grisée avec qui peut la faire, et ne s'écrit pas", async () => {
    const r = await restaurantWithMenu();
    const p = await r.editor.as.query(api.onboarding.progress, { venueId: r.cocody });
    const service = p?.steps.find((s) => s.key === "service");
    expect(service).toMatchObject({ allowed: false, state: "todo" });
    expect(service?.whoCan).toContain("Propriétaire Maquis Awa");
    expect(p?.steps.find((s) => s.key === "menu")).toMatchObject({ allowed: true, whoCan: [] });
    // « Continuer » ne mène jamais à une porte fermée : sa seule étape permise est faite.
    expect(p?.next).toBeNull();
    await expectCode(r.editor.as.mutation(api.onboarding.confirmStep, { venueId: r.cocody, step: "service" }), "FORBIDDEN");
  });

  test("qui ne peut faire aucune étape ne voit pas de tableau", async () => {
    const r = await restaurantWithMenu();
    expect(await r.waiter.as.query(api.onboarding.progress, { venueId: r.cocody })).toBeNull();
  });
});

describe("entonnoir (D-177)", () => {
  test("mesure les jalons et ce qui précède le premier paiement réel", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await r.owner.as.mutation(api.onboarding.requestHelp, { venueId: r.cocody });
    const rows = await r.t.query(internal.onboarding.funnel, {});
    const cocody = rows.find((row) => row.venue === "Cocody");
    expect(cocody).toMatchObject({ organization: "Maquis Awa", firstPaymentAt: null, helpRequestsBeforePayment: 1, unassistedInData: false });
    expect(cocody?.firstProductAt).not.toBeNull();
    expect(cocody?.firstPublishedAt).not.toBeNull();
    expect(rows.find((row) => row.venue === "Plateau")?.firstPublishedAt).toBeNull();
  });
});
