/**
 * Import CSV et duplication : ne pas tout retaper, sans contourner une seule règle.
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { parseCsv, parsePrice, rowsFromCsv } from "../../convex/lib/menuImport";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode, openOrganization } from "./setup";

describe("lecture du fichier", () => {
  test("séparateur « ; » d'un tableur français, guillemets et retours à la ligne", () => {
    const rows = parseCsv('\uFEFFsection;nom;description;prix\r\nGrillades;"Poulet ""maison""";"Riz;\nalloco";3 500 F\r\n');
    expect(rows).toEqual([
      ["section", "nom", "description", "prix"],
      ["Grillades", 'Poulet "maison"', "Riz;\nalloco", "3 500 F"],
    ]);
  });

  test("séparateur « , » reconnu quand il domine la première ligne", () => {
    expect(parseCsv("section,nom,prix\nBoissons,Bissap,500")).toEqual([
      ["section", "nom", "prix"],
      ["Boissons", "Bissap", "500"],
    ]);
  });

  test("prix écrits par un humain", () => {
    expect(parsePrice("2 500 F", "XOF")).toBe(2500);
    expect(parsePrice("2.500", "XOF")).toBe(2500);
    expect(parsePrice("2500 FCFA", "XOF")).toBe(2500);
    expect(parsePrice("2 500,00", "XOF")).toBe(2500);
    // Le franc CFA n'a pas de centimes : on refuse plutôt que d'arrondir en silence.
    expect(parsePrice("2 500,50", "XOF")).toBeNull();
    expect(parsePrice("12,50 €", "EUR")).toBe(1250);
    expect(parsePrice("1.234,5", "EUR")).toBe(123450);
    expect(parsePrice("gratuit", "XOF")).toBeNull();
    expect(parsePrice("-500", "XOF")).toBeNull();
  });

  test("les erreurs portent le numéro de ligne du tableur", () => {
    const csv = ["Section;Nom;Prix;Allergènes", "Grillades;Poulet;3500;Arachides", ";Sans section;1000;", "Boissons;Bissap;cinq cents;", "Plats;Garba;1500;Piment"].join("\n");
    const { rows, errors } = rowsFromCsv(csv, "XOF");
    expect(rows.map((r) => [r.line, r.name, r.price, r.allergens])).toEqual([[2, "Poulet", 3500, ["arachides"]]]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
    expect(errors[2]!.message).toContain("Piment");
  });

  test("une colonne obligatoire manquante est signalée d'emblée", () => {
    const { errors } = rowsFromCsv("section;nom\nPlats;Garba", "XOF");
    expect(errors).toEqual([{ line: 1, message: "Colonne « prix » introuvable sur la première ligne." }]);
  });
});

describe("import dans une carte", () => {
  test("les sections sont retrouvées par leur nom, ou créées", async () => {
    const r = await restaurantWithMenu();
    const { rows } = rowsFromCsv("section;nom;prix\ngrillades;Brochettes;2000\nDesserts;Dêguê;1000", "XOF");
    const result = await r.owner.as.mutation(api.menuImport.apply, { venueId: r.cocody, menuId: r.menuId, rows });
    expect(result).toEqual({ products: 2, sections: 2 });
    const tree = await r.owner.as.query(api.menus.editor, { venueId: r.cocody, menuId: r.menuId });
    expect(tree.sections.map((s) => [s.name, s.products.length])).toEqual([
      ["Entrées", 1],
      ["Grillades", 3],
      ["Boissons", 1],
      ["Desserts", 1],
    ]);
  });

  test("tout ou rien : une ligne refusée par le serveur annule l'import entier", async () => {
    const r = await restaurantWithMenu();
    const rows = [
      { line: 2, section: "Plats", name: "Garba", price: 1500, allergens: [], tags: [] },
      // Un aperçu contourné : le serveur rejoue les règles.
      { line: 3, section: "Plats", name: "Attiéké", price: 1500.5, allergens: [], tags: [] },
    ];
    let message = "";
    try {
      await r.owner.as.mutation(api.menuImport.apply, { venueId: r.cocody, menuId: r.menuId, rows });
    } catch (e) {
      message = JSON.stringify((e as { data?: unknown }).data);
    }
    expect(message).toContain("Ligne 3");
    const list = await r.owner.as.query(api.products.list, { venueId: r.cocody, search: "Garba" });
    expect(list).toEqual([]);
  });

  test("importer fixe des prix : sans ce droit, refusé", async () => {
    const r = await restaurantWithMenu();
    await expectCode(
      r.editor.as.mutation(api.menuImport.apply, {
        venueId: r.cocody,
        menuId: r.menuId,
        rows: [{ line: 2, section: "Plats", name: "Garba", price: 1500, allergens: [], tags: [] }],
      }),
      "FORBIDDEN",
    );
  });
});

describe("duplication depuis un autre établissement", () => {
  test("recopie la carte en brouillon, options et variantes comprises", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.products.addVariant, { venueId: r.cocody, productId: r.products.bissap, name: "50 cl", price: 800 });
    const groupId = await r.owner.as.mutation(api.modifiers.createGroup, {
      venueId: r.cocody,
      name: "Piment",
      selectionType: "single",
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
      options: [{ name: "Fort", priceDelta: 0 }],
    });
    await r.owner.as.mutation(api.products.setModifierGroups, { venueId: r.cocody, productId: r.products.poulet, modifierGroupIds: [groupId] });
    await r.owner.as.mutation(api.availability.setProduct, { venueId: r.cocody, productId: r.products.poisson, isAvailable: false });

    const sources = await r.owner.as.query(api.menuImport.sources, { venueId: r.plateau });
    expect(sources.map((s) => [s.venueName, s.menus.map((m) => m.name)])).toEqual([["Cocody", ["Carte"]]]);
    const { menuId, products } = await r.owner.as.mutation(api.menuImport.duplicateFromVenue, {
      venueId: r.plateau,
      sourceVenueId: r.cocody,
      sourceMenuId: r.menuId,
    });
    expect(products).toBe(4);
    const tree = await r.owner.as.query(api.menus.editor, { venueId: r.plateau, menuId });
    expect(tree.menu.status).toBe("draft");
    expect(tree.sections.flatMap((s) => s.products.map((p) => [p.name, p.isAvailable]))).toContainEqual(["Poisson braisé", true]);
    const groups = await r.owner.as.query(api.modifiers.list, { venueId: r.plateau });
    expect(groups.map((g) => [g.name, g.productCount])).toEqual([["Piment", 1]]);
  });

  test("jamais d'une organisation à l'autre, même pour qui appartient aux deux", async () => {
    const r = await restaurantWithMenu();
    // Awa ouvre une seconde organisation : elle est propriétaire des deux.
    const { venueId: other } = await r.owner.as.mutation(api.organizations.create, {
      name: "Autre affaire",
      countryCode: "CI",
      venue: { name: "Yopougon", venueType: "maquis" },
    });
    await expectCode(
      r.owner.as.mutation(api.menuImport.duplicateFromVenue, { venueId: other, sourceVenueId: r.cocody, sourceMenuId: r.menuId }),
      "NOT_FOUND",
    );
    const sources = await r.owner.as.query(api.menuImport.sources, { venueId: other });
    expect(sources).toEqual([]);
  });

  test("sans accès à l'établissement source, la carte est introuvable", async () => {
    const r = await restaurantWithMenu();
    const t2 = await openOrganization(r.t, "koffi@ailleurs.ci", "Ailleurs", "Marcory");
    await expectCode(
      t2.owner.as.mutation(api.menuImport.duplicateFromVenue, { venueId: t2.venueId, sourceVenueId: r.cocody, sourceMenuId: r.menuId }),
      "NOT_FOUND",
    );
  });
});
