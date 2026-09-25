/**
 * Les calculs des chiffres du jour — Joliba (tranche T6)
 *
 * Des fonctions pures, partagées entre l'écran de cuisine, la tour de contrôle, le calcul d'un
 * jour de service et les analyses : une seule définition du retard, d'un délai, d'un jour
 * comparable (D-135, D-139). Aucune ne lit l'heure elle-même : l'instant est toujours passé.
 */

import type { Doc } from "../_generated/dataModel";
import { DEFAULT_SERVICE_DAY_START_HOUR } from "./billing";
import { serviceDayKey } from "./ordering";

/* ────────────────────────────────────────────────────────────────────────────
 * Jour de service
 * ──────────────────────────────────────────────────────────────────────────── */

/** L'heure où commence le jour de service de l'établissement : une seule valeur par défaut. */
export function startHourOf(settings: Pick<Doc<"venueSettings">, "service">): number {
  return settings.service.serviceDayStartHour ?? DEFAULT_SERVICE_DAY_START_HOUR;
}

/** Le jour de service auquel appartient un instant, pour cet établissement. */
export function serviceDayOf(at: number, venue: Pick<Doc<"venues">, "timezone">, settings: Pick<Doc<"venueSettings">, "service">): string {
  return serviceDayKey(at, venue.timezone, startHourOf(settings));
}

/** « 2026-09-23 » décalé de `days` jours, sans fuseau : la date seule compte. */
export function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = dimanche. Lu sur la date du jour de service, jamais sur l'horloge du navigateur. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** Nombre de jours de `from` à `to` inclus. */
export function dayCount(from: string, to: string): number {
  const ms = (day: string) => {
    const [y, m, d] = day.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000) + 1;
}

/**
 * Les données de simulation n'entrent dans aucun chiffre réel (G2). L'établissement de
 * démonstration, lui, lit les siennes : sinon ses écrans seraient toujours vides.
 */
export function countsInFigures(isSimulation: boolean, venue: Pick<Doc<"venues">, "isSimulation">): boolean {
  return !isSimulation || venue.isSimulation;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Le retard d'un bon (D-135)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Depuis combien de temps un bon attend la cuisine. Un bon rappelé garde son heure d'envoi. */
export function ticketWait(ticket: { queuedAt?: number | null }, now: number): number {
  return ticket.queuedAt == null ? 0 : Math.max(0, now - ticket.queuedAt);
}

export function isTicketLate(ticket: { queuedAt?: number | null }, station: { lateThresholdMinutes: number }, now: number): boolean {
  return ticketWait(ticket, now) > station.lateThresholdMinutes * 60_000;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Histogrammes de délais (D-140)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Un délai se range dans une case de 30 secondes. Des cases s'additionnent d'un jour à l'autre,
 * des médianes non : c'est ce qui rend une médiane sur 30 jours exacte.
 */
export const BUCKET_MS = 30_000;
/** Au-delà de 10 heures, tout tombe dans la dernière case : ce n'est plus un délai, c'est un oubli. */
export const LAST_BUCKET = (10 * 3_600_000) / BUCKET_MS;

export type Bucket = { b: number; n: number };
export type Histogram = Bucket[];

export function histogramOf(durations: readonly number[]): Histogram {
  const counts = new Map<number, number>();
  for (const ms of durations) {
    if (!(ms >= 0)) continue;
    const b = Math.min(LAST_BUCKET, Math.floor(ms / BUCKET_MS));
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return [...counts.entries()].sort((x, y) => x[0] - y[0]).map(([b, n]) => ({ b, n }));
}

export function mergeHistograms(histograms: readonly Histogram[]): Histogram {
  const counts = new Map<number, number>();
  for (const h of histograms) for (const { b, n } of h) counts.set(b, (counts.get(b) ?? 0) + n);
  return [...counts.entries()].sort((x, y) => x[0] - y[0]).map(([b, n]) => ({ b, n }));
}

export function histogramCount(h: Histogram): number {
  return h.reduce((s, x) => s + x.n, 0);
}

/**
 * Le quantile `q` (0,5 = médiane), au rang le plus proche, en millisecondes : le milieu de la
 * case. `null` sans aucune mesure — l'écran le dit au lieu d'afficher zéro.
 */
export function histogramQuantile(h: Histogram, q: number): number | null {
  const total = histogramCount(h);
  if (total === 0) return null;
  const rank = Math.max(1, Math.ceil(q * total));
  let seen = 0;
  for (const { b, n } of h) {
    seen += n;
    if (seen >= rank) return b * BUCKET_MS + BUCKET_MS / 2;
  }
  return null;
}

/** Médiane et effectif, ensemble : un délai sans son effectif ne dit rien (D-143). */
export function delaySummary(h: Histogram): { median: number | null; p90: number | null; count: number } {
  return { median: histogramQuantile(h, 0.5), p90: histogramQuantile(h, 0.9), count: histogramCount(h) };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Les délais du service, avec leurs exclusions (D-143)
 * ──────────────────────────────────────────────────────────────────────────── */

type TicketTimes = Pick<Doc<"kitchenTickets">, "queuedAt" | "startedAt" | "readyAt" | "servedAt" | "recalledAt">;

/**
 * Sous ce seuil, une préparation n'a pas eu lieu entre les deux gestes : bon marqué prêt sans
 * avoir été démarré (`startedAt = readyAt`), ou « Commencer » puis « Prêt » rejoués à la suite par
 * la file hors ligne au retour du réseau, datés à la réception (D-143, constante D-148).
 */
export const MIN_PREP_MS = 30_000;

/** Un bon dont le début de préparation n'est pas une vraie mesure. Compté à part, jamais dans les délais de cuisine. */
export function readyWithoutStart(t: TicketTimes): boolean {
  return t.readyAt !== undefined && t.startedAt !== undefined && t.readyAt - t.startedAt < MIN_PREP_MS;
}
export function waitBeforeStart(t: TicketTimes): number | null {
  if (t.queuedAt === undefined || t.startedAt === undefined || readyWithoutStart(t)) return null;
  return t.startedAt - t.queuedAt;
}
/** Un bon rappelé garde son premier début et prend un second « prêt » : sa préparation et son passage ne mesurent plus rien. */
export function prepTime(t: TicketTimes): number | null {
  if (t.startedAt === undefined || t.readyAt === undefined || readyWithoutStart(t) || t.recalledAt !== undefined) return null;
  return t.readyAt - t.startedAt;
}
export function passTime(t: TicketTimes): number | null {
  if (t.readyAt === undefined || t.servedAt === undefined || t.recalledAt !== undefined) return null;
  return t.servedAt - t.readyAt;
}

/**
 * Commande → acceptation, pour les seules commandes du client passées par la validation d'un
 * serveur. Une commande saisie par le personnel est acceptée à l'instant où elle part : zéro.
 */
export function acceptanceTime(order: Pick<Doc<"orders">, "channel" | "acceptedAt" | "submittedAt">): number | null {
  if (order.channel !== "guest" || order.acceptedAt === undefined) return null;
  return order.acceptedAt - order.submittedAt;
}

/** Demande → prise en charge. « Fait » sans « J'y vais » compte au moment où c'est fait. */
export function requestResponseTime(r: Pick<Doc<"serviceRequests">, "status" | "createdAt" | "acknowledgedAt" | "resolvedAt">): number | null {
  if (r.status === "cancelled") return null;
  const answered = r.acknowledgedAt ?? r.resolvedAt;
  return answered === undefined ? null : answered - r.createdAt;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Créneaux et jours comparables (D-142)
 * ──────────────────────────────────────────────────────────────────────────── */

export const SLOT_MS = 30 * 60_000;

/**
 * L'heure donnée par l'écran. Une requête Convex ne se réévalue pas quand l'heure passe (D-048) :
 * c'est l'écran, avec son horloge, qui fait avancer « aujourd'hui ». Le serveur ne la croit que
 * si elle est plausible ; au-delà de `slack`, il prend la sienne.
 */
export function clockOf(at: number | undefined, now: number, slack: number): number {
  return at !== undefined && Math.abs(at - now) <= slack ? at : now;
}
/** 48 créneaux d'une demi-heure ; un jour de changement d'heure en a un de plus, rangé dans le dernier. */
export const SLOTS = 48;

/** Le créneau d'un instant, compté depuis le début du jour de service. */
export function slotOf(at: number, from: number): number {
  return Math.min(SLOTS - 1, Math.max(0, Math.floor((at - from) / SLOT_MS)));
}

export function emptySlots(): number[] {
  return new Array<number>(SLOTS).fill(0);
}

/** La somme des créneaux jusqu'à `slot` inclus : « à la même heure ». */
export function sumUntil(slots: readonly number[], slot: number): number {
  return slots.slice(0, slot + 1).reduce((s, x) => s + x, 0);
}

/** Les mêmes jours de semaine des 8 dernières semaines, du plus récent au plus ancien. */
export function sameWeekdaysBefore(day: string, weeks = 8): string[] {
  return Array.from({ length: weeks }, (_, i) => shiftDay(day, -7 * (i + 1)));
}

/** Au moins 3 jours comparables, sinon on ne compare pas : l'écran le dit. */
export const MIN_COMPARABLE_DAYS = 3;
/** Les 4 plus récents suffisent : plus loin, la saison a changé. */
export const COMPARABLE_DAYS = 4;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * La référence d'un chiffre : la médiane des mêmes jours de semaine qui ont eu une commande
 * réelle (le restaurant était ouvert), les 4 plus récents. `null` en dessous de 3.
 */
export function comparableValue(days: readonly { orders: number; value: number }[]): { value: number; days: number } | null {
  const open = days.filter((d) => d.orders > 0).slice(0, COMPARABLE_DAYS);
  if (open.length < MIN_COMPARABLE_DAYS) return null;
  return { value: median(open.map((d) => d.value))!, days: open.length };
}

/** Une période ne se compare qu'à une période de même nature : un jour, ou des semaines entières. */
export function isComparablePeriod(days: number): boolean {
  return days === 1 || (days > 0 && days % 7 === 0);
}
