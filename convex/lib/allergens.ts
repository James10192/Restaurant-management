/**
 * Allergènes — Joliba
 *
 * La liste est COURTE et FERMÉE : les quatorze allergènes à déclaration obligatoire de la
 * réglementation européenne, qui servent aussi de référence en Afrique de l'Ouest faute de
 * liste locale publiée. Une table en base pour quatorze valeurs coûterait plus qu'elle ne
 * rapporte (DATA_MODEL.md §0).
 *
 * Un allergène n'est JAMAIS déduit de la description d'un plat (R28). Il est déclaré par
 * le restaurant, ou il n'existe pas — et l'écran client le dit : « prévenez votre serveur ».
 */

export const ALLERGENS = {
  gluten: { fr: "Gluten", en: "Gluten" },
  crustaces: { fr: "Crustacés", en: "Crustaceans" },
  oeufs: { fr: "Œufs", en: "Eggs" },
  poissons: { fr: "Poissons", en: "Fish" },
  arachides: { fr: "Arachides", en: "Peanuts" },
  soja: { fr: "Soja", en: "Soy" },
  lait: { fr: "Lait", en: "Milk" },
  fruits_a_coque: { fr: "Fruits à coque", en: "Tree nuts" },
  celeri: { fr: "Céleri", en: "Celery" },
  moutarde: { fr: "Moutarde", en: "Mustard" },
  sesame: { fr: "Sésame", en: "Sesame" },
  sulfites: { fr: "Sulfites", en: "Sulphites" },
  lupin: { fr: "Lupin", en: "Lupin" },
  mollusques: { fr: "Mollusques", en: "Molluscs" },
} as const;

export type Allergen = keyof typeof ALLERGENS;

export function isAllergen(value: string): value is Allergen {
  return Object.hasOwn(ALLERGENS, value);
}
