/**
 * Validateurs partagés entre le schéma et les fonctions — Joliba
 *
 * Une liste de valeurs vit à UN endroit. Le schéma et les arguments des mutations
 * importent le même validateur : ajouter un type d'établissement se fait ici, et le
 * compilateur signale chaque endroit qui doit en tenir compte.
 */

import { v, type Infer } from "convex/values";

export const venueType = v.union(
  v.literal("restaurant"),
  v.literal("maquis"),
  v.literal("bar"),
  v.literal("lounge"),
  v.literal("cafe"),
  v.literal("fast_food"),
  v.literal("hotel"),
  v.literal("food_court"),
);

export type VenueType = Infer<typeof venueType>;

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  restaurant: "Restaurant",
  maquis: "Maquis",
  bar: "Bar",
  lounge: "Lounge",
  cafe: "Café",
  fast_food: "Restauration rapide",
  hotel: "Hôtel",
  food_court: "Aire de restauration",
};

export const locale = v.union(v.literal("fr"), v.literal("en"));
