import { describe, expect, test } from "vitest";
import { dateIn, endOfDayIn } from "../../src/lib/zoned";

describe("dates dans le fuseau de l'établissement", () => {
  test("fin de journée à Abidjan (UTC+0) et à Paris (heure d'été)", () => {
    expect(new Date(endOfDayIn("2026-09-30", "Africa/Abidjan")).toISOString()).toBe("2026-09-30T23:59:59.000Z");
    expect(new Date(endOfDayIn("2026-09-30", "Europe/Paris")).toISOString()).toBe("2026-09-30T21:59:59.000Z");
    expect(new Date(endOfDayIn("2026-12-30", "Europe/Paris")).toISOString()).toBe("2026-12-30T22:59:59.000Z");
  });

  test("aller-retour", () => {
    expect(dateIn(endOfDayIn("2026-02-28", "Africa/Lagos"), "Africa/Lagos")).toBe("2026-02-28");
  });
});
