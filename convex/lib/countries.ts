/**
 * Pays pris en charge à l'ouverture d'une organisation — Joliba
 *
 * Chaque pays fixe la DEVISE et le FUSEAU par défaut. La devise d'un établissement se
 * fige à sa première opération financière (R20, `venues.currencyLockedAt`) ; le fuseau
 * décide de la « journée d'activité » des rapports. Les deux se choisissent donc à la
 * création, pas après.
 *
 * Ajouter un pays ici exige que sa devise existe dans `money.ts` : le type l'impose.
 */

import type { CurrencyCode } from "./money";

type CountryDefaults = { label: string; currency: CurrencyCode; timezone: string; dialCode: string };

export const COUNTRIES = {
  CI: { label: "Côte d'Ivoire", currency: "XOF", timezone: "Africa/Abidjan", dialCode: "+225" },
  SN: { label: "Sénégal", currency: "XOF", timezone: "Africa/Dakar", dialCode: "+221" },
  BJ: { label: "Bénin", currency: "XOF", timezone: "Africa/Porto-Novo", dialCode: "+229" },
  TG: { label: "Togo", currency: "XOF", timezone: "Africa/Lome", dialCode: "+228" },
  BF: { label: "Burkina Faso", currency: "XOF", timezone: "Africa/Ouagadougou", dialCode: "+226" },
  ML: { label: "Mali", currency: "XOF", timezone: "Africa/Bamako", dialCode: "+223" },
  NE: { label: "Niger", currency: "XOF", timezone: "Africa/Niamey", dialCode: "+227" },
  CM: { label: "Cameroun", currency: "XAF", timezone: "Africa/Douala", dialCode: "+237" },
  GA: { label: "Gabon", currency: "XAF", timezone: "Africa/Libreville", dialCode: "+241" },
  CG: { label: "Congo", currency: "XAF", timezone: "Africa/Brazzaville", dialCode: "+242" },
} as const satisfies Record<string, CountryDefaults>;

export type CountryCode = keyof typeof COUNTRIES;

export function isSupportedCountry(code: string): code is CountryCode {
  return code in COUNTRIES;
}
