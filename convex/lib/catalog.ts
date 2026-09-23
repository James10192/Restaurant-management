/**
 * Validation du catalogue — Joliba
 *
 * Fonctions PURES, partagées par toutes les écritures de la carte (saisie, import CSV,
 * duplication). Une règle de saisie vit ici une seule fois : un import qui accepterait ce
 * que l'écran refuse serait un contournement, pas une fonctionnalité.
 */

import { isAllergen, type Allergen } from "./allergens";
import { invalid } from "./errors";

export const LIMITS = {
  name: 80,
  description: 500,
  tag: 30,
  tags: 10,
  variants: 12,
  options: 30,
  images: 4,
  /** Plafond d'un prix, en unité mineure. Au-delà, c'est une faute de frappe. */
  price: 100_000_000,
  spicyLevel: 3,
} as const;

/** Traductions acceptées pour le contenu de la carte. Le français est la langue de saisie. */
export const CONTENT_LOCALES = ["en"] as const;

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function cleanName(value: string, what = "Le nom"): string {
  const name = collapse(value);
  if (name.length < 1 || name.length > LIMITS.name) {
    throw invalid(`${what} doit contenir entre 1 et ${LIMITS.name} caractères.`);
  }
  return name;
}

/** Une description vide n'est pas une description : elle devient `undefined`. */
export function cleanDescription(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (text.length > LIMITS.description) {
    throw invalid(`La description ne doit pas dépasser ${LIMITS.description} caractères.`);
  }
  return text.length > 0 ? text : undefined;
}

/**
 * Un prix est un ENTIER en unité mineure (D-004). Le franc CFA n'a pas de sous-unité :
 * 2 500 FCFA se stocke 2500. Un prix nul est permis (eau offerte, accompagnement inclus).
 */
export function assertPrice(amount: number, what = "Le prix"): number {
  if (!Number.isInteger(amount)) throw invalid(`${what} doit être un nombre entier.`);
  if (amount < 0) throw invalid(`${what} ne peut pas être négatif.`);
  if (amount > LIMITS.price) throw invalid(`${what} est anormalement élevé. Vérifiez la saisie.`);
  return amount;
}

/** Un supplément peut être négatif (option « sans viande ») mais pas au-delà du plafond. */
export function assertPriceDelta(amount: number): number {
  if (!Number.isInteger(amount)) throw invalid("Le supplément doit être un nombre entier.");
  if (Math.abs(amount) > LIMITS.price) throw invalid("Le supplément est anormalement élevé. Vérifiez la saisie.");
  return amount;
}

export function cleanTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = collapse(raw);
    if (tag.length === 0) continue;
    if (tag.length > LIMITS.tag) throw invalid(`Une étiquette ne doit pas dépasser ${LIMITS.tag} caractères.`);
    if (!out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  if (out.length > LIMITS.tags) throw invalid(`Pas plus de ${LIMITS.tags} étiquettes par produit.`);
  return out;
}

/** Seuls les allergènes de la liste fermée sont acceptés : un texte libre ne se filtre pas. */
export function cleanAllergens(values: readonly string[]): Allergen[] {
  const out: Allergen[] = [];
  for (const value of values) {
    if (!isAllergen(value)) throw invalid(`Allergène inconnu : « ${value} ».`);
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

export type Dietary = { vegetarian?: boolean; vegan?: boolean; halal?: boolean; spicyLevel?: number };

export function cleanDietary(value: Dietary): Dietary {
  const out: Dietary = {};
  if (value.vegetarian !== undefined) out.vegetarian = value.vegetarian;
  if (value.vegan !== undefined) out.vegan = value.vegan;
  if (value.halal !== undefined) out.halal = value.halal;
  if (value.spicyLevel !== undefined) {
    if (!Number.isInteger(value.spicyLevel) || value.spicyLevel < 0 || value.spicyLevel > LIMITS.spicyLevel) {
      throw invalid(`Le niveau de piment va de 0 à ${LIMITS.spicyLevel}.`);
    }
    if (value.spicyLevel > 0) out.spicyLevel = value.spicyLevel;
  }
  // Un plat végétalien est végétarien : on ne laisse pas l'écran client afficher le contraire.
  if (out.vegan) out.vegetarian = true;
  return out;
}

export type I18nText = Record<string, { name?: string; description?: string }>;

export function cleanI18n(value: I18nText | undefined): I18nText | undefined {
  if (value === undefined) return undefined;
  const out: I18nText = {};
  for (const [locale, text] of Object.entries(value)) {
    if (!(CONTENT_LOCALES as readonly string[]).includes(locale)) {
      throw invalid(`Langue non prise en charge : « ${locale} ».`);
    }
    const name = text.name === undefined ? undefined : collapse(text.name);
    const description = cleanDescription(text.description);
    if (name !== undefined && name.length > LIMITS.name) {
      throw invalid(`Le nom traduit ne doit pas dépasser ${LIMITS.name} caractères.`);
    }
    const entry: { name?: string; description?: string } = {};
    if (name) entry.name = name;
    if (description) entry.description = description;
    if (Object.keys(entry).length > 0) out[locale] = entry;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Bornes d'un groupe d'options, cohérentes entre elles et avec le nombre d'options. */
export function assertSelectionBounds(args: {
  selectionType: "single" | "multiple";
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
}): { minSelect: number; maxSelect: number } {
  const { selectionType, isRequired } = args;
  if (!Number.isInteger(args.minSelect) || !Number.isInteger(args.maxSelect)) {
    throw invalid("Les nombres de choix doivent être entiers.");
  }
  if (selectionType === "single") {
    // Un choix unique : un seul, obligatoire ou non. Les bornes saisies n'ont pas de sens ici.
    return { minSelect: isRequired ? 1 : 0, maxSelect: 1 };
  }
  const minSelect = Math.max(args.minSelect, isRequired ? 1 : 0);
  const maxSelect = args.maxSelect;
  if (maxSelect < 1 || maxSelect > LIMITS.options) throw invalid(`Le maximum va de 1 à ${LIMITS.options}.`);
  if (minSelect > maxSelect) throw invalid("Le minimum ne peut pas dépasser le maximum.");
  return { minSelect, maxSelect };
}
