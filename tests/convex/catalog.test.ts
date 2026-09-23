/**
 * La carte : saisie, séparation prix / contenu, portée par établissement.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { assertSelectionBounds, cleanDietary, cleanI18n, cleanTags } from "../../convex/lib/catalog";
import { imageProblem } from "../../convex/products";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode } from "./setup";

describe("règles de saisie (fonctions pures)", () => {
  test("un plat végétalien est végétarien, un piment nul n'est pas affiché", () => {
    expect(cleanDietary({ vegan: true, spicyLevel: 0 })).toEqual({ vegan: true, vegetarian: true });
  });

  test("étiquettes : sans doublon à la casse près, vides ignorées", () => {
    expect(cleanTags(["Maison", "maison ", "", "Nouveau"])).toEqual(["Maison", "Nouveau"]);
  });

  test("seule la traduction anglaise est acceptée, une traduction vide disparaît", () => {
    expect(cleanI18n({ en: { name: " Braised chicken " } })).toEqual({ en: { name: "Braised chicken" } });
    expect(cleanI18n({ en: { name: "  " } })).toBeUndefined();
    expect(() => cleanI18n({ de: { name: "Hähnchen" } })).toThrow();
  });

  test("un choix unique borne à 1 ; un choix multiple vérifie min ≤ max", () => {
    expect(assertSelectionBounds({ selectionType: "single", minSelect: 3, maxSelect: 9, isRequired: true })).toEqual({
      minSelect: 1,
      maxSelect: 1,
    });
    expect(() => assertSelectionBounds({ selectionType: "multiple", minSelect: 3, maxSelect: 2, isRequired: false })).toThrow();
  });
});

describe("saisie de la carte", () => {
  test("l'éditeur rend l'arbre dans l'ordre, avec ce que l'appelant peut faire", async () => {
    const r = await restaurantWithMenu();
    const tree = await r.owner.as.query(api.menus.editor, { venueId: r.cocody, menuId: r.menuId });
    expect(tree.sections.map((s) => s.name)).toEqual(["Entrées", "Grillades", "Boissons"]);
    expect(tree.sections[1]!.products.map((p) => p.name)).toEqual(["Poulet braisé", "Poisson braisé"]);
    expect(tree.canEditPrice).toBe(true);
    const asEditor = await r.editor.as.query(api.menus.editor, { venueId: r.cocody, menuId: r.menuId });
    expect(asEditor.canEdit).toBe(true);
    expect(asEditor.canEditPrice).toBe(false);
  });

  test("un prix est un entier en unité mineure : 2 500,5 F et -100 F sont refusés", async () => {
    const r = await restaurantWithMenu();
    const base = { venueId: r.cocody, menuSectionId: r.sections.boissons, name: "Eau" };
    await expectCode(r.owner.as.mutation(api.products.create, { ...base, basePrice: 2500.5 }), "INVALID_ARGUMENT");
    await expectCode(r.owner.as.mutation(api.products.create, { ...base, basePrice: -100 }), "INVALID_ARGUMENT");
    // Un prix nul est permis : l'eau du robinet offerte existe.
    await r.owner.as.mutation(api.products.create, { ...base, basePrice: 0 });
  });

  test("une promotion doit être inférieure au prix normal", async () => {
    const r = await restaurantWithMenu();
    await expectCode(
      r.owner.as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 3500, promoPrice: 3500 }),
      "INVALID_ARGUMENT",
    );
    await r.owner.as.mutation(api.products.setPrice, {
      venueId: r.cocody,
      productId: r.products.poulet,
      basePrice: 3500,
      promoPrice: 3000,
    });
    const p = await r.owner.as.query(api.products.get, { venueId: r.cocody, productId: r.products.poulet });
    expect(p.promoPrice).toBe(3000);
  });

  test("un allergène hors liste est refusé : un texte libre ne se filtre pas", async () => {
    const r = await restaurantWithMenu();
    await expectCode(
      r.owner.as.mutation(api.products.update, { venueId: r.cocody, productId: r.products.alloco, allergens: ["piment"] }),
      "INVALID_ARGUMENT",
    );
    await r.owner.as.mutation(api.products.update, { venueId: r.cocody, productId: r.products.alloco, allergens: ["arachides"] });
  });

  test("une seule variante par défaut", async () => {
    const r = await restaurantWithMenu();
    const small = await r.owner.as.mutation(api.products.addVariant, {
      venueId: r.cocody,
      productId: r.products.bissap,
      name: "33 cl",
      price: 500,
    });
    const large = await r.owner.as.mutation(api.products.addVariant, {
      venueId: r.cocody,
      productId: r.products.bissap,
      name: "50 cl",
      price: 800,
    });
    await r.owner.as.mutation(api.products.updateVariant, { venueId: r.cocody, variantId: large, isDefault: true });
    const p = await r.owner.as.query(api.products.get, { venueId: r.cocody, productId: r.products.bissap });
    expect(p.variants.map((x) => [x.name, x.price, x.isDefault])).toEqual([
      ["33 cl", 500, false],
      ["50 cl", 800, true],
    ]);
    await r.owner.as.mutation(api.products.removeVariant, { venueId: r.cocody, variantId: large });
    const after = await r.owner.as.query(api.products.get, { venueId: r.cocody, productId: r.products.bissap });
    expect(after.variants.map((x) => [x._id, x.isDefault])).toEqual([[small, true]]);
  });

  test("un réordonnancement doit porter sur exactement les mêmes éléments", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.products.reorder, {
      venueId: r.cocody,
      menuSectionId: r.sections.grillades,
      productIds: [r.products.poisson, r.products.poulet],
    });
    const tree = await r.owner.as.query(api.menus.editor, { venueId: r.cocody, menuId: r.menuId });
    expect(tree.sections[1]!.products.map((p) => p.name)).toEqual(["Poisson braisé", "Poulet braisé"]);
    await expectCode(
      r.owner.as.mutation(api.products.reorder, {
        venueId: r.cocody,
        menuSectionId: r.sections.grillades,
        productIds: [r.products.poisson, r.products.alloco],
      }),
      "NOT_FOUND",
    );
  });

  test("la recherche ne sort pas de l'établissement", async () => {
    const r = await restaurantWithMenu();
    const menuPlateau = await r.owner.as.mutation(api.menus.create, { venueId: r.plateau, name: "Carte" });
    const [section] = await r.owner.as.mutation(api.menus.createSections, { venueId: r.plateau, menuId: menuPlateau, names: ["Grillades"] });
    await r.owner.as.mutation(api.products.create, { venueId: r.plateau, menuSectionId: section!, name: "Poulet du Plateau", basePrice: 4000 });
    const found = await r.owner.as.query(api.products.list, { venueId: r.cocody, search: "poulet" });
    expect(found.map((p) => p.name)).toEqual(["Poulet braisé"]);
  });

  test("dupliquer copie variantes et options, et garde la copie modifiable", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.products.addVariant, { venueId: r.cocody, productId: r.products.poulet, name: "Demi", price: 2000 });
    const groupId = await r.owner.as.mutation(api.modifiers.createGroup, {
      venueId: r.cocody,
      name: "Piment",
      selectionType: "single",
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
      options: [
        { name: "Doux", priceDelta: 0 },
        { name: "Fort", priceDelta: 0 },
      ],
    });
    await r.owner.as.mutation(api.products.setModifierGroups, {
      venueId: r.cocody,
      productId: r.products.poulet,
      modifierGroupIds: [groupId],
    });
    const copy = await r.owner.as.mutation(api.products.duplicate, { venueId: r.cocody, productId: r.products.poulet });
    const p = await r.owner.as.query(api.products.get, { venueId: r.cocody, productId: copy });
    expect(p.name).toBe("Poulet braisé (copie)");
    expect(p.isActive).toBe(true);
    expect(p.variants.map((x) => x.name)).toEqual(["Demi"]);
    expect(p.modifierGroups.map((g) => g.name)).toEqual(["Piment"]);
  });
});

describe("le prix est un droit à part (menu.price.edit)", () => {
  test("un rédacteur sans droit sur les prix réorganise tout, ne fixe aucun montant", async () => {
    const r = await restaurantWithMenu();
    const as = r.editor.as;
    await as.mutation(api.products.update, { venueId: r.cocody, productId: r.products.poulet, name: "Poulet braisé maison" });
    await as.mutation(api.menus.createSections, { venueId: r.cocody, menuId: r.menuId, names: ["Desserts"] });
    await expectCode(
      as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 100 }),
      "FORBIDDEN",
    );
    // Créer un produit, c'est fixer un prix.
    await expectCode(
      as.mutation(api.products.create, { venueId: r.cocody, menuSectionId: r.sections.boissons, name: "Eau", basePrice: 300 }),
      "FORBIDDEN",
    );
    await expectCode(
      as.mutation(api.products.addVariant, { venueId: r.cocody, productId: r.products.bissap, name: "50 cl", price: 1 }),
      "FORBIDDEN",
    );
    // Un groupe d'options gratuit, oui ; un supplément payant, non.
    await as.mutation(api.modifiers.createGroup, {
      venueId: r.cocody,
      name: "Cuisson",
      selectionType: "single",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      options: [{ name: "À point", priceDelta: 0 }],
    });
    await expectCode(
      as.mutation(api.modifiers.createGroup, {
        venueId: r.cocody,
        name: "Supplément",
        selectionType: "multiple",
        minSelect: 0,
        maxSelect: 2,
        isRequired: false,
        options: [{ name: "Œuf", priceDelta: 300 }],
      }),
      "FORBIDDEN",
    );
    const p = await r.owner.as.query(api.products.get, { venueId: r.cocody, productId: r.products.poulet });
    expect(p.basePrice).toBe(3500);
  });

  test("un chef de rang ne modifie ni le contenu ni les prix", async () => {
    const r = await restaurantWithMenu();
    await expectCode(
      r.floor.as.mutation(api.products.update, { venueId: r.cocody, productId: r.products.poulet, name: "X" }),
      "FORBIDDEN",
    );
    await expectCode(
      r.floor.as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 1 }),
      "FORBIDDEN",
    );
  });

  test("un changement de prix est journalisé, avant et après", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.products.setPrice, { venueId: r.cocody, productId: r.products.poulet, basePrice: 4000 });
    const log = await r.t.run(async (ctx) =>
      (await ctx.db.query("auditLogs").collect()).filter((l) => l.action === "product.price.update"),
    );
    expect(log).toHaveLength(1);
    expect(log[0]!.before).toEqual({ basePrice: 3500, promoPrice: null });
    expect(log[0]!.after).toEqual({ basePrice: 4000, promoPrice: null });
  });
});

describe("portée : un objet d'un autre établissement est introuvable", () => {
  test("même organisation, autre établissement : NOT_FOUND, jamais FORBIDDEN", async () => {
    const r = await restaurantWithMenu();
    // Le produit est à Cocody ; on le vise en déclarant le Plateau.
    await expectCode(
      r.owner.as.mutation(api.products.setPrice, { venueId: r.plateau, productId: r.products.poulet, basePrice: 1 }),
      "NOT_FOUND",
    );
    await expectCode(r.owner.as.query(api.menus.editor, { venueId: r.plateau, menuId: r.menuId }), "NOT_FOUND");
    await expectCode(
      r.owner.as.mutation(api.products.update, {
        venueId: r.cocody,
        productId: r.products.poulet,
        relatedProductIds: [await plateauProduct(r)],
      }),
      "NOT_FOUND",
    );
  });

  test("un serveur de Cocody n'atteint pas la carte du Plateau", async () => {
    const r = await restaurantWithMenu();
    await expectCode(r.waiter.as.query(api.menus.list, { venueId: r.plateau }), "NOT_FOUND");
    await r.waiter.as.query(api.menus.list, { venueId: r.cocody });
  });
});

describe("groupes d'options", () => {
  test("un groupe utilisé ne se supprime pas, et le refus nomme les produits", async () => {
    const r = await restaurantWithMenu();
    const groupId = await r.owner.as.mutation(api.modifiers.createGroup, {
      venueId: r.cocody,
      name: "Accompagnement",
      selectionType: "single",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      options: [
        { name: "Attiéké", priceDelta: 0 },
        { name: "Alloco", priceDelta: 500 },
      ],
    });
    await r.owner.as.mutation(api.products.setModifierGroups, {
      venueId: r.cocody,
      productId: r.products.poisson,
      modifierGroupIds: [groupId],
    });
    let message = "";
    try {
      await r.owner.as.mutation(api.modifiers.deleteGroup, { venueId: r.cocody, modifierGroupId: groupId });
    } catch (e) {
      message = JSON.stringify((e as { data?: unknown }).data ?? String(e));
    }
    expect(message).toContain("Poisson braisé");
    const groups = await r.owner.as.query(api.modifiers.list, { venueId: r.cocody });
    expect(groups[0]!.productCount).toBe(1);
  });
});

describe("photos", () => {
  const jpeg = (size: number) => {
    const bytes = new Uint8Array(size);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    return new Blob([bytes]);
  };

  test("reconnue à ses premiers octets, pas au type déclaré", () => {
    expect(imageProblem(new Uint8Array([0xff, 0xd8, 0xff, 0]), 100)).toBeNull();
    expect(imageProblem(new TextEncoder().encode("RIFF....WEBPVP8 "), 100)).toBeNull();
    expect(imageProblem(new TextEncoder().encode("<html><script>"), 100)).not.toBeNull();
    expect(imageProblem(new Uint8Array([0xff, 0xd8, 0xff, 0, 0]), 4)).not.toBeNull();
  });

  test("un fichier refusé est effacé ; une photo valable est rattachée", async () => {
    const r = await restaurantWithMenu();
    const store = (blob: Blob) => r.t.run((ctx) => ctx.storage.store(blob));
    const add = (storageId: Id<"_storage">, thumbStorageId: Id<"_storage">) =>
      r.owner.as.action(api.products.addImage, {
        venueId: r.cocody,
        productId: r.products.poulet,
        storageId,
        thumbStorageId,
        width: 1200,
        height: 900,
      });

    const tooBig = await store(jpeg(700 * 1024));
    const thumb = await store(jpeg(10 * 1024));
    expect(await add(tooBig, thumb)).toMatchObject({ ok: false });
    expect(await r.t.run(async (ctx) => [await ctx.db.system.get(tooBig), await ctx.db.system.get(thumb)])).toEqual([null, null]);

    const html = await store(new Blob(["<html><script>alert(1)</script>"]));
    expect(await add(html, await store(jpeg(10 * 1024)))).toMatchObject({ ok: false });
    expect(await r.t.run((ctx) => ctx.db.system.get(html))).toBeNull();

    expect(await add(await store(jpeg(200 * 1024)), await store(jpeg(10 * 1024)))).toEqual({ ok: true });
    const p = await r.owner.as.query(api.products.get, { venueId: r.cocody, productId: r.products.poulet });
    expect(p.images).toHaveLength(1);
    expect(p.images[0]!.width).toBe(1200);
  });

  test("sans le droit d'éditer, aucun fichier n'est touché — pas même effacé", async () => {
    const r = await restaurantWithMenu();
    const photo = await r.t.run((ctx) => ctx.storage.store(jpeg(10)));
    await expectCode(
      r.waiter.as.action(api.products.addImage, {
        venueId: r.cocody,
        productId: r.products.poulet,
        storageId: photo,
        thumbStorageId: photo,
        width: 1200,
        height: 900,
      }),
      "FORBIDDEN",
    );
    expect(await r.t.run((ctx) => ctx.db.system.get(photo))).not.toBeNull();
  });
});

async function plateauProduct(r: Awaited<ReturnType<typeof restaurantWithMenu>>) {
  const menuId = await r.owner.as.mutation(api.menus.create, { venueId: r.plateau, name: "Carte" });
  const [section] = await r.owner.as.mutation(api.menus.createSections, { venueId: r.plateau, menuId, names: ["Plats"] });
  return r.owner.as.mutation(api.products.create, { venueId: r.plateau, menuSectionId: section!, name: "Garba", basePrice: 1500 });
}
