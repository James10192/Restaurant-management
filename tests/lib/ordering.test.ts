import { describe, expect, test } from "vitest";
import {
  deriveOrderStatus,
  itemStatusForTicket,
  lineTax,
  nextTicketStatus,
  orderReference,
  orderTotals,
  serviceDayKey,
  stationCode,
  type TicketAction,
  type TicketStatus,
} from "../../convex/lib/ordering";

const STATUSES: TicketStatus[] = ["held", "queued", "started", "ready", "recalled", "served", "cancelled"];
const ACTIONS: TicketAction[] = ["fire", "start", "ready", "recall", "serve", "cancel"];

describe("bons : transitions", () => {
  test("la table complète des transitions permises", () => {
    const allowed: string[] = [];
    for (const s of STATUSES) for (const a of ACTIONS) {
      const next = nextTicketStatus(s, a);
      if (next) allowed.push(`${s} -${a}-> ${next}`);
    }
    expect(allowed).toEqual([
      "held -fire-> queued",
      "held -cancel-> cancelled",
      "queued -start-> started",
      "queued -ready-> ready",
      "queued -cancel-> cancelled",
      "started -ready-> ready",
      "started -cancel-> cancelled",
      "ready -recall-> recalled",
      "ready -serve-> served",
      "recalled -start-> started",
      "recalled -ready-> ready",
      "recalled -cancel-> cancelled",
    ]);
  });

  test("servi et annulé sont terminaux", () => {
    for (const a of ACTIONS) {
      expect(nextTicketStatus("served", a)).toBeNull();
      expect(nextTicketStatus("cancelled", a)).toBeNull();
    }
  });

  test("un plat prêt ne s'annule plus : il se rappelle ou se sert", () => {
    expect(nextTicketStatus("ready", "cancel")).toBeNull();
  });

  test("l'état d'une ligne suit son bon", () => {
    expect(STATUSES.map(itemStatusForTicket)).toEqual(["ordered", "ordered", "preparing", "ready", "preparing", "served", "cancelled"]);
  });
});

describe("commande : état dérivé des lignes (R12)", () => {
  test("progression normale", () => {
    expect(deriveOrderStatus("accepted", ["ordered", "ordered"])).toBe("accepted");
    expect(deriveOrderStatus("accepted", ["preparing", "ordered"])).toBe("in_preparation");
    expect(deriveOrderStatus("in_preparation", ["ready", "preparing"])).toBe("partially_ready");
    expect(deriveOrderStatus("partially_ready", ["ready", "ready"])).toBe("ready");
    expect(deriveOrderStatus("ready", ["served", "ready"])).toBe("partially_served");
    expect(deriveOrderStatus("partially_served", ["served", "served"])).toBe("served");
  });

  test("les lignes annulées ne comptent pas ; toutes annulées, la commande l'est", () => {
    expect(deriveOrderStatus("in_preparation", ["cancelled", "ready"])).toBe("ready");
    expect(deriveOrderStatus("accepted", ["cancelled", "cancelled"])).toBe("cancelled");
  });

  test("une commande pas encore acceptée ne se dérive pas", () => {
    for (const s of ["draft", "submitted", "pending_payment", "pending_acceptance", "rejected", "closed"] as const) {
      expect(deriveOrderStatus(s, ["ready"])).toBe(s);
    }
  });
});

describe("taxes et totaux", () => {
  const tva = [{ code: "TVA", label: "TVA", percent: 18 }];

  test("prix TTC : la taxe est extraite, le total ne bouge pas", () => {
    const tax = lineTax(11800, tva, true);
    expect(tax).toEqual([{ code: "TVA", label: "TVA", percent: 18, amount: 1800 }]);
    expect(orderTotals([{ lineTotal: 11800, tax }], true)).toEqual({ subtotal: 11800, discounts: 0, tax: 1800, serviceCharge: 0, total: 11800 });
  });

  test("prix HT : la taxe s'ajoute", () => {
    const tax = lineTax(10000, tva, false);
    expect(tax[0]!.amount).toBe(1800);
    expect(orderTotals([{ lineTotal: 10000, tax }], false).total).toBe(11800);
  });

  test("montants entiers, arrondis à l'unité", () => {
    expect(lineTax(1000, tva, true)[0]!.amount).toBe(153); // 152,54…
    expect(Number.isInteger(lineTax(333, tva, false)[0]!.amount)).toBe(true);
  });

  test("sans taxe applicable, rien", () => {
    expect(lineTax(5000, [], true)).toEqual([]);
  });
});

describe("références dites à voix haute", () => {
  test("« A-042 »", () => {
    expect(orderReference(42)).toBe("A-042");
    expect(orderReference(1234)).toBe("A-1234");
  });

  test("code de poste : trois lettres sans accent", () => {
    expect(stationCode("Cuisine")).toBe("CUI");
    expect(stationCode("Pâtisserie")).toBe("PAT");
    expect(stationCode("Bar")).toBe("BAR");
    expect(stationCode("2e étage")).toBe("EET");
    expect(stationCode("123")).toBe("POS");
  });

  test("le jour de service se termine à 4 h du matin, heure locale", () => {
    // Abidjan (UTC+0) : 2 h du matin le 24 appartient encore au 23.
    expect(serviceDayKey(Date.UTC(2026, 8, 24, 2, 0), "Africa/Abidjan")).toBe("2026-09-23");
    expect(serviceDayKey(Date.UTC(2026, 8, 24, 4, 30), "Africa/Abidjan")).toBe("2026-09-24");
    // Porto-Novo (UTC+1) : 3 h 30 locales le 24 → encore le 23.
    expect(serviceDayKey(Date.UTC(2026, 8, 24, 2, 30), "Africa/Porto-Novo")).toBe("2026-09-23");
  });
});
