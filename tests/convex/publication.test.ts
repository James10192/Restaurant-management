/**
 * Publication : le client voit une version figée, jamais le brouillon (R22).
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { diffSnapshots, type MenuSnapshot } from "../../convex/lib/menuSnapshot";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode, inviteAndJoin } from "./setup";

describe("écart entre brouillon et carte en ligne", () => {
  const base: MenuSnapshot = {
    schema: 1,
    menu: { id: "m", name: "Carte", sortOrder: 0, activeSchedule: null },
    currency: "XOF",
    sections: [
      {
        id: "s1",
        name: "Grillades",
        products: ["a", "b", "c"].map((id) => ({
          id,
          name: id.toUpperCase(),
          slug: id,
          basePrice: 1000,
          images: [],
          tags: [],
          allergens: [],
          dietary: {},
          relatedProductIds: [],
          variants: [],
          modifierGroups: [],
        })),
      },
    ],
  };
  const clone = (): MenuSnapshot => structuredClone(base);

  test("aucune différence, aucune ligne", () => {
    expect(diffSnapshots(base, clone())).toEqual([]);
  });

  test("un plat ajouté en tête ne fait pas « bouger » les suivants", () => {
    const next = clone();
    next.sections[0]!.products.unshift({ ...next.sections[0]!.products[0]!, id: "z", name: "Z", slug: "z" });
    expect(diffSnapshots(base, next)).toEqual([{ kind: "added", entity: "product", name: "Z", fields: [] }]);
  });

  test("un prix changé est nommé « prix »", () => {
    const next = clone();
    next.sections[0]!.products[1]!.basePrice = 1500;
    expect(diffSnapshots(base, next)).toEqual([{ kind: "changed", entity: "product", name: "B", fields: ["prix"] }]);
  });

  test("un échange de place est signalé", () => {
    const next = clone();
    const [a, b, c] = next.sections[0]!.products as [never, never, never];
    next.sections[0]!.products = [b, a, c];
    expect(diffSnapshots(base, next).map((c) => [c.kind, c.name])).toEqual([
      ["moved", "B"],
      ["moved", "A"],
    ]);
  });
});

describe("publier", () => {
  test("le brouillon n'est pas en ligne tant qu'il n'est pas publié", async () => {
    const r = await restaurantWithMenu();
    const before = await r.owner.as.query(api.publications.pendingChanges, { venueId: r.cocody, menuId: r.menuId });
    expect(before.isPublished).toBe(false);
    const { version, changed } = await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    expect([version, changed]).toEqual([1, true]);
    const after = await r.owner.as.query(api.publications.pendingChanges, { venueId: r.cocody, menuId: r.menuId });
    expect(after.changes).toEqual([]);

    await r.owner.as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 4000 });
    const pending = await r.owner.as.query(api.publications.pendingChanges, { venueId: r.cocody, menuId: r.menuId });
    expect(pending.changes).toEqual([{ kind: "changed", entity: "product", name: "Poulet braisé", fields: ["prix"] }]);

    // Ce qui est en ligne n'a pas bougé : la version 1 porte toujours 3 500.
    const online = await r.t.run(async (ctx) => (await ctx.db.query("menuPublications").collect()).find((p) => p.isCurrent)!);
    const snapshot = online.snapshot as MenuSnapshot;
    expect(snapshot.sections[1]!.products[0]!.basePrice).toBe(3500);
  });

  test("publier sans changement ne crée pas de version vide", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const again = await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    expect(again).toEqual({ version: 1, changed: false });
  });

  test("une carte vide ne se publie pas", async () => {
    const r = await restaurantWithMenu();
    const empty = await r.owner.as.mutation(api.menus.create, { venueId: r.cocody, name: "Soir" });
    await expectCode(r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: empty }), "INVALID_ARGUMENT");
  });

  test("un produit archivé disparaît de la version suivante", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.products.setActive, { venueId: r.cocody, productId: r.products.poisson, isActive: false });
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const online = await r.t.run(async (ctx) => (await ctx.db.query("menuPublications").collect())[0]!);
    const names = (online.snapshot as MenuSnapshot).sections.flatMap((s) => s.products.map((p) => p.name));
    expect(names).not.toContain("Poisson braisé");
  });

  test("seul le droit de publier publie, et retirer une carte en ligne est une publication", async () => {
    const r = await restaurantWithMenu();
    await expectCode(r.editor.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId }), "FORBIDDEN");
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await expectCode(r.editor.as.mutation(api.menus.archive, { venueId: r.cocody, menuId: r.menuId }), "INVALID_ARGUMENT");
    await r.owner.as.mutation(api.menus.archive, { venueId: r.cocody, menuId: r.menuId });
    const current = await r.t.run(async (ctx) => (await ctx.db.query("menuPublications").collect()).filter((p) => p.isCurrent));
    expect(current).toEqual([]);
  });
});

describe("historique et retour arrière", () => {
  test("revenir à une version crée une nouvelle version, sans toucher au brouillon", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await r.owner.as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 9000 });
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const history = await r.owner.as.query(api.publications.history, { venueId: r.cocody, menuId: r.menuId });
    expect(history.map((h) => [h.version, h.isCurrent])).toEqual([
      [2, true],
      [1, false],
    ]);
    const { version } = await r.owner.as.mutation(api.publications.rollback, {
      venueId: r.cocody,
      menuId: r.menuId,
      publicationId: history[1]!._id,
    });
    expect(version).toBe(3);
    const online = await r.t.run(async (ctx) => (await ctx.db.query("menuPublications").collect()).find((p) => p.isCurrent)!);
    expect((online.snapshot as MenuSnapshot).sections[1]!.products[0]!.basePrice).toBe(3500);
    // Le brouillon garde 9 000 : l'écart le montre.
    const pending = await r.owner.as.query(api.publications.pendingChanges, { venueId: r.cocody, menuId: r.menuId });
    expect(pending.changes.map((c) => c.fields)).toEqual([["prix"]]);
  });

  test("remettre d'anciens prix en ligne exige le droit sur les prix", async () => {
    const r = await restaurantWithMenu();
    const roleId = await r.owner.as.mutation(api.roles.create, {
      organizationId: r.organizationId,
      label: "Publie sans toucher aux prix",
      permissions: ["venue.read", "menu.read", "menu.publish"],
    });
    const publisher = await inviteAndJoin(r.t, r.owner, { organizationId: r.organizationId, roleId, venueIds: [r.cocody] }, { email: "publie@maquis.ci" });
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await r.owner.as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 9000 });
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const history = await r.owner.as.query(api.publications.history, { venueId: r.cocody, menuId: r.menuId });
    await expectCode(
      publisher.as.mutation(api.publications.rollback, { venueId: r.cocody, menuId: r.menuId, publicationId: history[1]!._id }),
      "FORBIDDEN",
    );
    // Une version aux mêmes prix, elle, se remet en ligne : seul le nom a changé.
    await r.owner.as.mutation(api.products.update, { venueId: r.cocody, productId: r.products.bissap, name: "Bissap maison" });
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const again = await r.owner.as.query(api.publications.history, { venueId: r.cocody, menuId: r.menuId });
    const { version } = await publisher.as.mutation(api.publications.rollback, { venueId: r.cocody, menuId: r.menuId, publicationId: again[1]!._id });
    expect(version).toBe(4);
  });

  test("on ne remet pas en ligne la version d'une autre carte", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    const soir = await r.owner.as.mutation(api.menus.create, { venueId: r.cocody, name: "Soir" });
    const [section] = await r.owner.as.mutation(api.menus.createSections, { venueId: r.cocody, menuId: soir, names: ["Plats"] });
    await r.owner.as.mutation(api.products.create, { venueId: r.cocody, menuSectionId: section!, name: "Garba", basePrice: 1500 });
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: soir });
    const [carte] = await r.owner.as.query(api.publications.history, { venueId: r.cocody, menuId: r.menuId });
    await expectCode(
      r.owner.as.mutation(api.publications.rollback, { venueId: r.cocody, menuId: soir, publicationId: carte!._id }),
      "INVALID_ARGUMENT",
    );
  });
});
