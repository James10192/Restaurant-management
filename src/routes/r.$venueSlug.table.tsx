import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QrCodeIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { brandThemeCss } from "../../convex/lib/brandTheme";
import { MenuView, type MenuOrdering } from "~/components/guest/menu-view";
import { VenueHero } from "~/components/guest/venue-hero";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { bindCart, cart } from "~/lib/guest/cart";
import { loadTableMenu, SLUG_PATTERN } from "~/lib/guest/server";
import { useServiceWorker } from "~/lib/guest/sw";
import { handleTableAction } from "~/lib/guest/table-actions.server";

/** Panier, appel et commandes : chargés après l'affichage de la carte, jamais au rendu serveur. */
const TableOrdering = lazy(() => import("~/components/guest/table-ordering"));
/** Même nom que `GUEST_ADDED_EVENT` (table-ordering), recopié ici pour ne pas tirer ce module. */
const ADDED_EVENT = "joliba:ajout";

/**
 * La carte d'une table — Joliba (IA §3, « La carte »)
 *
 * Adresse SANS SECRET : le laissez-passer est dans un cookie `httpOnly`, lu par le serveur.
 * Partagée, l'adresse n'ouvre rien ailleurs que dans le navigateur qui a scanné le QR.
 * Le plat ouvert est dans l'adresse (`?plat=`) : un rechargement le garde ouvert.
 *
 * Les gestes du client (panier, envoi, appel) sont des POST sur CETTE adresse : c'est la seule
 * où le cookie du laissez-passer accompagne la requête (`lib/guest/table-actions.server.ts`).
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
    // La couleur du restaurant, déjà rendue lisible à l'enregistrement (D-152). Aucun script.
    styles: loaderData?.menu?.venue.brand.primary ? [{ children: brandThemeCss(loaderData.menu.venue.brand.primary) }] : [],
  }),
  server: {
    handlers: {
      // Seul POST est traité ici ; l'affichage de la page (GET) reste celui du routeur.
      POST: ({ request, params }) => {
        if (!SLUG_PATTERN.test(params.venueSlug)) return new Response(null, { status: 404 });
        return handleTableAction(request, params.venueSlug);
      },
    },
  },
  component: TableMenu,
});

function TableMenu() {
  const { menu, renderedAt } = Route.useLoaderData();
  const { plat } = Route.useSearch();
  const { venueSlug } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  useServiceWorker();
  // Le panier ne vit que dans le navigateur : rien de tout cela au rendu serveur.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    bindCart(venueSlug);
    setHydrated(true);
  }, [venueSlug]);

  const ordering = useMemo<MenuOrdering | undefined>(() => {
    if (!menu) return undefined;
    return {
      onAdd: (choice, productName) => {
        const result = cart.add(choice);
        if (result === true) window.dispatchEvent(new CustomEvent(ADDED_EVENT, { detail: productName }));
        return result;
      },
      render: (context) =>
        hydrated ? (
          <Suspense fallback={null}>
            <TableOrdering venueSlug={venueSlug} venue={menu.venue} menus={menu.menus} {...context} />
          </Suspense>
        ) : null,
    };
  }, [menu, hydrated, venueSlug]);

  if (!menu) return <ScanAgain />;

  return (
    <MenuView
      ordering={ordering}
      venue={menu.venue}
      menus={menu.menus}
      live={menu.live}
      renderedAt={renderedAt}
      selectedProductId={plat ?? null}
      onSelectProduct={(id) => void navigate({ search: id ? { plat: id } : {}, replace: !id, resetScroll: false })}
      header={<VenueHero compact eyebrow={`Table ${menu.table.number}`} name={menu.venue.name} logo={menu.venue.brand.logo} />}
    />
  );
}

/** Pas de laissez-passer, ou plus valable (QR révoqué, délai écoulé) : on ne montre rien d'autre. */
function ScanAgain() {
  return (
    <main className="flex min-h-dvh bg-background px-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <QrCodeIcon />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="text-xl font-semibold tracking-tight">Scannez le QR code de votre table</h1>
          </EmptyTitle>
          <EmptyDescription>
            La carte s'ouvre depuis le QR code posé sur la table. S'il ne fonctionne pas, demandez la carte à votre serveur.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
