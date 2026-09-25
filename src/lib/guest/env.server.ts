/**
 * Environnement serveur de la surface client — Joliba
 *
 * Module `.server.ts` : jamais embarqué dans le navigateur. Il n'est importé que par des
 * fonctions serveur et des gestionnaires de route serveur, que la compilation retire du client.
 */

import { getRequestUrl } from "@tanstack/react-start/server";

export const TABLE_COOKIE = "joliba_table";

export function convexServerUrl(): string {
  const url = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? process.env.VITE_CONVEX_URL;
  if (!url) throw new Error("VITE_CONVEX_URL est manquant.");
  return url;
}

/** L'origine publique du site : `SITE_URL` s'il est posé, sinon celle de la requête. */
export function siteOrigin(): string {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return getRequestUrl().origin;
}
