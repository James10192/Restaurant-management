/**
 * « Ouvert · ferme à 23 h », « Fermé · ouvre demain à 11 h » — Joliba
 *
 * Un badge « Fermé » seul ne répond pas à la question du client : quand puis-je venir ? Le statut
 * dit donc toujours la prochaine heure utile. Fonction pure sur l'heure LOCALE de l'établissement
 * (`localTime`), pour se tester sans fuseau.
 *
 * Un créneau dont la fermeture n'est pas après l'ouverture passe minuit (maquis : 18 h → 2 h).
 */

export type OpeningHours = { dayOfWeek: number; opensAtMinute: number; closesAtMinute: number };
export type OpeningStatus = { open: true; closesAt: number } | { open: false; opensAt: number; inDays: number } | { open: false; opensAt: null };

const overnight = (h: OpeningHours) => h.closesAtMinute <= h.opensAtMinute;

export function openingStatus(hours: readonly OpeningHours[], t: { dayOfWeek: number; minute: number }): OpeningStatus | null {
  if (hours.length === 0) return null;
  const yesterday = (t.dayOfWeek + 6) % 7;
  for (const h of hours) {
    const today = h.dayOfWeek === t.dayOfWeek && t.minute >= h.opensAtMinute && (overnight(h) || t.minute < h.closesAtMinute);
    const fromYesterday = overnight(h) && h.dayOfWeek === yesterday && t.minute < h.closesAtMinute;
    if (today || fromYesterday) return { open: true, closesAt: h.closesAtMinute };
  }
  for (let inDays = 0; inDays <= 7; inDays++) {
    const day = (t.dayOfWeek + inDays) % 7;
    const opens = hours.filter((h) => h.dayOfWeek === day && (inDays > 0 || h.opensAtMinute > t.minute)).map((h) => h.opensAtMinute);
    if (opens.length > 0) return { open: false, opensAt: Math.min(...opens), inDays };
  }
  return { open: false, opensAt: null };
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** « 23 h », « 11 h 30 », « minuit ». */
export function hourText(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  if (m === 0) return "minuit";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h} h` : `${h} h ${String(mm).padStart(2, "0")}`;
}

/** La phrase affichée sous le nom. */
export function openingText(status: OpeningStatus, dayOfWeek: number): string {
  if (status.open) return `Ouvert · ferme à ${hourText(status.closesAt)}`;
  if (status.opensAt === null) return "Fermé";
  const when = status.inDays === 0 ? "" : status.inDays === 1 ? "demain " : `${WEEKDAYS[(dayOfWeek + status.inDays) % 7]} `;
  return `Fermé · ouvre ${when}à ${hourText(status.opensAt)}`;
}
