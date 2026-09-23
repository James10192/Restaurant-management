import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

/**
 * Deux fournisseurs : Better Auth pour les comptes, et nos jetons d'opérateur pour les appareils
 * enrôlés et le PIN de service (convex/lib/operatorJwt.ts, D-060). Le second n'existe que si sa
 * clé publique est posée : sans elle, aucun jeton d'opérateur n'est accepté.
 */
const operatorJwks = process.env.OPERATOR_JWKS;

export default {
  providers: [
    getAuthConfigProvider(),
    ...(operatorJwks
      ? [
          {
            type: "customJwt" as const,
            issuer: `${process.env.CONVEX_SITE_URL}/operator`,
            applicationID: "joliba-operator",
            algorithm: "ES256" as const,
            jwks: `data:text/plain;charset=utf-8;base64,${btoa(operatorJwks)}`,
          },
        ]
      : []),
  ],
} satisfies AuthConfig;
