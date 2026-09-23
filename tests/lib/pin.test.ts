import { describe, expect, test } from "vitest";
import { ALL_PERMISSIONS, PIN_PERMISSIONS, permissionMeta } from "../../convex/lib/permissions";
import {
  CODE_LENGTH,
  deviceFailure,
  formatCode,
  generateCode,
  isWellFormedCode,
  memberFailure,
  normalizeCode,
  pinProblem,
  sameDigest,
} from "../../convex/lib/pin";

describe("PIN : forme et codes interdits", () => {
  test("exactement quatre chiffres", () => {
    expect(pinProblem("2468")).toBeNull();
    for (const bad of ["246", "24680", "24a8", " 2468", ""]) expect(pinProblem(bad)).toMatch(/4 chiffres/);
  });

  test("répétitions, suites, années et motifs courants refusés", () => {
    for (const weak of ["0000", "7777", "1234", "6789", "9876", "4321", "1987", "2024", "1212", "2580"]) {
      expect(pinProblem(weak), weak).toMatch(/facile/);
    }
    for (const fine of ["2468", "7391", "5173", "9153", "1357"]) expect(pinProblem(fine), fine).toBeNull();
  });
});

describe("codes à usage unique", () => {
  test("8 signes sans ambiguïté, lisibles à l'oral", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).not.toMatch(/[01IO]/);
      expect(isWellFormedCode(code)).toBe(true);
    }
  });

  test("tolère tirets, espaces et minuscules", () => {
    expect(normalizeCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(isWellFormedCode(" abcd efgh ")).toBe(true);
    expect(isWellFormedCode("ABCD-EFG0")).toBe(false);
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  test("comparaison d'empreintes", () => {
    expect(sameDigest("abc", "abc")).toBe(true);
    expect(sameDigest("abc", "abd")).toBe(false);
    expect(sameDigest("abc", "abcd")).toBe(false);
  });
});

describe("fenêtres d'échec", () => {
  const now = 1_000_000_000;

  test("cinq échecs en 15 minutes verrouillent ; les anciens sortent de la fenêtre", () => {
    const four = [now - 60_000, now - 50_000, now - 40_000, now - 30_000];
    expect(memberFailure({ recentFailures: four, failuresSinceSuccess: 4 }, now).lockedUntil).toBe(now + 15 * 60_000);
    const old = [now - 20 * 60_000, now - 19 * 60_000, now - 40_000, now - 30_000];
    const outcome = memberFailure({ recentFailures: old, failuresSinceSuccess: 4 }, now);
    expect([outcome.recentFailures.length, outcome.lockedUntil]).toEqual([3, undefined]);
  });

  test("dix échecs depuis la dernière réussite désactivent", () => {
    expect(memberFailure({ recentFailures: [], failuresSinceSuccess: 9 }, now).disabled).toBe(true);
    expect(memberFailure({ recentFailures: [], failuresSinceSuccess: 8 }, now).disabled).toBe(false);
  });

  test("quinze échecs en une heure suspendent l'appareil trente minutes", () => {
    const fourteen = Array.from({ length: 14 }, (_, i) => now - i * 60_000);
    expect(deviceFailure(fourteen, now).pinSuspendedUntil).toBe(now + 30 * 60_000);
    expect(deviceFailure(fourteen.slice(1), now).pinSuspendedUntil).toBeUndefined();
  });
});

describe("le plafond du PIN (D-060)", () => {
  test("aucune permission sensible, d'organisation, d'équipe, d'appareil, d'export ou de réglage", () => {
    for (const p of PIN_PERMISSIONS) {
      const meta = permissionMeta(p);
      expect(meta.sensitive ?? false, p).toBe(false);
      expect(meta.scope, p).toBe("venue");
      expect(p, p).not.toMatch(/^(team|permissions|device|export|audit|analytics|platform|organization)\./);
      // `check.manage` est la seule exception, et elle est nommée : partager une addition est un
      // geste de salle (T3), pas un réglage. Tout autre `.manage` reste hors du PIN.
      if (p !== "check.manage") expect(p, p).not.toMatch(/\.(manage|publish|price\.edit|settings\.service)$/);
    }
  });

  test("les gestes de service y sont", () => {
    for (const p of ["order.create", "order.serve", "kitchen.ticket.update", "table.session.open", "service_request.handle"] as const) {
      expect(PIN_PERMISSIONS.has(p)).toBe(true);
    }
    // T3 y a ajouté l'encaissement (encaisser, partager, ouvrir et compter une caisse) : le plafond
    // reste une minorité étroite du catalogue.
    for (const p of ["payment.collect", "check.manage", "cash_register.open", "cash_register.close"] as const) {
      expect(PIN_PERMISSIONS.has(p)).toBe(true);
    }
    for (const p of ["payment.refund", "payment.void", "cash_register.adjust", "order.discount.apply", "table.session.close_with_debt"] as const) {
      expect(PIN_PERMISSIONS.has(p), p).toBe(false);
    }
    expect(PIN_PERMISSIONS.size).toBeLessThan(ALL_PERMISSIONS.length * 0.4);
  });
});
