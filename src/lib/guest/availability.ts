/**
 * Disponibilité appliquée à la carte affichée — Joliba
 *
 * Les faits viennent de Convex (interrupteurs, échéances, plages) ; le calcul se fait ICI, à
 * l'heure de l'établissement, au rendu puis chaque minute (R23). Convex ne lit jamais l'heure.
 */

import {
  menuIsActive,
  productUnavailability,
  type AvailabilityRule,
  type Unavailability,
} from "../../../convex/lib/availability";
import type { GuestMenu, LiveAvailability } from "../../../convex/lib/guestMenu";

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

/** « 07:00 », à partir de minutes locales. */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
