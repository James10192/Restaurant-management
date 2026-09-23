/**
 * Disponibilité appliquée à la carte affichée — Joliba
 *
 * Les faits viennent de Convex (interrupteurs, échéances, plages) ; le calcul se fait ICI, à
 * l'heure de l'établissement, au rendu puis chaque minute (R23). Convex ne lit jamais l'heure.
 */

export { availabilityIndex, type AvailabilityIndex } from "../../../convex/lib/availabilityIndex";

/** « 07:00 », à partir de minutes locales. */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
