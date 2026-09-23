/**
 * Journaux structurés — Joliba (DEPLOYMENT.md §6)
 *
 * Une LISTE D'INCLUSION, pas d'exclusion : un champ qui n'est pas nommé ici n'atteint
 * jamais un journal. Une liste d'exclusion laisse toujours passer le prochain champ
 * ajouté — un jeton, un code de connexion, un numéro de téléphone.
 *
 * Partagé par le backend Convex et le serveur de l'application : une seule règle.
 */

export const LOG_FIELDS = [
  "traceId",
  "organizationId",
  "venueId",
  "userId",
  "route",
  "operation",
  "code",
  "status",
  "durationMs",
  "message",
] as const;

export type LogField = (typeof LOG_FIELDS)[number];
export type LogLevel = "info" | "warn" | "error";

const ALLOWED = new Set<string>(LOG_FIELDS);
const MAX_VALUE_LENGTH = 300;

/**
 * Certaines routes portent un secret dans leur chemin (le lien d'invitation). Un champ
 * `route` est donc toujours réécrit avant journalisation.
 */
export function redactRoute(route: string): string {
  return route.replace(/\/invitation\/[^/?#]+/g, "/invitation/:jeton").replace(/[?#].*$/, "");
}

/** Ne garde que les champs autorisés, en valeurs scalaires, tronquées. */
export function sanitizeLogFields(fields: Record<string, unknown>): Partial<Record<LogField, string | number | boolean>> {
  const out: Partial<Record<LogField, string | number | boolean>> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED.has(key)) continue;
    if (typeof value === "number" || typeof value === "boolean") out[key as LogField] = value;
    else if (typeof value === "string") {
      out[key as LogField] = (key === "route" ? redactRoute(value) : value).slice(0, MAX_VALUE_LENGTH);
    }
  }
  return out;
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...sanitizeLogFields(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
