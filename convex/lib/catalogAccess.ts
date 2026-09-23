/**
 * Accès aux objets du catalogue — Joliba
 *
 * Toutes les fonctions de la carte reçoivent un `venueId` ET l'identifiant de l'objet visé.
 * La garde résout la portée depuis `venueId` ; ensuite, CHAQUE objet atteint par son
 * identifiant est re-vérifié contre cette portée. Un produit d'un autre établissement —
 * de la même organisation ou non — est introuvable, jamais « interdit ».
 */

import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { notFound } from "./errors";
import type { ReadCtx } from "./guards";

type VenueScopedTable =
  | "menus"
  | "menuSections"
  | "products"
  | "productVariants"
  | "modifierGroups"
  | "modifierOptions"
  | "productModifierGroups"
  | "availabilityRules"
  | "menuPublications"
  | "serviceAreas"
  | "restaurantTables"
  | "tableQrCodes"
  | "prepStations"
  | "tableSessions"
  | "orders"
  | "orderItems"
  | "kitchenTickets"
  | "serviceRequests"
  | "guestSessions";

export async function getInVenue<T extends VenueScopedTable & TableNames>(
  ctx: ReadCtx,
  id: Id<T>,
  venueId: Id<"venues">,
  what: string,
): Promise<Doc<T>> {
  const doc = (await ctx.db.get(id)) as (Doc<T> & { venueId: Id<"venues"> }) | null;
  if (!doc || doc.venueId !== venueId) throw notFound(what);
  return doc;
}

/** Une liste d'identifiants réordonnée doit être EXACTEMENT la liste actuelle, permutée. */
export function assertSamePermutation(current: readonly string[], next: readonly string[]): void {
  const a = [...current].sort();
  const b = [...next].sort();
  if (a.length !== b.length || a.some((id, i) => id !== b[i])) {
    throw notFound("Un des éléments à réordonner");
  }
}
