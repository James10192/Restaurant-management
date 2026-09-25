/**
 * Disponibilité en direct — chargée APRÈS l'affichage de la carte.
 *
 * Ce module (et le client Convex qu'il tire) n'entre pas dans le JavaScript nécessaire à la
 * première interaction : la carte est lisible et utilisable sans lui (DESIGN.md §5, budget de
 * 120 Ko). Il arrive ensuite, et fait griser un plat sous les yeux du client quand la cuisine
 * le bascule en rupture.
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LiveAvailability } from "../../../convex/lib/guestMenu";

export function subscribeAvailability(
  url: string,
  venueId: Id<"venues">,
  onChange: (live: LiveAvailability) => void,
  onConnection: (connected: boolean) => void,
): () => void {
  const client = new ConvexClient(url);
  const unsubscribe = client.onUpdate(api.guest.availability, { venueId }, (value) => {
    if (value) onChange(value);
  });
  const stopWatching = client.subscribeToConnectionState((state) => onConnection(state.isWebSocketConnected));
  return () => {
    unsubscribe();
    stopWatching();
    void client.close();
  };
}
