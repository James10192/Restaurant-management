/**
 * Disponibilité — Joliba
 *
 * Calculée À LA LECTURE (R23), dans le FUSEAU DE L'ÉTABLISSEMENT, jamais celui du serveur
 * ni du navigateur. Jamais matérialisée par une tâche planifiée : une tâche qui se réveille
 * en retard afficherait une carte fausse (DATA_MODEL.md §4).
 *
 * Ce module est PUR et partagé : le rendu serveur l'applique au premier affichage, le
 * navigateur le réapplique chaque minute. Les requêtes Convex, elles, ne lisent jamais
 * l'heure — une requête qui dépend de `Date.now()` serait mise en cache et ne changerait
 * plus à 17 h pile.
 *
 * Règles, dans cet ordre :
 *   1. l'interrupteur manuel (`isAvailable = false`) l'emporte — geste de service ;
 *   2. une rupture datée (`unavailableUntil`) vaut jusqu'à son échéance ;
 *   3. plages programmées : s'il existe des plages « disponible » pour une cible, elle n'est
 *      disponible QUE dedans (petit déjeuner 7 h–11 h) ; une plage « indisponible » l'exclut
 *      pendant sa durée. Les plages de la carte et de la section s'appliquent aux produits
 *      qu'elles contiennent.
 */

export type ScheduleWindow = {
  daysOfWeek: readonly number[];
  startMinute: number;
  endMinute: number;
};

export type AvailabilityRule = ScheduleWindow & {
  ruleType: "available" | "unavailable";
  effectiveFrom?: number;
  effectiveTo?: number;
};

export type LocalTime = { dayOfWeek: number; minute: number };

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Jour de la semaine (0 = dimanche) et minute du jour, à l'heure de l'établissement. */
export function localTime(now: number, timeZone: string): LocalTime {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return { dayOfWeek: WEEKDAYS[parts.weekday ?? "Sun"] ?? 0, minute: hour * 60 + Number(parts.minute) };
}

/**
 * L'instant est-il dans la plage ? Une plage qui passe minuit (22 h – 2 h) appartient au
 * jour de son DÉBUT : « vendredi 22 h – 2 h » couvre la nuit de vendredi à samedi.
 */
export function inWindow(t: LocalTime, w: ScheduleWindow): boolean {
  if (w.startMinute < w.endMinute) {
    return w.daysOfWeek.includes(t.dayOfWeek) && t.minute >= w.startMinute && t.minute < w.endMinute;
  }
  const previous = (t.dayOfWeek + 6) % 7;
  return (
    (w.daysOfWeek.includes(t.dayOfWeek) && t.minute >= w.startMinute) ||
    (w.daysOfWeek.includes(previous) && t.minute < w.endMinute)
  );
}

function ruleApplies(rule: AvailabilityRule, now: number): boolean {
  if (rule.effectiveFrom !== undefined && now < rule.effectiveFrom) return false;
  if (rule.effectiveTo !== undefined && now >= rule.effectiveTo) return false;
  return true;
}

/** Les plages d'UNE cible permettent-elles la disponibilité maintenant ? */
export function rulesAllow(rules: readonly AvailabilityRule[], now: number, t: LocalTime): boolean {
  const live = rules.filter((r) => ruleApplies(r, now));
  if (live.some((r) => r.ruleType === "unavailable" && inWindow(t, r))) return false;
  const windows = live.filter((r) => r.ruleType === "available");
  return windows.length === 0 || windows.some((r) => inWindow(t, r));
}

export type Unavailability = "manual" | "until" | "schedule";

export type ProductAvailabilityInput = {
  isAvailable: boolean;
  unavailableUntil?: number | null;
  productRules: readonly AvailabilityRule[];
  sectionRules: readonly AvailabilityRule[];
  menuRules: readonly AvailabilityRule[];
};

/** `null` = disponible ; sinon la raison, que l'écran du personnel affiche. */
export function productUnavailability(input: ProductAvailabilityInput, now: number, timeZone: string): Unavailability | null {
  if (!input.isAvailable) {
    // Une rupture datée qui est échue redevient disponible sans intervention.
    if (input.unavailableUntil == null) return "manual";
    if (now < input.unavailableUntil) return "until";
  }
  const t = localTime(now, timeZone);
  for (const rules of [input.menuRules, input.sectionRules, input.productRules]) {
    if (!rulesAllow(rules, now, t)) return "schedule";
  }
  return null;
}

/** La carte entière est-elle servie maintenant ? (plage horaire publiée avec elle) */
export function menuIsActive(schedule: ScheduleWindow | null, now: number, timeZone: string): boolean {
  if (!schedule) return true;
  return inWindow(localTime(now, timeZone), schedule);
}

/**
 * Échéance « ce soir » / « demain » : la fin du service, fixée à 4 h du matin à l'heure de
 * l'établissement. Un plat épuisé ce soir revient demain matin sans que personne n'y pense.
 */
export function serviceDayEnd(now: number, timeZone: string, extraDays = 0): number {
  const DAY = 86_400_000;
  const t = localTime(now, timeZone);
  const minutesUntilFour = (4 * 60 - t.minute + 1440) % 1440 || 1440;
  // Arrondi à la minute : `now` peut porter des secondes.
  const base = now - (now % 60_000) + minutesUntilFour * 60_000;
  return base + extraDays * DAY;
}
