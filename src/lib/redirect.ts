/**
 * Destination après connexion. Seul un chemin INTERNE est accepté : `//evil.example` ou
 * `https://…` feraient de la page de connexion un redirecteur ouvert, utile au phishing.
 */
export function safeRedirect(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

const OTP_EMAIL_KEY = "joliba.connexion.email";

/** L'adresse saisie passe d'un écran à l'autre sans jamais apparaître dans l'URL. */
export const pendingEmail = {
  get(): string | null {
    try {
      return sessionStorage.getItem(OTP_EMAIL_KEY);
    } catch {
      return null;
    }
  },
  set(email: string) {
    try {
      sessionStorage.setItem(OTP_EMAIL_KEY, email);
    } catch {
      /* stockage indisponible (navigation privée stricte) : l'écran de code redemandera l'adresse */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(OTP_EMAIL_KEY);
    } catch {
      /* rien à faire */
    }
  },
};
