import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MenuView } from "~/components/guest/menu-view";
import { loadTableMenu, SLUG_PATTERN } from "~/lib/guest/server";
import { useServiceWorker } from "~/lib/guest/sw";

/**
 * La carte d'une table — Joliba (IA §3, « La carte »)
 *
 * Adresse SANS SECRET : le laissez-passer est dans un cookie `httpOnly`, lu par le serveur.
 * Partagée, l'adresse n'ouvre rien ailleurs que dans le navigateur qui a scanné le QR.
 * Le plat ouvert est dans l'adresse (`?plat=`) : un rechargement le garde ouvert.
 */
export const Route = createFileRoute("/r/$venueSlug/table")({
  validateSearch: (search: Record<string, unknown>): { plat?: string } =>
    typeof search.plat === "string" && /^[a-z0-9]{1,40}$/.test(search.plat) ? { plat: search.plat } : {},
  // Ce chargeur ne doit tourner qu'au rendu serveur : le cookie de table est limité au chemin
  // `/r/<établissement>` et n'accompagne pas l'appel d'une fonction serveur depuis le navigateur.
  // Aucune navigation côté client ne mène donc ici (la fiche plat ne change que `?plat=`).
  loader: ({ params }) =>
    // Une adresse mal formée n'a pas de carte : même écran que sans laissez-passer.
    SLUG_PATTERN.test(params.venueSlug) ? loadTableMenu({ data: { venueSlug: params.venueSlug } }) : { menu: null, renderedAt: Date.now() },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.menu ? `${loaderData.menu.venue.name} — la carte` : "La carte" },
      // Doublé par l'en-tête X-Robots-Tag : cette page n'a rien à faire dans un moteur (D-030).
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: TableMenu,
});

function TableMenu() {
  const { menu, renderedAt } = Route.useLoaderData();
  const { plat } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  useServiceWorker();

  if (!menu) return <ScanAgain />;

  return (
    <MenuView
      venue={menu.venue}
      menus={menu.menus}
      live={menu.live}
      renderedAt={renderedAt}
      selectedProductId={plat ?? null}
      onSelectProduct={(id) => void navigate({ search: id ? { plat: id } : {}, replace: !id, resetScroll: false })}
      header={
        <header className="bg-surface px-4 pb-4 pt-5">
          <div className="mx-auto flex max-w-[960px] items-baseline justify-between gap-4">
            <h1 className="text-title-xl text-ink">{menu.venue.name}</h1>
            <p className="shrink-0 text-title-md text-ink-2">
              Table <span className="tabular-nums text-ink">{menu.table.number}</span>
            </p>
          </div>
        </header>
      }
    />
  );
}

/** Pas de laissez-passer, ou plus valable (QR révoqué, délai écoulé) : on ne montre rien d'autre. */
function ScanAgain() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-title-xl text-ink">Scannez le QR code de votre table</h1>
      <p className="text-body text-ink-2">
        La carte s'ouvre depuis le QR code posé sur la table. S'il ne fonctionne pas, demandez la carte à votre serveur.
      </p>
    </main>
  );
}
