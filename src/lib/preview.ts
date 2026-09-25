/**
 * Le dialogue entre l'écran Apparence et le cadre de l'aperçu — Joliba (D-157)
 *
 * Deux messages, sur la même origine seulement : le cadre annonce qu'il est prêt, l'écran lui
 * envoie la couleur (déjà résolue) et le logo en cours, à chaque changement, avant tout
 * enregistrement.
 */
import type { PublicBrand } from "../../convex/lib/guestMenu";

export const PREVIEW_MESSAGE = "joliba:apercu";
export const PREVIEW_READY = "joliba:apercu-pret";

export type PreviewMessage = { type: typeof PREVIEW_MESSAGE; primary: string | null; logo: PublicBrand["logo"] };
