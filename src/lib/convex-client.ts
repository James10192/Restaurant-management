import { ConvexReactClient } from "convex/react";

/**
 * Le client Convex de l'application du personnel.
 *
 * Il n'est plus créé par le routeur : tout ce que le routeur importe est téléchargé par
 * CHAQUE page, et la carte du client n'en a besoin qu'après s'être affichée (pour la
 * disponibilité en direct, chargée à part). Voir `routes/_auth.tsx`.
 *
 * Dans le navigateur : une seule instance, gardée d'une page à l'autre. Au rendu serveur :
 * une instance PAR requête — un client partagé entre requêtes porterait la session d'un
 * utilisateur dans la page d'un autre.
 */
let browserClient: ConvexReactClient | null = null;

export function convexUrl(): string {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!url) {
    // Échouer tôt et clairement plutôt que d'afficher une application muette.
    throw new Error("VITE_CONVEX_URL est manquant : lancez `pnpm exec convex dev` ou renseignez .env.local.");
  }
  return url;
}

export function createConvexClient(): ConvexReactClient {
  if (typeof window === "undefined") return new ConvexReactClient(convexUrl(), { unsavedChangesWarning: false });
  browserClient ??= new ConvexReactClient(convexUrl(), { unsavedChangesWarning: false });
  return browserClient;
}
