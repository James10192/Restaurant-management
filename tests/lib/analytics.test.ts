import { describe, expect, test } from "vitest";
import {
  BUCKET_MS,
  comparableValue,
  dayCount,
  delaySummary,
  histogramOf,
  isComparablePeriod,
  isTicketLate,
  mergeHistograms,
  passTime,
  prepTime,
  readyWithoutStart,
  requestResponseTime,
  acceptanceTime,
  sameWeekdaysBefore,
  shiftDay,
  slotOf,
  SLOTS,
  sumUntil,
  waitBeforeStart,
  weekdayOf,
} from "../../convex/lib/analytics";

const MIN = 60_000;
const mid = (ms: number) => Math.floor(ms / BUCKET_MS) * BUCKET_MS + BUCKET_MS / 2;

describe("histogrammes", () => {
  test("la médiane d'une période est exacte : les cases s'additionnent, les médianes non", () => {
    const monday = histogramOf([2 * MIN, 3 * MIN, 30 * MIN]);
    const tuesday = histogramOf([4 * MIN, 5 * MIN]);
    // Médiane des médianes : 3 et 4,5 → faux. Médiane des cinq délais : 4 min.
    expect(delaySummary(mergeHistograms([monday, tuesday]))).toEqual({ median: mid(4 * MIN), p90: mid(30 * MIN), count: 5 });
  });

  test("aucune mesure : pas de médiane, un effectif nul ; les valeurs aberrantes tombent dans la dernière case", () => {
    expect(delaySummary([])).toEqual({ median: null, p90: null, count: 0 });
    expect(histogramOf([-5, Number.NaN, 48 * 3_600_000])).toEqual([{ b: 1200, n: 1 }]);
  });
});

describe("les délais et leurs exclusions (D-143)", () => {
  const t0 = 1_000_000;
  test("un bon démarré puis prêt puis servi", () => {
    const t = { queuedAt: t0, startedAt: t0 + 2 * MIN, readyAt: t0 + 12 * MIN, servedAt: t0 + 15 * MIN };
    expect([waitBeforeStart(t), prepTime(t), passTime(t), readyWithoutStart(t)]).toEqual([2 * MIN, 10 * MIN, 3 * MIN, false]);
  });
  test("marqué prêt sans démarrage : ni attente ni préparation, mais la passe compte", () => {
    const t = { queuedAt: t0, startedAt: t0 + 9 * MIN, readyAt: t0 + 9 * MIN, servedAt: t0 + 10 * MIN };
    expect([readyWithoutStart(t), waitBeforeStart(t), prepTime(t), passTime(t)]).toEqual([true, null, null, MIN]);
  });
  test("l'acceptation ne se mesure que sur les commandes du client validées par un serveur", () => {
    expect(acceptanceTime({ channel: "staff", acceptedAt: t0, submittedAt: t0 })).toBeNull();
    expect(acceptanceTime({ channel: "guest", acceptedAt: undefined, submittedAt: t0 })).toBeNull();
    expect(acceptanceTime({ channel: "guest", acceptedAt: t0 + 40_000, submittedAt: t0 })).toBe(40_000);
  });
  test("une demande : « J'y vais », sinon « Fait » ; annulée, rien", () => {
    expect(requestResponseTime({ status: "resolved", createdAt: t0, acknowledgedAt: t0 + MIN, resolvedAt: t0 + 5 * MIN })).toBe(MIN);
    expect(requestResponseTime({ status: "resolved", createdAt: t0, resolvedAt: t0 + 2 * MIN })).toBe(2 * MIN);
    expect(requestResponseTime({ status: "cancelled", createdAt: t0, resolvedAt: t0 + MIN })).toBeNull();
  });
  test("le retard se juge avec le seuil du poste, depuis l'envoi en cuisine", () => {
    expect(isTicketLate({ queuedAt: t0 }, { lateThresholdMinutes: 10 }, t0 + 10 * MIN)).toBe(false);
    expect(isTicketLate({ queuedAt: t0 }, { lateThresholdMinutes: 10 }, t0 + 10 * MIN + 1)).toBe(true);
    expect(isTicketLate({ queuedAt: null }, { lateThresholdMinutes: 10 }, t0 + 99 * MIN)).toBe(false);
  });
});

describe("jours et créneaux", () => {
  test("dates de service, sans fuseau", () => {
    expect([shiftDay("2026-03-01", -1), shiftDay("2026-12-31", 1), weekdayOf("2026-09-21"), dayCount("2026-09-01", "2026-09-30")]).toEqual(["2026-02-28", "2027-01-01", 1, 30]);
    expect(sameWeekdaysBefore("2026-09-28", 3)).toEqual(["2026-09-21", "2026-09-14", "2026-09-07"]);
  });
  test("un créneau part du début du jour de service ; le jour du changement d'heure tient dans le dernier", () => {
    const from = 1_000_000;
    expect([slotOf(from, from), slotOf(from + 30 * MIN, from), slotOf(from + 25 * 3_600_000, from)]).toEqual([0, 1, SLOTS - 1]);
    expect(sumUntil([1, 2, 3, 4], 1)).toBe(3);
  });
  test("comparer : 3 jours ouverts au moins, les 4 plus récents, jours fermés écartés", () => {
    expect(comparableValue([{ orders: 5, value: 10 }, { orders: 0, value: 0 }, { orders: 3, value: 20 }])).toBeNull();
    expect(comparableValue([{ orders: 5, value: 10 }, { orders: 0, value: 0 }, { orders: 3, value: 20 }, { orders: 1, value: 40 }])).toEqual({ value: 20, days: 3 });
    expect(comparableValue([1, 2, 3, 4, 100].map((value) => ({ orders: 1, value })))).toEqual({ value: 3, days: 4 });
  });
  test("une période se compare seulement si c'est un jour ou des semaines entières", () => {
    expect([1, 3, 7, 14, 30].map(isComparablePeriod)).toEqual([true, false, true, true, false]);
  });
});
