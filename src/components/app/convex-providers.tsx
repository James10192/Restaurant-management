import type { ReactNode } from "react";
import { useConvexAuth, type ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { authClient } from "~/lib/auth-client";

/**
 * Un seul fournisseur, du rendu serveur à l'hydratation : le changer après montage
 * remonterait tout l'arbre et effacerait ce que l'utilisateur a déjà commencé à saisir.
 * Côté serveur, la session est « en cours de chargement » : aucun écran ne conclut
 * « déconnecté » trop tôt.
 */
export function ConvexProviders({ client, children }: { client: ConvexReactClient; children: ReactNode }) {
  return (
    // Conversion de type seulement : `AuthClient` (0.12.5) ne sait pas inférer la session
    // d'un client portant un plugin tiers (e-mail OTP) et la réduit à `never`. Le client
    // est bien celui attendu à l'exécution.
    <ConvexBetterAuthProvider client={client} authClient={authClient as unknown as AuthClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}

export function useAuthStatus(): { isLoading: boolean; isAuthenticated: boolean } {
  return useConvexAuth();
}
