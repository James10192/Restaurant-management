/**
 * L'argent d'une table, sans base de données : les invariants de PAYMENTS.md §5 et §12 tiennent
 * d'abord dans des fonctions pures.
 */

import { describe, expect, test } from "vitest";
import { checkBalance, evenSplit, expectedCash, lineGross, lineTaxShare, serviceDayWindow, takeShare, type Share } from "../../convex/lib/billing";
import { serviceDayKey } from "../../convex/lib/ordering";

describe("parts d'une ligne", () => {
  test("une bouteille partagée à deux : aucune unité perdue", () => {
    const line = { quantity: 1, gross: 3001 };
    const half = takeShare(line, [], 0.5) as Share;
    expect(half).toEqual({ quantity: 0.5, amount: 1500 });
    const other = takeShare(line, [half], 0.5) as Share;
    expect(other).toEqual({ quantity: 0.5, amount: 1501 });
    expect(half.amount + other.amount).toBe(3001);
  });

  test("trois tiers d'un plat : la somme est exacte", () => {
    const line = { quantity: 1, gross: 10000 };
    const taken: Share[] = [];
    for (let i = 0; i < 3; i++) taken.push(takeShare(line, taken, 1 / 3) as Share);
    expect(taken.reduce((s, x) => s + x.amount, 0)).toBe(10000);
  });

  test("on ne prend pas plus que ce qui reste", () => {
    const line = { quantity: 2, gross: 7000 };
    const one = takeShare(line, [], 1) as Share;
    expect(one.amount).toBe(3500);
    expect(takeShare(line, [one], 1.5)).toEqual({ error: "Cette part dépasse ce qui reste de la ligne." });
    expect(takeShare(line, [], 0)).toEqual({ error: "La part doit être positive." });
  });
});

describe("solde d'une addition", () => {
  test("paiement mixte : espèces + Mobile Money soldent la table", () => {
    const b = checkBalance({
      lines: [{ amount: 35000 }],
      adjustments: [],
      payments: [
        { amount: 15000, status: "succeeded" },
        { amount: 20000, status: "succeeded" },
      ],
    });
    expect(b).toEqual({ subtotal: 35000, discounts: 0, total: 35000, paid: 35000, due: 0 });
  });

  test("un paiement annulé ne compte plus ; un remboursé compte encore (la recette baisse ailleurs)", () => {
    const b = checkBalance({
      lines: [{ amount: 5000 }, { amount: 1000 }],
      adjustments: [{ amount: 1000 }],
      payments: [
        { amount: 2000, status: "voided" },
        { amount: 3000, status: "partially_refunded" },
      ],
    });
    expect(b).toEqual({ subtotal: 6000, discounts: 1000, total: 5000, paid: 3000, due: 2000 });
  });
});

describe("partage égal", () => {
  test("le reste va sur la première part", () => {
    expect(evenSplit(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(evenSplit(1, 3)).toEqual([1, 0, 0]);
  });

  test("au pas des pièces : parts rondes, somme exacte", () => {
    const parts = evenSplit(10000, 3, 25);
    expect(parts).toEqual([3350, 3325, 3325]);
    expect(parts.reduce((s, x) => s + x, 0)).toBe(10000);
  });
});

describe("taxes de ligne", () => {
  const tva = [{ code: "TVA", label: "TVA", percent: 18, amount: 1800 }];

  test("prix TTC : la taxe est dedans ; hors taxe : elle s'ajoute au dû", () => {
    expect(lineGross({ lineTotal: 11800, taxSnapshot: tva, taxIncluded: true })).toBe(11800);
    expect(lineGross({ lineTotal: 10000, taxSnapshot: tva, taxIncluded: false })).toBe(11800);
    // Lignes d'avant T3 : lues TTC, le seul réglage qu'elles aient connu.
    expect(lineGross({ lineTotal: 11800, taxSnapshot: tva, taxIncluded: undefined })).toBe(11800);
  });

  test("la taxe d'une part suit la part", () => {
    expect(lineTaxShare({ lineTotal: 11800, taxSnapshot: tva, taxIncluded: true }, 5900)).toBe(900);
  });
});

describe("attendu de caisse", () => {
  test("fonds + espèces − monnaie rendue sur un Wave − remboursements − sorties + entrées", () => {
    const expected = expectedCash({
      openingFloat: 10000,
      payments: [
        { method: "cash", amount: 5000, changeAmount: 5000, status: "succeeded" },
        { method: "mobile_money", amount: 9500, changeAmount: 500, status: "succeeded" },
        { method: "cash", amount: 2000, status: "voided" },
        { method: "cash", amount: 3000, status: "refunded" },
      ],
      cashRefunds: [{ amount: 3000 }],
      movements: [
        { type: "payout", amount: 1500 },
        { type: "deposit", amount: 2000 },
      ],
    });
    expect(expected).toBe(10000 + 5000 - 500 + 3000 - 3000 - 1500 + 2000);
  });
});

describe("jour de service", () => {
  test("Abidjan, UTC+0 : de 4 h à 4 h", () => {
    const w = serviceDayWindow("2026-09-23", "Africa/Abidjan", 4);
    expect(w).toEqual({ from: Date.UTC(2026, 8, 23, 4), to: Date.UTC(2026, 8, 24, 4) });
  });

  test("Porto-Novo, UTC+1 : 4 h locales = 3 h UTC", () => {
    const w = serviceDayWindow("2026-09-23", "Africa/Porto-Novo", 4);
    expect(w).toEqual({ from: Date.UTC(2026, 8, 23, 3), to: Date.UTC(2026, 8, 24, 3) });
  });

  test("un maquis qui ferme à 5 h règle 6 : ses derniers encaissements restent sur la nuit", () => {
    const at = Date.UTC(2026, 8, 24, 5, 30);
    expect(serviceDayKey(at, "Africa/Abidjan")).toBe("2026-09-24");
    expect(serviceDayKey(at, "Africa/Abidjan", 6)).toBe("2026-09-23");
  });
});
