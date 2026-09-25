/**
 * Disponibilité : calculée à la lecture, dans le fuseau de l'établissement (R23).
 */

import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  inWindow,
  localTime,
  menuIsActive,
  productUnavailability,
  serviceDayEnd,
  type AvailabilityRule,
} from "../../convex/lib/availability";
import { restaurantWithMenu } from "./catalogFixtures";
import { expectCode } from "./setup";

/** Mardi 23 septembre 2026, à l'heure UTC donnée. */
const tuesday = (hour: number, minute = 0) => Date.UTC(2026, 8, 22, hour, minute);

describe("heure locale", () => {
  test("Abidjan est à UTC, Cotonou à UTC+1", () => {
    expect(localTime(tuesday(10, 30), "Africa/Abidjan")).toEqual({ dayOfWeek: 2, minute: 630 });
    expect(localTime(tuesday(10, 30), "Africa/Porto-Novo")).toEqual({ dayOfWeek: 2, minute: 690 });
    // 23 h 30 UTC un mardi = 0 h 30 mercredi à Cotonou.
    expect(localTime(tuesday(23, 30), "Africa/Porto-Novo")).toEqual({ dayOfWeek: 3, minute: 30 });
  });
});

describe("plages", () => {
  const friday22to2 = { daysOfWeek: [5], startMinute: 22 * 60, endMinute: 2 * 60 };

  test("une plage qui passe minuit appartient au jour de son début", () => {
    expect(inWindow({ dayOfWeek: 5, minute: 23 * 60 }, friday22to2)).toBe(true);
    expect(inWindow({ dayOfWeek: 6, minute: 60 }, friday22to2)).toBe(true);
    expect(inWindow({ dayOfWeek: 6, minute: 23 * 60 }, friday22to2)).toBe(false);
    expect(inWindow({ dayOfWeek: 5, minute: 60 }, friday22to2)).toBe(false);
  });

  const breakfast: AvailabilityRule = {
    ruleType: "available",
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 7 * 60,
    endMinute: 11 * 60,
  };
  const input = (over: Partial<Parameters<typeof productUnavailability>[0]> = {}) => ({
    isAvailable: true,
    productRules: [],
    sectionRules: [],
    menuRules: [],
    ...over,
  });

  test("un petit déjeuner n'est servi que dans sa plage", () => {
    expect(productUnavailability(input({ sectionRules: [breakfast] }), tuesday(8), "Africa/Abidjan")).toBeNull();
    expect(productUnavailability(input({ sectionRules: [breakfast] }), tuesday(12), "Africa/Abidjan")).toBe("schedule");
  });

  test("le fuseau décide : 10 h 30 UTC, c'est 11 h 30 à Cotonou, hors du petit déjeuner", () => {
    expect(productUnavailability(input({ productRules: [breakfast] }), tuesday(10, 30), "Africa/Abidjan")).toBeNull();
    expect(productUnavailability(input({ productRules: [breakfast] }), tuesday(10, 30), "Africa/Porto-Novo")).toBe("schedule");
  });

  test("l'interrupteur manuel l'emporte ; une rupture datée expire seule", () => {
    expect(productUnavailability(input({ isAvailable: false }), tuesday(8), "Africa/Abidjan")).toBe("manual");
    const until = tuesday(9);
    expect(productUnavailability(input({ isAvailable: false, unavailableUntil: until }), tuesday(8), "Africa/Abidjan")).toBe("until");
    expect(productUnavailability(input({ isAvailable: false, unavailableUntil: until }), tuesday(10), "Africa/Abidjan")).toBeNull();
  });

  test("une plage « indisponible » exclut, même dans une plage « disponible »", () => {
    const noLunchRush: AvailabilityRule = { ruleType: "unavailable", daysOfWeek: [2], startMinute: 8 * 60, endMinute: 9 * 60 };
    expect(productUnavailability(input({ productRules: [breakfast, noLunchRush] }), tuesday(8, 30), "Africa/Abidjan")).toBe("schedule");
  });

  test("une règle hors de sa période de validité ne compte pas", () => {
    const later = { ...breakfast, effectiveFrom: tuesday(0) + 7 * 86_400_000 };
    expect(productUnavailability(input({ productRules: [later] }), tuesday(12), "Africa/Abidjan")).toBeNull();
  });

  test("une carte à horaire n'est active que dans sa plage", () => {
    expect(menuIsActive(null, tuesday(3), "Africa/Abidjan")).toBe(true);
    expect(menuIsActive(breakfast, tuesday(3), "Africa/Abidjan")).toBe(false);
  });

  test("« ce soir » finit à 4 h du matin, heure de l'établissement", () => {
    // 20 h à Cotonou (19 h UTC) → 4 h à Cotonou = 3 h UTC le lendemain.
    expect(serviceDayEnd(tuesday(19), "Africa/Porto-Novo")).toBe(Date.UTC(2026, 8, 23, 3, 0));
    // 2 h du matin à Abidjan : le service de la nuit finit à 4 h, pas le lendemain.
    expect(serviceDayEnd(tuesday(2), "Africa/Abidjan")).toBe(tuesday(4));
  });
});

describe("bascule de service", () => {
  test("un chef de rang signale une rupture sans pouvoir toucher au reste", async () => {
    const r = await restaurantWithMenu();
    await r.floor.as.mutation(api.availability.setProduct, {
      venueId: r.cocody,
      productId: r.products.poisson,
      isAvailable: false,
      until: Date.now() + 3_600_000,
    });
    const board = await r.floor.as.query(api.availability.board, { venueId: r.cocody });
    const poisson = board.products.find((p) => p.name === "Poisson braisé")!;
    expect(poisson.isAvailable).toBe(false);
    expect(board.canEditRules).toBe(false);
    await expectCode(
      r.floor.as.mutation(api.availability.createRule, {
        venueId: r.cocody,
        targetType: "product",
        targetId: r.products.poisson,
        ruleType: "available",
        daysOfWeek: [1],
        startMinute: 600,
        endMinute: 700,
      }),
      "FORBIDDEN",
    );
    // Un serveur n'a pas la bascule.
    await expectCode(
      r.waiter.as.mutation(api.availability.setProduct, { venueId: r.cocody, productId: r.products.poulet, isAvailable: false }),
      "FORBIDDEN",
    );
  });

  test("une rupture ne passe pas par la publication : elle vaut tout de suite", async () => {
    const r = await restaurantWithMenu();
    await r.owner.as.mutation(api.publications.publish, { venueId: r.cocody, menuId: r.menuId });
    await r.owner.as.mutation(api.availability.setProduct, { venueId: r.cocody, productId: r.products.poulet, isAvailable: false });
    const pending = await r.owner.as.query(api.publications.pendingChanges, { venueId: r.cocody, menuId: r.menuId });
    expect(pending.changes).toEqual([]);
  });

  test("une échéance passée ou trop lointaine est refusée", async () => {
    const r = await restaurantWithMenu();
    const set = (until: number) =>
      r.owner.as.mutation(api.availability.setProduct, { venueId: r.cocody, productId: r.products.poulet, isAvailable: false, until });
    await expectCode(set(Date.now() - 1000), "INVALID_ARGUMENT");
    await expectCode(set(Date.now() + 40 * 86_400_000), "INVALID_ARGUMENT");
  });

  test("une plage ne vise qu'un objet de l'établissement", async () => {
    const r = await restaurantWithMenu();
    const menuPlateau = await r.owner.as.mutation(api.menus.create, { venueId: r.plateau, name: "Carte" });
    await expectCode(
      r.owner.as.mutation(api.availability.createRule, {
        venueId: r.cocody,
        targetType: "menu",
        targetId: menuPlateau,
        ruleType: "available",
        daysOfWeek: [1],
        startMinute: 600,
        endMinute: 700,
      }),
      "INVALID_ARGUMENT",
    );
    await expectCode(
      r.owner.as.mutation(api.availability.createRule, {
        venueId: r.cocody,
        targetType: "product",
        targetId: "n'importe quoi",
        ruleType: "available",
        daysOfWeek: [1],
        startMinute: 600,
        endMinute: 700,
      }),
      "INVALID_ARGUMENT",
    );
  });
});
