/**
 * Le dialogue entre l'écran Apparence et le cadre de l'aperçu — Joliba (D-157)
 *
 * Deux messages, sur la même origine seulement : le cadre annonce qu'il est prêt, l'écran lui
 * envoie la couleur en cours de saisie (déjà résolue), à chaque changement, avant tout
 * enregistrement. `null` : la couleur de Joliba. Le logo ne passe pas par ici : il est en ligne dès
 * son envoi, et le cadre le lit comme la carte.
 */

export const PREVIEW_MESSAGE = "joliba:apercu";
export const PREVIEW_READY = "joliba:apercu-pret";

export type PreviewMessage = { type: typeof PREVIEW_MESSAGE; primary: string | null };
