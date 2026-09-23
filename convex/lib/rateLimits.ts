/**
 * Limites de débit — Joliba
 *
 * Les limites vivent ici, toutes ensemble, pour qu'on voie d'un coup d'œil ce qui est
 * borné. Les codes de connexion sont limités par Better Auth lui-même (`convex/auth.ts`).
 */

import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Une invitation envoie un e-mail : sans borne, un compte compromis devient un relais
  // d'envoi. Trente par heure couvrent l'ouverture d'un établissement entier.
  invitation: { kind: "fixed window", rate: 30, period: HOUR },
  // Codes de connexion PAR ADRESSE, en plus de la limite par IP de Better Auth : l'IP se
  // falsifie auprès d'un appel direct au déploiement, l'adresse visée, non. Protège aussi
  // la boîte de la personne visée contre une inondation de codes.
  otpEmail: { kind: "fixed window", rate: 5, period: 10 * MINUTE },
});
