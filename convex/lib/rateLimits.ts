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
  // Plafond GLOBAL des codes : la limite par IP se contourne en appelant le déploiement
  // directement avec un en-tête d'IP inventé, et la limite par adresse n'empêche pas de
  // viser des milliers d'adresses. Borne le coût d'envoi et protège la réputation du domaine.
  // Largement au-dessus d'un usage réel (une connexion par personne et par jour).
  otpGlobal: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 240 },
  // Une invitation porte un nom d'organisation et d'invitant choisis par l'appelant, envoyés
  // depuis le domaine Joliba : plafond par organisation, en plus de celui par personne.
  invitationPerOrganization: { kind: "fixed window", rate: 100, period: 24 * HOUR },
  // Enrôlement d'appareil : le code a 40 bits et vit 10 minutes, mais l'appel est public.
  // Plafond global, en plus : un essai massif ne passe pas inaperçu.
  deviceEnroll: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 40 },
  // Codes d'activation de PIN, par appareil enrôlé.
  pinActivation: { kind: "fixed window", rate: 10, period: 10 * MINUTE },
  // Côté client, par QR : une photo du code qui circule ne doit pas inonder la salle.
  guestRequest: { kind: "fixed window", rate: 12, period: 10 * MINUTE },
  guestOrder: { kind: "fixed window", rate: 6, period: 10 * MINUTE },
  // Paniers montrés, par QR : de quoi corriger souvent, pas de quoi inonder le serveur.
  guestCart: { kind: "fixed window", rate: 40, period: 10 * MINUTE },
  // Nouveaux convives, par tablée : une photo du QR ne doit pas remplir la table de faux invités.
  guestJoin: { kind: "fixed window", rate: 15, period: 10 * MINUTE },
});
