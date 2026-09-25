/**
 * Textes de la carte client — Joliba
 *
 * Français et anglais, livrés ensemble (ROADMAP §3). Le contenu de la carte (noms, descriptions)
 * vient des traductions saisies par le restaurant ; à défaut, le français est affiché — on ne
 * traduit jamais automatiquement un nom de plat.
 */

export type GuestLocale = "fr" | "en";

export const GUEST_TEXT = {
  fr: {
    table: "Table",
    search: "Rechercher un plat",
    soldOut: "Épuisé",
    notServedNow: "Pas servi à cette heure",
    servedFrom: (from: string, to: string) => `Servie de ${from} à ${to}`,
    from: "à partir de",
    allergens: "Allergènes déclarés",
    noAllergenInfo: "Allergies ? Prévenez votre serveur : toutes les informations ne sont pas renseignées ici.",
    suggests: "Le restaurant suggère",
    vegetarian: "Végétarien",
    vegan: "Végétalien",
    halal: "Halal",
    spicy: "Piquant",
    options: "Au choix",
    required: "obligatoire",
    chooseUpTo: (n: number) => (n === 1 ? "1 choix" : `jusqu'à ${n} choix`),
    close: "Fermer",
    offline: (time: string) => `Hors ligne — carte affichée à ${time}`,
    noResult: "Aucun plat ne correspond.",
    clearFilters: "Tout afficher",
    empty: "La carte n'est pas encore en ligne.",
    askWaiter: "Demandez la carte à votre serveur.",
    language: "Read the menu in English",
    poweredBy: "Carte propulsée par Joliba",
    call: "Appeler",
    openNow: "Ouvert",
    closedNow: "Fermé",
    sections: "Sections",
    filters: "Filtres",
    promo: "Promotion",
    add: "Ajouter",
  },
  en: {
    table: "Table",
    search: "Search the menu",
    soldOut: "Sold out",
    notServedNow: "Not served at this time",
    servedFrom: (from: string, to: string) => `Served from ${from} to ${to}`,
    from: "from",
    allergens: "Declared allergens",
    noAllergenInfo: "Allergies? Tell your waiter: not all information is listed here.",
    suggests: "The restaurant suggests",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    halal: "Halal",
    spicy: "Spicy",
    options: "Choice of",
    required: "required",
    chooseUpTo: (n: number) => (n === 1 ? "1 choice" : `up to ${n} choices`),
    close: "Close",
    offline: (time: string) => `Offline — menu as of ${time}`,
    noResult: "No dish matches.",
    clearFilters: "Show all",
    empty: "The menu is not online yet.",
    askWaiter: "Ask your waiter for the menu.",
    language: "Lire la carte en français",
    poweredBy: "Menu powered by Joliba",
    call: "Call",
    openNow: "Open",
    closedNow: "Closed",
    sections: "Sections",
    filters: "Filters",
    promo: "Offer",
    add: "Add",
  },
} as const;

export type GuestText = (typeof GUEST_TEXT)[GuestLocale];

/** Le texte d'un élément de carte dans la langue demandée, le français à défaut. */
export function localized(
  item: { name: string; description?: string; i18n?: Record<string, { name?: string; description?: string }> },
  locale: GuestLocale,
): { name: string; description: string | undefined } {
  if (locale === "fr") return { name: item.name, description: item.description };
  const t = item.i18n?.[locale];
  return { name: t?.name ?? item.name, description: t?.description ?? item.description };
}
