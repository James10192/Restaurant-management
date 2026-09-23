/**
 * Droits du plan tarifaire — Joliba
 *
 * Le plan ne DONNE jamais une permission : il ne peut qu'en RETIRER (PERMISSIONS.md §6,
 * étape 5). La fonction ci-dessous ne sait que filtrer un ensemble déjà résolu ; aucune
 * de ses branches ne peut ajouter un élément. Un bug d'entitlement ferme une porte, il
 * n'en ouvre jamais.
 *
 * Une fonctionnalité non listée dans `subscription.entitlements` n'est pas restreinte.
 * Seul un `false` explicite retire. Pas d'abonnement (essai, développement) : rien n'est
 * retiré — c'est le plan qui décide de restreindre, pas l'absence de plan.
 */

import type { Permission } from "./permissions";

/** Fonctionnalité du plan → permissions qu'elle conditionne. */
export const FEATURE_PERMISSIONS = {
  ai: ["ai.use", "ai.actions.propose", "ai.actions.approve"],
  data_export: ["export.data"],
  financial_analytics: ["analytics.financial.read", "organization.analytics.read"],
  inventory: ["inventory.read", "inventory.manage", "inventory.count", "inventory.waste.declare"],
  loyalty: ["loyalty.manage"],
  reservations: ["reservation.read", "reservation.manage"],
} as const satisfies Record<string, readonly Permission[]>;

export type Feature = keyof typeof FEATURE_PERMISSIONS;

export function applyEntitlements(
  permissions: ReadonlySet<Permission>,
  entitlements: Readonly<Record<string, boolean>> | undefined,
): Set<Permission> {
  const result = new Set(permissions);
  if (!entitlements) return result;
  for (const [feature, gated] of Object.entries(FEATURE_PERMISSIONS)) {
    if (entitlements[feature] === false) {
      for (const p of gated) result.delete(p);
    }
  }
  return result;
}
