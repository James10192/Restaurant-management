/**
 * Dates dans le fuseau de l'ÉTABLISSEMENT, pas dans celui de l'appareil — Joliba
 *
 * Un gérant à Paris qui règle la carte d'Abidjan doit voir « fin de la promotion le 30 » au
 * sens d'Abidjan. `Intl` donne l'heure locale d'un instant ; on remonte à l'instant par deux
 * corrections, ce qui suffit même aux fuseaux à heure d'été.
 */

function wallClock(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
}

/** L'instant qui correspond à `date` (AAAA-MM-JJ) à 23:59:59 dans `timeZone`. */
export function endOfDayIn(date: string, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y!, m! - 1, d!, 23, 59, 59);
  let instant = target;
  for (let i = 0; i < 2; i++) instant += target - wallClock(instant, timeZone);
  return instant;
}

/** La date (AAAA-MM-JJ) d'un instant dans `timeZone`. */
export function dateIn(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}
