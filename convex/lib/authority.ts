/**
 * Les trois verrous contre l'élévation de privilèges — Joliba (PERMISSIONS.md §7)
 *
 *  1. On ne peut pas DONNER (ni retirer) ce qu'on n'a pas : attribuer, retirer ou composer
 *     un rôle exige de détenir soi-même chacune de ses permissions, dans la portée visée.
 *  2. On ne peut pas modifier ses PROPRES affectations, ni celles du propriétaire.
 *  3. Aucune permission `platform.*` n'entre dans un rôle d'organisation. Filtré à
 *     l'écriture, pas seulement masqué dans l'interface.
 *
 * Fonctions pures autant que possible : elles se testent sans base de données.
 */

import type { Doc } from "../_generated/dataModel";
import { forbidden, invalid } from "./errors";
import { isPermission, isPlatformPermission, permissionMeta, type Permission } from "./permissions";

/**
 * Permissions d'un rôle qui ont un effet dans une portée. Dans un établissement, les
 * permissions d'organisation (`venue.create`, `permissions.manage`…) sont inertes : la
 * résolution ne les accorde que par une affectation au niveau organisation. Les exiger
 * de l'acteur y serait donc un faux verrou.
 */
export function effectivePermissionsInScope(
  permissions: readonly string[],
  scopeType: "organization" | "venue",
): Permission[] {
  return permissions
    .filter(isPermission)
    .filter((p) => scopeType === "organization" || permissionMeta(p).scope === "venue");
}

/** Verrou 1 — renvoie les permissions manquantes (vide = autorisé). */
export function missingPermissions(
  actorPermissions: ReadonlySet<Permission>,
  required: readonly Permission[],
): Permission[] {
  return required.filter((p) => !actorPermissions.has(p));
}

export function assertCanHandleRoles(
  actorPermissions: ReadonlySet<Permission>,
  roles: readonly Pick<Doc<"roles">, "permissions" | "label">[],
  scopeType: "organization" | "venue",
): void {
  for (const role of roles) {
    const missing = missingPermissions(
      actorPermissions,
      effectivePermissionsInScope(role.permissions, scopeType),
    );
    if (missing.length > 0) {
      throw forbidden(
        `Le rôle « ${role.label} » accorde des droits que vous n'avez pas vous-même. Seule une personne qui les détient peut l'attribuer ou le retirer.`,
      );
    }
  }
}

/** Verrou 2. */
export function assertNotSelfOrOwner(
  actor: { user: Pick<Doc<"users">, "_id">; organization: Pick<Doc<"organizations">, "ownerUserId"> },
  target: Pick<Doc<"organizationMembers">, "userId">,
): void {
  if (target.userId === actor.user._id) {
    throw forbidden("Vous ne pouvez pas modifier vos propres droits. Demandez à une autre personne habilitée.");
  }
  if (target.userId === actor.organization.ownerUserId) {
    throw forbidden("Les droits du propriétaire de l'organisation ne se modifient pas.");
  }
}

/**
 * Verrou 3, et validation du contenu d'un rôle. Renvoie la liste nettoyée (dédoublonnée,
 * triée) ou lève — une permission inconnue est une erreur, pas un élément ignoré en
 * silence : ignorer masquerait une faute de frappe dans un rôle personnalisé.
 */
export function sanitizeRolePermissions(values: readonly string[]): Permission[] {
  const platform = values.filter(isPlatformPermission);
  if (platform.length > 0) {
    throw invalid("Les permissions de la plateforme Joliba ne peuvent pas être attribuées par une organisation.");
  }
  const unknown = values.filter((p) => !isPermission(p));
  if (unknown.length > 0) throw invalid(`Permission inconnue : ${unknown.join(", ")}.`);
  if (values.length === 0) throw invalid("Un rôle doit contenir au moins une permission.");
  return [...new Set(values.filter(isPermission))].sort();
}
