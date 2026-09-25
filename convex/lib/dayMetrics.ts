/**
 * La forme d'un jour de service calculé — Joliba (D-140)
 *
 * Une seule forme, typée de bout en bout : c'est ce que `computeServiceDay` rend, ce que
 * `dailyMetrics` garde, et ce que les analyses additionnent. Les délais sont des histogrammes
 * (cases de 30 s) pour que la médiane d'une période reste exacte ; les créneaux d'une
 * demi-heure partent du début du jour de service, pour comparer « à la même heure ».
 */

import { v, type Infer } from "convex/values";

const amount = v.number();
const histogram = v.array(v.object({ b: v.number(), n: v.number() }));

export const dayMetricsFields = {
  /** Version du calcul : une version nouvelle reconstruit l'historique. */
  sourceVersion: v.number(),
  /** L'heure de début utilisée : changer le réglage ne redécoupe pas le passé. */
  startHour: v.number(),
  from: v.number(),
  to: v.number(),
  currency: v.string(),
  orders: v.object({ count: v.number(), fromGuests: v.number() }),
  /** Ventes : les soldes d'addition, au jour où la table s'est installée (D-136). */
  sales: v.object({ amount, tables: v.number(), tablesWithCovers: v.number(), covers: v.number(), abandoned: v.number() }),
  /** Encaissé : les paiements moins les remboursements, au jour où l'argent a bougé (D-136). */
  collected: v.object({ gross: amount, refunded: amount, net: amount, payments: v.number() }),
  byMethod: v.array(v.object({ label: v.string(), amount, count: v.number() })),
  slots: v.object({ orders: v.array(v.number()), sales: v.array(amount), collected: v.array(amount) }),
  products: v.array(
    v.object({
      productId: v.optional(v.id("products")),
      name: v.string(),
      quantity: v.number(),
      amount,
      /** Annulés alors qu'ils étaient en cuisine. */
      lostQuantity: v.number(),
      lostAmount: amount,
    }),
  ),
  delays: v.object({
    acceptance: histogram,
    waitStart: histogram,
    prep: histogram,
    pass: histogram,
    request: histogram,
    /** Bons marqués prêts sans avoir été démarrés, sur `tickets` : leur part se montre. */
    readyWithoutStart: v.number(),
    /** Bons dont un geste est arrivé rejoué après une coupure : hors des délais, leur part se montre (D-164). */
    replayed: v.optional(v.number()),
    tickets: v.number(),
  }),
  stations: v.array(v.object({ stationId: v.id("prepStations"), name: v.string(), prep: histogram, waitStart: histogram })),
  tables: v.object({ duration: histogram, debts: v.number(), debtAmount: amount }),
  exceptions: v.object({
    comps: amount,
    discounts: amount,
    lostAmount: amount,
    refunds: amount,
    voids: v.number(),
    /**
     * Les écarts des caisses ouvertes ce jour-là, au PREMIER comptage (un recomptage fait une fois
     * l'attendu connu ne l'efface pas), manquants et excédents séparés : ils ne se compensent pas.
     */
    cashShort: amount,
    cashOver: amount,
    cashDiscrepancies: v.number(),
  }),
};

export const dayMetricsValidator = v.object(dayMetricsFields);
export type DayMetrics = Infer<typeof dayMetricsValidator>;
