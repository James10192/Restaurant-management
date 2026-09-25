import { describe, expect, it } from "vitest";
import { hourText, openingStatus, openingText } from "../../src/lib/guest/opening";

// Lundi à dimanche 11 h → 15 h, et le vendredi un service de nuit 18 h → 2 h.
const HOURS = [
  ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opensAtMinute: 660, closesAtMinute: 900 })),
  { dayOfWeek: 5, opensAtMinute: 1080, closesAtMinute: 120 },
];

describe("openingStatus", () => {
  it("sans horaires, ne dit rien", () => {
    expect(openingStatus([], { dayOfWeek: 1, minute: 600 })).toBeNull();
  });
  it("ouvert : dit l'heure de fermeture", () => {
    const s = openingStatus(HOURS, { dayOfWeek: 1, minute: 700 });
    expect(s).toEqual({ open: true, closesAt: 900 });
    expect(openingText(s!, 1)).toBe("Ouvert · ferme à 15 h");
  });
  it("fermé avant l'ouverture : ouvre aujourd'hui", () => {
    expect(openingText(openingStatus(HOURS, { dayOfWeek: 1, minute: 500 })!, 1)).toBe("Fermé · ouvre à 11 h");
  });
  it("fermé le soir : ouvre demain, ou le soir même le vendredi", () => {
    expect(openingText(openingStatus(HOURS, { dayOfWeek: 1, minute: 1000 })!, 1)).toBe("Fermé · ouvre demain à 11 h");
    expect(openingText(openingStatus(HOURS, { dayOfWeek: 5, minute: 1000 })!, 5)).toBe("Fermé · ouvre à 18 h");
  });
  it("un service passe minuit : ouvert le samedi à 1 h", () => {
    expect(openingStatus(HOURS, { dayOfWeek: 6, minute: 60 })).toEqual({ open: true, closesAt: 120 });
    expect(openingStatus(HOURS, { dayOfWeek: 5, minute: 1300 })).toEqual({ open: true, closesAt: 120 });
  });
  it("un seul jour d'ouverture : nomme le jour", () => {
    const s = openingStatus([{ dayOfWeek: 3, opensAtMinute: 690, closesAtMinute: 1380 }], { dayOfWeek: 0, minute: 600 });
    expect(openingText(s!, 0)).toBe("Fermé · ouvre mercredi à 11 h 30");
  });
  it("écrit minuit en toutes lettres", () => {
    expect(hourText(0)).toBe("minuit");
    expect(hourText(1440)).toBe("minuit");
  });
  it("dans sept jours, c'est « lundi prochain », jamais « lundi »", () => {
    const monday = [{ dayOfWeek: 1, opensAtMinute: 660, closesAtMinute: 900 }];
    expect(openingText(openingStatus(monday, { dayOfWeek: 1, minute: 1000 })!, 1)).toBe("Fermé · ouvre lundi prochain à 11 h");
  });
  it("en anglais, avec l'heure sur 24 h", () => {
    expect(openingText(openingStatus(HOURS, { dayOfWeek: 1, minute: 700 })!, 1, "en")).toBe("Open · closes at 15:00");
    expect(openingText(openingStatus(HOURS, { dayOfWeek: 1, minute: 1000 })!, 1, "en")).toBe("Closed · opens tomorrow at 11:00");
  });
});
