/**
 * Le thème d'une page client, à partir d'une couleur DÉJÀ résolue — Joliba (D-152)
 *
 * Séparé de `brand.ts` à dessein : les pages client l'appellent dans leur `head()`, qui part dans
 * le paquet d'entrée commun. Partager un module avec l'écran Apparence y faisait entrer tout le
 * calcul OKLCH, dont le client n'a que faire (mesuré : D-166).
 */

/** Le seul format accepté, en saisie comme à l'émission dans la page. */
export const HEX_PATTERN = /^#[0-9a-f]{6}$/;

/** Le texte clair posé sur la couleur (`--primary-foreground`). */
export const BRAND_FOREGROUND = "#fafafa";

/** Les jetons que la page client pose sur `:root`. Refuse tout ce qui n'est pas un hexadécimal. */
export function brandThemeCss(primary: string): string {
  if (!HEX_PATTERN.test(primary)) throw new Error("Couleur de thème invalide");
  return `:root{--primary:${primary};--ring:${primary};--primary-foreground:${BRAND_FOREGROUND}}`;
}
