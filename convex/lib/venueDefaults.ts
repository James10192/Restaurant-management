/**
 * Réglages par défaut d'un nouvel établissement — Joliba
 *
 * Des valeurs PRUDENTES, jamais présentées comme un conseil fiscal ou réglementaire :
 *  - service : QR pour consulter la carte, commande prise par le personnel (A2) ;
 *  - aucune taxe préremplie : le taux applicable dépend du régime de l'établissement,
 *    c'est à lui de le saisir, pas au logiciel de le deviner ;
 *  - pourboire désactivé (aucun encadrement légal ivoirien trouvé) ;
 *  - espèces seules tant qu'aucun fournisseur de paiement n'est branché.
 */

import type { Doc, Id } from "../_generated/dataModel";

type VenueSettingsInput = Omit<Doc<"venueSettings">, "_id" | "_creationTime">;

export function defaultVenueSettings(venueId: Id<"venues">): VenueSettingsInput {
  return {
    venueId,
    service: {
      orderingMode: "staff_only",
      paymentTiming: "post_paid",
      paymentLocations: ["table", "counter"],
      qrStrategy: "frictionless",
      guestDirectCategories: [],
      autoAbandonMinutes: 240,
    },
    tax: { pricesIncludeTax: true, rates: [] },
    tipping: { enabled: false, mode: "free", suggestions: [] },
    branding: { primaryColor: "#0B6478", theme: "light" },
    fiscal: { regime: "non_renseigne", fneEnabled: false },
    payments: { enabledMethods: ["cash"], onlineProviders: [] },
    notifications: [],
    serviceRequestTypes: [
      { key: "call_waiter", label: "Appeler un serveur", enabled: true, cooldownSeconds: 60 },
      { key: "request_bill", label: "Demander l'addition", enabled: true, cooldownSeconds: 60 },
    ],
    tagCatalog: [],
  };
}
