/**
 * Slugs — Joliba
 *
 * Minuscules ASCII, chiffres et tirets. Les accents sont retirés (« Chez Tantie Adjoua
 * — Cocody » → « chez-tantie-adjoua-cocody ») : un slug se tape sur un téléphone et se
 * lit à voix haute.
 */

export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base.length > 0 ? base : "etablissement";
}

/** Premier slug libre : `base`, puis `base-2`, `base-3`… */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await isTaken(root))) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Mille homonymes : on sort de la boucle avec un suffixe aléatoire plutôt que d'échouer.
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}
