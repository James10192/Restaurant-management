import { createFileRoute } from "@tanstack/react-router";

/**
 * L'échec d'un scan — Joliba (IA §3, « Échange du jeton »)
 *
 * Chaque échec dit quoi faire. L'adresse ne porte pas le jeton : l'échange a redirigé ici.
 * Le nom de l'établissement dans l'adresse n'est PAS affiché : pour un jeton inconnu, il vient
 * de l'adresse elle-même, et l'écrire à l'écran confirmerait n'importe quoi.
 */
type Reason = "invalid" | "table_closed" | "venue_closed" | "erreur";

const MESSAGES: Record<Reason, { title: string; body: string }> = {
  invalid: {
    title: "Ce QR code n'est plus valide",
    body: "Il a peut-être été remplacé. Demandez la carte à votre serveur, ou scannez le QR code posé sur votre table.",
  },
  table_closed: {
    title: "Cette table n'est pas en service",
    body: "Installez-vous à une autre table, ou demandez à votre serveur.",
  },
  venue_closed: {
    title: "Le service est fermé",
    body: "L'établissement ne prend pas de clients pour le moment.",
  },
  erreur: {
    title: "La carte n'a pas pu s'ouvrir",
    body: "Vérifiez votre connexion, puis scannez à nouveau le QR code.",
  },
};

export const Route = createFileRoute("/r/$venueSlug/indisponible")({
  validateSearch: (search: Record<string, unknown>): { raison: Reason } => ({
    raison: (["invalid", "table_closed", "venue_closed", "erreur"] as const).find((r) => r === search.raison) ?? "invalid",
  }),
  head: () => ({ meta: [{ title: "La carte" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Unavailable,
});

function Unavailable() {
  const { raison } = Route.useSearch();
  const message = MESSAGES[raison];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-title-xl text-ink">{message.title}</h1>
      <p className="text-body text-ink-2">{message.body}</p>
    </main>
  );
}
