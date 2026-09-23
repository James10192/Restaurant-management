/**
 * Index de disponibilité — Joliba
 *
 * Applique les faits de disponibilité (interrupteurs, échéances, plages) à une carte publiée,
 * à un instant donné, dans le fuseau de l'établissement. PUR et partagé : le navigateur s'en
 * sert pour afficher la carte, les mutations de commande pour refuser un plat épuisé. Une
 * seule règle, deux lecteurs : la carte et la commande ne peuvent pas se contredire.
 */

import {
  menuIsActive,
  productUnavailability,
  type AvailabilityRule,
  type Unavailability,
} from "./availability";
import type { GuestMenu, LiveAvailability } from "./guestMenu";

export type AvailabilityIndex = {
  product: (menu: GuestMenu, sectionId: string, productId: string) => Unavailability | null;
  variant: (variantId: string) => boolean;
  option: (optionId: string) => boolean;
  menuActive: (menu: GuestMenu) => boolean;
};

export function availabilityIndex(live: LiveAvailability, now: number, timeZone: string): AvailabilityIndex {
  const rules = new Map<string, AvailabilityRule[]>();
  for (const rule of live.rules) {
    const key = `${rule.targetType}:${rule.targetId}`;
    rules.set(key, [...(rules.get(key) ?? []), rule]);
  }
  const variants = new Set(live.variants);
  const options = new Set(live.options);
  return {
    product(menu, sectionId, productId) {
      if (!menuIsActive(menu.menu.activeSchedule, now, timeZone)) return "schedule";
      const manual = live.products[productId];
      return productUnavailability(
        {
          isAvailable: manual === undefined,
          unavailableUntil: manual?.unavailableUntil ?? null,
          productRules: rules.get(`product:${productId}`) ?? [],
          sectionRules: rules.get(`section:${sectionId}`) ?? [],
          menuRules: rules.get(`menu:${menu.menu.id}`) ?? [],
        },
        now,
        timeZone,
      );
    },
    variant: (id) => !variants.has(id),
    option: (id) => !options.has(id),
    menuActive: (menu) => menuIsActive(menu.menu.activeSchedule, now, timeZone),
  };
}

