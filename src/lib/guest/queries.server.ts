/**
 * Lectures Convex de la surface client, côté serveur web — Joliba
 *
 * Module `.server.ts` : ni le client Convex HTTP ni la liste des fonctions (`api`) ne partent
 * dans le navigateur, où ils alourdiraient chaque page de près de 10 Ko.
 */

import { getCookie } from "@tanstack/react-start/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { convexServerUrl, siteOrigin, TABLE_COOKIE } from "./env.server";

export async function fetchTableMenu(venueSlug: string) {
  const pass = getCookie(TABLE_COOKIE);
  const renderedAt = Date.now();
  if (!pass) return { menu: null, renderedAt };
  const menu = await new ConvexHttpClient(convexServerUrl()).query(api.guest.tableMenu, { pass, venueSlug });
  return { menu, renderedAt };
}

export async function fetchPublicMenu(venueSlug: string) {
  return {
    menu: await new ConvexHttpClient(convexServerUrl()).query(api.guest.publicMenu, { venueSlug }),
    renderedAt: Date.now(),
    // Pour l'adresse canonique et les données structurées, qui veulent une URL absolue.
    origin: siteOrigin(),
  };
}
