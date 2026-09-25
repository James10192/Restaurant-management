/**
 * Porte de qualité du menu public — Joliba
 *
 * Une page de menu n'est proposée aux moteurs de recherche que si elle vaut la peine d'être
 * lue (seo-strategy §7.5). Décidé PAR LE CODE, pas par la bonne volonté de chacun : des
 * milliers de pages faibles feraient baisser tout le domaine.
 *
 * Fonction pure. Les motifs de refus sont écrits pour le restaurateur : c'est ce qui
 * transforme une contrainte en liste de choses à faire.
 */

export const INDEXABILITY = {
  minProducts: 8,
  minDescribedShare: 0.5,
  minDescriptionChars: 120,
  maxAgeDays: 180,
} as const;

export type IndexabilityInput = {
  publicMenuEnabled: boolean;
  productCount: number;
  describedCount: number;
  hasAddress: boolean;
  hasOpeningHours: boolean;
  descriptionLength: number;
  lastPublishedAt: number | null;
};

export type IndexabilityCheck = { key: string; ok: boolean; label: string };

export function indexabilityChecks(input: IndexabilityInput, now: number): IndexabilityCheck[] {
  const ageDays = input.lastPublishedAt === null ? Infinity : (now - input.lastPublishedAt) / 86_400_000;
  return [
    { key: "consent", ok: input.publicMenuEnabled, label: "La carte publique est activée." },
    {
      key: "products",
      ok: input.productCount >= INDEXABILITY.minProducts,
      label: `Au moins ${INDEXABILITY.minProducts} plats publiés (${input.productCount} aujourd'hui).`,
    },
    {
      key: "described",
      ok: input.productCount > 0 && input.describedCount / input.productCount >= INDEXABILITY.minDescribedShare,
      label: `La moitié des plats au moins ont une description (${input.describedCount} sur ${input.productCount}).`,
    },
    { key: "address", ok: input.hasAddress, label: "L'adresse ou un repère est renseigné." },
    { key: "hours", ok: input.hasOpeningHours, label: "Les horaires d'ouverture sont renseignés." },
    {
      key: "description",
      ok: input.descriptionLength >= INDEXABILITY.minDescriptionChars,
      label: `Une présentation de l'établissement d'au moins ${INDEXABILITY.minDescriptionChars} caractères (${input.descriptionLength} aujourd'hui).`,
    },
    {
      key: "fresh",
      ok: ageDays <= INDEXABILITY.maxAgeDays,
      label: `La carte a été publiée il y a moins de ${INDEXABILITY.maxAgeDays} jours.`,
    },
  ];
}

export function isIndexable(input: IndexabilityInput, now: number): boolean {
  return indexabilityChecks(input, now).every((c) => c.ok);
}
