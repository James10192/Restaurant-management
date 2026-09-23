/**
 * Erreurs applicatives — Joliba
 *
 * Une seule forme d'erreur remonte au client : `ConvexError<{ code, message }>`. Le code
 * est stable (le frontend s'en sert pour choisir l'état d'écran), le message est écrit
 * pour un humain, en français, et ne révèle rien qu'il ne devrait pas.
 *
 * `NOT_FOUND` est la réponse par défaut à tout accès hors de la portée de l'appelant :
 * répondre `FORBIDDEN` sur une ressource d'une autre organisation confirmerait qu'elle
 * existe (PERMISSIONS.md §6, SECURITY.md M1). `FORBIDDEN` n'est employé que DANS la
 * portée de l'appelant — il voit l'établissement, il lui manque le droit d'y agir.
 */

import { ConvexError } from "convex/values";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_ARGUMENT"
  | "CONFLICT"
  | "RATE_LIMITED";

export type AppErrorData = { code: ErrorCode; message: string };

export function appError(code: ErrorCode, message: string): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}

export const notFound = (what = "Cette ressource") =>
  appError("NOT_FOUND", `${what} est introuvable.`);

export const unauthenticated = () =>
  appError("UNAUTHENTICATED", "Votre session a expiré. Reconnectez-vous pour continuer.");

export const forbidden = (message = "Vous n'avez pas le droit d'effectuer cette action.") =>
  appError("FORBIDDEN", message);

export const invalid = (message: string) => appError("INVALID_ARGUMENT", message);

export const conflict = (message: string) => appError("CONFLICT", message);
