/**
 * Fonctions serveur de la surface client — Joliba
 *
 * S'exécutent UNIQUEMENT côté serveur : le laissez-passer vit dans un cookie `httpOnly` que le
 * navigateur ne peut pas lire, et c'est le serveur web qui le présente à Convex. Le secret de
 * signature, lui, ne quitte jamais Convex (`convex/lib/guestPass.ts`). Dans le navigateur, ces
 * fonctions ne sont qu'un appel réseau : leur corps vit dans `queries.server.ts`.
 */

import { createServerFn } from "@tanstack/react-start";
import { fetchPublicMenu, fetchTableMenu } from "./queries.server";

/** Forme d'une adresse d'établissement : les pages la vérifient AVANT d'appeler le serveur (404, pas 500). */
export const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

const slugInput = (input: unknown): { venueSlug: string } => {
  const venueSlug = (input as { venueSlug?: unknown } | null)?.venueSlug;
  if (typeof venueSlug !== "string" || !SLUG_PATTERN.test(venueSlug)) throw new Error("Adresse invalide.");
  return { venueSlug };
};

/** La carte de la table dont le navigateur porte le laissez-passer — ou `null`. */
export const loadTableMenu = createServerFn({ method: "GET" })
  .validator(slugInput)
  .handler(({ data }) => fetchTableMenu(data.venueSlug));

/** La carte publique, si l'établissement y a consenti — ou `null` (et la page répond 404). */
export const loadPublicMenu = createServerFn({ method: "GET" })
  .validator(slugInput)
  .handler(({ data }) => fetchPublicMenu(data.venueSlug));
