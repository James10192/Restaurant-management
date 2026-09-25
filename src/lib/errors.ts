import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_ARGUMENT"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNKNOWN";

/**
 * Traduit une erreur Convex en message affichable. Les messages du serveur sont déjà
 * rédigés pour un humain ; tout le reste (panne réseau, bogue) devient un message
 * générique — jamais une trace technique à l'écran.
 */
export function describeError(error: unknown): { code: AppErrorCode; message: string } {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: AppErrorCode; message?: string } | string;
    if (typeof data === "object" && data && data.message) {
      return { code: data.code ?? "UNKNOWN", message: data.message };
    }
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { code: "UNKNOWN", message: "Pas de connexion. Vérifiez votre réseau puis réessayez." };
  }
  return { code: "UNKNOWN", message: "Une erreur inattendue est survenue. Réessayez dans un instant." };
}
