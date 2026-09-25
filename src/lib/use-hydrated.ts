import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `true` une fois le JavaScript de la page actif. Avant, un bouton de formulaire
 * soumettrait le formulaire EN HTML (rechargement, saisie perdue) : sur un réseau lent,
 * c'est ce qui arrive au premier geste.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
