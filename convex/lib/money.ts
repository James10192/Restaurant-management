/**
 * Montants — Joliba
 *
 * RÈGLE : un montant est un ENTIER dans l'unité mineure de sa devise, toujours
 * accompagné de son code devise. Aucun flottant ne touche jamais un montant (D-004).
 *
 * LE PIÈGE QUI COÛTE UN FACTEUR 100 — le réflexe « un montant se stocke en centimes,
 * donc × 100 » est FAUX ici. Le franc CFA (XOF, XAF) a un exposant décimal de 0 : il
 * n'a pas de sous-unité en circulation. Multiplier par 100 un montant en XOF, c'est
 * surfacturer le client d'un facteur 100.
 *
 * D'où la règle : le facteur d'échelle est DÉRIVÉ de l'exposant de la devise, jamais
 * écrit en dur. Voir PAYMENTS.md §2.
 */

/** Exposant décimal ISO 4217. Ajouter une devise ici, et nulle part ailleurs. */
const CURRENCY_EXPONENT = {
  XOF: 0, // franc CFA UEMOA — PAS de sous-unité
  XAF: 0, // franc CFA CEMAC — PAS de sous-unité
  EUR: 2,
  USD: 2,
  MAD: 2,
  NGN: 2,
  GHS: 2,
} as const satisfies Record<string, number>;

export type CurrencyCode = keyof typeof CURRENCY_EXPONENT;

/** Un montant. `amount` est un ENTIER, dans l'unité mineure de `currency`. */
export type Money = { readonly amount: number; readonly currency: CurrencyCode };

export class MoneyError extends Error {}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return code in CURRENCY_EXPONENT;
}

export function currencyExponent(currency: CurrencyCode): number {
  return CURRENCY_EXPONENT[currency];
}

/** 10^exposant. XOF → 1. EUR → 100. Jamais une constante écrite à la main. */
export function scaleFactor(currency: CurrencyCode): number {
  return 10 ** CURRENCY_EXPONENT[currency];
}

export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amount)) {
    throw new MoneyError(`Montant non entier : ${amount} ${currency}. Un montant se stocke en unité mineure.`);
  }
  return { amount, currency };
}

export const zero = (currency: CurrencyCode): Money => ({ amount: 0, currency });

/**
 * Depuis une valeur décimale saisie par un humain.
 * 5000 XOF → { amount: 5000 }   ·   12,50 EUR → { amount: 1250 }
 */
export function fromDecimal(value: number, currency: CurrencyCode): Money {
  return money(Math.round(value * scaleFactor(currency)), currency);
}

export function toDecimal(m: Money): number {
  return m.amount / scaleFactor(m.currency);
}

/** Refuse d'additionner des pommes et des oranges — silencieusement, ce serait pire. */
function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Devises incompatibles : ${a.currency} et ${b.currency}.`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce<Money>((acc, m) => add(acc, m), zero(currency));
}

export function multiply(m: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) throw new MoneyError(`Quantité non entière : ${quantity}.`);
  return { amount: m.amount * quantity, currency: m.currency };
}

/** Pourcentage (TVA, service, remise). Arrondi au plus proche, dans l'unité mineure. */
export function percentOf(m: Money, percent: number): Money {
  return { amount: Math.round((m.amount * percent) / 100), currency: m.currency };
}

export const isZero = (m: Money) => m.amount === 0;
export const isPositive = (m: Money) => m.amount > 0;
export const compare = (a: Money, b: Money) => (assertSameCurrency(a, b), a.amount - b.amount);

/**
 * Division d'une addition en N parts égales, SANS PERDRE UNE UNITÉ.
 *
 * 10 000 XOF à 3 → [3334, 3333, 3333] et non [3333, 3333, 3333].
 * Le reste est distribué sur les premières parts : trois fois 3 333 laisserait
 * 1 franc dans la nature, et la caisse ne tomberait pas juste.
 */
export function splitEvenly(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new MoneyError(`Nombre de parts invalide : ${parts}.`);
  }
  const base = Math.floor(total.amount / parts);
  const remainder = total.amount - base * parts;
  return Array.from({ length: parts }, (_, i) => ({
    amount: base + (i < remainder ? 1 : 0),
    currency: total.currency,
  }));
}

/**
 * Arrondi au pas imposé par un fournisseur de paiement, TOUJOURS AU SUPÉRIEUR.
 *
 * Certains agrégateurs n'acceptent qu'un montant multiple de 5 et ARRONDISSENT À
 * L'INFÉRIEUR SANS PRÉVENIR : l'écart disparaît alors en silence et la caisse ne
 * tombe plus juste. On arrondit donc nous-mêmes, au supérieur, et on conserve à part
 * le montant réellement accepté (`paymentIntents.acceptedAmount`). Voir D-028.
 */
export function roundUpToStep(m: Money, step: number): Money {
  if (!Number.isInteger(step) || step <= 0) throw new MoneyError(`Pas invalide : ${step}.`);
  return { amount: Math.ceil(m.amount / step) * step, currency: m.currency };
}

/**
 * Formatage localisé. JAMAIS de concaténation manuelle de « FCFA » ailleurs dans
 * le code : c'est ici, et nulle part ailleurs.
 */
export function formatMoney(m: Money, locale = "fr-CI"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: CURRENCY_EXPONENT[m.currency],
    maximumFractionDigits: CURRENCY_EXPONENT[m.currency],
  }).format(toDecimal(m));
}

/**
 * Un montant tel qu'un fournisseur l'attend : une CHAÎNE décimale, dans l'unité principale.
 * 5000 XOF → "5000" · 1250 EUR → "12.50". Wave refuse toute décimale en XOF (« Decimal places are
 * not allowed for XOF currency amounts ») : l'exposant 0 n'en produit jamais.
 */
export function toProviderAmount(amount: number, currency: CurrencyCode): string {
  if (!Number.isInteger(amount) || amount < 0) throw new MoneyError(`Montant invalide pour un fournisseur : ${amount}.`);
  const exponent = CURRENCY_EXPONENT[currency];
  if (exponent === 0) return String(amount);
  const digits = String(amount).padStart(exponent + 1, "0");
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

/**
 * Un montant renvoyé par un fournisseur, relu SANS flottant. « 12000 » et « 12000.00 » valent
 * 12 000 XOF ; « 12000.5 » en XOF est refusé (`null`) : un demi-franc n'existe pas, et l'arrondir
 * en silence ferait mentir la caisse. Toute autre forme est refusée.
 */
export function parseProviderAmount(value: unknown, currency: CurrencyCode): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = typeof value === "number" ? (Number.isInteger(value) ? String(value) : "") : value.trim();
  const match = /^(\d{1,15})(?:\.(\d{1,6}))?$/.exec(text);
  if (!match) return null;
  const exponent = CURRENCY_EXPONENT[currency];
  const whole = match[1]!;
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > exponent) return null;
  const amount = Number(whole + fraction.padEnd(exponent, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}
