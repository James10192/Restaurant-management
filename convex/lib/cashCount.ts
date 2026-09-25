import type { Doc } from "../_generated/dataModel";

/**
 * L'écart du premier comptage quand il y en a eu deux. Recompter une fois l'attendu connu, c'est
 * pouvoir taper l'attendu : le premier écart reste donc la donnée, et il exige un motif.
 */
export function initialDiscrepancyOf(session: Doc<"cashRegisterSessions">): number | null {
  const first = session.counts[0];
  if (session.counts.length < 2 || !first || session.expectedAmount === undefined) return null;
  return first.amount - session.expectedAmount;
}

/** L'écart qui fait foi pour une caisse : le premier, s'il y a eu recomptage. */
export function discrepancyOf(session: Doc<"cashRegisterSessions">): number | null {
  return initialDiscrepancyOf(session) ?? session.discrepancy ?? null;
}
