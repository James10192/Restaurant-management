/**
 * Les prix de la carte client — Joliba (D-166)
 *
 * Deux formes d'un même prix : complète (`main`, avec la devise) pour la fiche et le panier, et
 * les seuls chiffres (`list`) pour la liste, où « Prix en F CFA » est écrit une fois au-dessus.
 */

import type { GuestProduct } from "../../../convex/lib/guestMenu";
import { formatListDigits, formatMoney, type CurrencyCode } from "../../../convex/lib/money";
import type { GuestText } from "~/lib/guest/i18n";

export function money(amount: number, currency: string) {
  return formatMoney({ amount, currency: currency as CurrencyCode });
}

/**
 * Le prix d'un plat, sous deux formes : complète (`main`, avec la devise) pour la fiche, et sans
 * devise (`list`) pour la liste, où « Prix en F CFA » est écrit une fois au-dessus (D-166).
 */
export function priceLabel(product: GuestProduct, currency: string, t: GuestText, now: number) {
  const promoActive = product.promoPrice !== undefined && (product.promoEndsAt === undefined || product.promoEndsAt > now);
  const both = (amount: number) => ({ full: money(amount, currency), bare: bareAmount(amount, currency) });
  let main: { full: string; bare: string };
  let old: { full: string; bare: string } | null = null;
  let prefix = "";
  if (product.variants.length > 1) {
    main = both(Math.min(...product.variants.map((v) => v.price)));
    prefix = `${t.from} `;
  } else if (product.variants.length === 1) main = both(product.variants[0]!.price);
  else if (promoActive) {
    main = both(product.promoPrice!);
    old = both(product.basePrice);
  } else main = both(product.basePrice);
  return { main: prefix + main.full, old: old?.full ?? null, list: prefix + main.bare, oldList: old?.bare ?? null };
}

function bareAmount(amount: number, currency: string) {
  return formatListDigits({ amount, currency: currency as CurrencyCode });
}
