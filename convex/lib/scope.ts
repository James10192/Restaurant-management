/**
 * Portée (tenant) — [PRODUCT_NAME]
 *
 * LA RÈGLE, en une phrase : on résout la portée DEPUIS L'APPELANT avant de toucher
 * une donnée, et tout document atteint par clé étrangère est RE-VÉRIFIÉ contre cette
 * portée. Lire puis vérifier, c'est avoir déjà lu.
 *
 * Ce fichier ne contient pas les gardes d'authentification (elles vivront dans
 * `guards.ts` avec le contexte Convex) : il contient les invariants de portée, écrits
 * comme des fonctions pures pour être testables sans base de données.
 *
 * Voir PERMISSIONS.md §6, SECURITY.md M1/M2, DATA_MODEL.md §1.
 */

/** Erreur de portée. Le message ne révèle JAMAIS l'existence de la ressource visée. */
export class ScopeError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "SCOPE_MISMATCH") {
    super(code);
  }
}

type Scoped = { readonly organizationId?: string; readonly venueId?: string };

/**
 * Le document appartient-il bien à l'établissement que l'appelant a demandé ?
 *
 * On renvoie NOT_FOUND et non FORBIDDEN : répondre « interdit » sur un identifiant
 * d'une autre organisation confirmerait son existence (SECURITY.md M1).
 */
export function assertInVenue<T extends Scoped>(
  doc: T | null | undefined,
  venueId: string,
): asserts doc is T {
  if (!doc || doc.venueId !== venueId) throw new ScopeError("NOT_FOUND");
}

export function assertInOrganization<T extends Scoped>(
  doc: T | null | undefined,
  organizationId: string,
): asserts doc is T {
  if (!doc || doc.organizationId !== organizationId) throw new ScopeError("NOT_FOUND");
}

/**
 * LE GARDE-FOU DE LA DÉNORMALISATION.
 *
 * Une cinquantaine de tables portent à la fois `organizationId` et `venueId`, alors
 * que `venues.organizationId` fait autorité. Une ligne où les deux désignent DEUX
 * ORGANISATIONS DIFFÉRENTES est une fuite de tenant que rien n'attrape : ni les index,
 * ni les gardes de permission, ni les tests d'accès. Elle naît d'un `organizationId`
 * recopié depuis le mauvais objet dans une mutation — une faute d'inattention, pas une
 * attaque.
 *
 * Cette assertion est donc obligatoire à CHAQUE écriture portant les deux champs, et
 * elle est doublée d'un contrôle d'intégrité récurrent (DATA_MODEL.md §1).
 */
export function assertSameOrg(
  venue: { readonly organizationId: string } | null | undefined,
  organizationId: string,
): void {
  if (!venue) throw new ScopeError("NOT_FOUND");
  if (venue.organizationId !== organizationId) throw new ScopeError("SCOPE_MISMATCH");
}

/**
 * Construit la portée d'une écriture À PARTIR de la venue, jamais à partir d'arguments
 * fournis séparément. C'est la forme à préférer : elle rend l'incohérence impossible
 * plutôt que détectable.
 *
 *   const scope = scopeFromVenue(venue);          //  ✅ une seule source
 *   await ctx.db.insert("orders", { ...scope, … });
 *
 *   { organizationId: args.organizationId, venueId: args.venueId }   //  ❌ deux sources
 */
export function scopeFromVenue(venue: { _id: string; organizationId: string }): {
  organizationId: string;
  venueId: string;
} {
  return { organizationId: venue.organizationId, venueId: venue._id };
}
