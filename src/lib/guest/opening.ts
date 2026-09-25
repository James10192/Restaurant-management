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

const WEEKDAYS = {
  fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

/** « 23 h », « 11 h 30 », « minuit » ; en anglais « 23:00 », « midnight ». */
export function hourText(minute: number, locale: "fr" | "en" = "fr"): string {
  const m = ((minute % 1440) + 1440) % 1440;
  if (m === 0) return locale === "fr" ? "minuit" : "midnight";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (locale === "en") return `${h}:${String(mm).padStart(2, "0")}`;
  return mm === 0 ? `${h} h` : `${h} h ${String(mm).padStart(2, "0")}`;
}

/** La phrase affichée sous le nom. Dans sept jours, c'est « lundi prochain », jamais « lundi ». */
export function openingText(status: OpeningStatus, dayOfWeek: number, locale: "fr" | "en" = "fr"): string {
  const h = (m: number) => hourText(m, locale);
  if (locale === "en") {
    if (status.open) return `Open · closes at ${h(status.closesAt)}`;
    if (status.opensAt === null) return "Closed";
    const day = WEEKDAYS.en[(dayOfWeek + status.inDays) % 7];
    const when = status.inDays === 0 ? "" : status.inDays === 1 ? "tomorrow " : status.inDays === 7 ? `next ${day} ` : `${day} `;
    return `Closed · opens ${when}at ${h(status.opensAt)}`;
  }
  if (status.open) return `Ouvert · ferme à ${h(status.closesAt)}`;
  if (status.opensAt === null) return "Fermé";
  const day = WEEKDAYS.fr[(dayOfWeek + status.inDays) % 7];
  const when = status.inDays === 0 ? "" : status.inDays === 1 ? "demain " : status.inDays === 7 ? `${day} prochain ` : `${day} `;
  return `Fermé · ouvre ${when}à ${h(status.opensAt)}`;
}
