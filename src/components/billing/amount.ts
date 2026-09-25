import { parsePrice } from "../../../convex/lib/menuImport";
import { isSupportedCurrency, toDecimal } from "../../../convex/lib/money";

/**
 * Un montant saisi au clavier ↔ l'entier stocké. L'échelle vient de la devise, jamais d'un « × 100 »
 * écrit à la main : 5 000 F CFA se saisit « 5000 » et se stocke 5000 (D-004).
 */
export function parseAmount(text: string, currency: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return parsePrice(trimmed, currency);
}

/** L'entier stocké, en texte éditable (sans séparateur de milliers). */
export function amountToText(amount: number, currency: string): string {
  if (!isSupportedCurrency(currency)) return String(amount);
  return String(toDecimal({ amount, currency }));
}
