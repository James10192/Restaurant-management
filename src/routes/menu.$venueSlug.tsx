import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { localTime } from "../../convex/lib/availability";
import type { PublicVenue } from "../../convex/lib/guestMenu";
import { isIndexable } from "../../convex/lib/indexability";
import { VENUE_TYPE_LABELS } from "../../convex/lib/validators";
import { NavigationIcon, PhoneIcon, UtensilsCrossedIcon } from "lucide-react";
import { MenuView } from "~/components/guest/menu-view";
import { VenueHero } from "~/components/guest/venue-hero";
import { Button } from "~/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { formatMinute } from "~/lib/guest/availability";
import { openingStatus, openingText } from "~/lib/guest/opening";
import { loadPublicMenu, SLUG_PATTERN } from "~/lib/guest/server";
import { useServiceWorker } from "~/lib/guest/sw";

/**
 * La carte publique d'un établissement — Joliba (IA §2, seo-strategy §6.9 et §7.5)
 *
 * Une vitrine : elle montre la carte réelle, à jour, et invite à appeler. Elle ne prend pas
 * de commande. Sans consentement du restaurant, ou sans carte publiée : 404, et non 403 —
 * l'existence de l'établissement n'a pas à être confirmée.
 *
 * L'indexation est décidée PAR LE CODE (`lib/indexability.ts`) : sous la porte de qualité,
 * la page reste consultable mais porte `noindex, follow`, et les données structurées ne sont
 * pas servies.
 */
export const Route = createFileRoute("/menu/$venueSlug")({
  validateSearch: (search: Record<string, unknown>): { plat?: string } =>
    typeof search.plat === "string" && /^[a-z0-9]{1,40}$/.test(search.plat) ? { plat: search.plat } : {},
  loader: async ({ params }) => {
    if (!SLUG_PATTERN.test(params.venueSlug)) throw notFound();
    const data = await loadPublicMenu({ data: { venueSlug: params.venueSlug } });
    if (!data.menu) throw notFound();
    const indexable = isIndexable(data.menu.facts, data.renderedAt);
    return { ...data.menu, renderedAt: data.renderedAt, origin: data.origin, indexable };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Carte introuvable" }, { name: "robots", content: "noindex" }] };
    const { venue } = loaderData;
    const title = `${venue.name} — la carte et les prix`;
    const description =
      venue.description?.slice(0, 155) ?? `La carte de ${venue.name}${venue.address?.city ? `, ${venue.address.city}` : ""} : plats, prix et disponibilités.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: loaderData.indexable ? "index, follow" : "noindex, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
      links: [{ rel: "canonical", href: `${loaderData.origin}/menu/${params.venueSlug}` }],
      scripts: loaderData.indexable ? [{ type: "application/ld+json", children: jsonLd(venue, loaderData.menus, `${loaderData.origin}/menu/${params.venueSlug}`) }] : [],
    };
  },
  component: PublicMenu,
  notFoundComponent: MenuNotFound,
});

/** Données structurées `Restaurant` + `hasMenu`. `<` échappé : aucun contenu ne ferme le script. */
function jsonLd(venue: PublicVenue, menus: { sections: { name: string; products: { name: string; description?: string; basePrice: number }[] }[] }[], url: string) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: venue.name,
    url,
    ...(venue.description ? { description: venue.description } : {}),
    ...(venue.phone ? { telephone: venue.phone } : {}),
    ...(venue.address
      ? {
          address: {
            "@type": "PostalAddress",
            ...(venue.address.line1 ? { streetAddress: venue.address.line1 } : {}),
            addressLocality: venue.address.city,
            addressCountry: venue.address.countryCode,
          },
        }
      : {}),
    openingHoursSpecification: (venue.openingHours ?? []).map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days[h.dayOfWeek],
      opens: formatMinute(h.opensAtMinute),
      closes: formatMinute(h.closesAtMinute),
    })),
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: menus.flatMap((m) =>
        m.sections.map((s) => ({
          "@type": "MenuSection",
          name: s.name,
          hasMenuItem: s.products.map((p) => ({
            "@type": "MenuItem",
            name: p.name,
            ...(p.description ? { description: p.description } : {}),
            offers: { "@type": "Offer", price: p.basePrice, priceCurrency: venue.currency },
          })),
        })),
      ),
    },
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Un itinéraire sans coordonnées : la recherche Maps sur le nom et l'adresse déclarés. */
function mapsUrl(name: string, address: string): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;
}

function PublicMenu() {
  const data = Route.useLoaderData();
  const { plat } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  useServiceWorker();
  const { venue } = data;
  const local = localTime(data.renderedAt, venue.timezone);
  const status = openingStatus(venue.openingHours ?? [], local);
  // Le quartier et la ville au-dessus du nom ; la rue et le repère sous la présentation.
  const place = [venue.address?.district, venue.address?.city].filter(Boolean).join(", ");
  const street = [venue.address?.line1, venue.address?.landmark].filter(Boolean).join(", ");
  const directions = mapsUrl(venue.name, [street, place].filter(Boolean).join(", "));

  return (
    <MenuView
      venue={venue}
      menus={data.menus}
      live={data.live}
      renderedAt={data.renderedAt}
      selectedProductId={plat ?? null}
      onSelectProduct={(id) => void navigate({ search: id ? { plat: id } : {}, replace: !id, resetScroll: false })}
      header={
        <VenueHero
          eyebrow={place || VENUE_TYPE_LABELS[venue.venueType]}
          name={venue.name}
          status={status ? { open: status.open, text: openingText(status, local.dayOfWeek) } : null}
          description={venue.description}
          street={street || null}
        >
          {venue.phone || directions ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {venue.phone ? (
                <Button asChild variant="outline" className="h-11 rounded-full px-5">
                  <a href={`tel:${venue.phone.replace(/\s+/g, "")}`}>
                    <PhoneIcon data-icon="inline-start" />
                    Appeler
                  </a>
                </Button>
              ) : null}
              {directions ? (
                <Button asChild variant="outline" className="h-11 rounded-full px-5">
                  <a href={directions} target="_blank" rel="noopener noreferrer">
                    <NavigationIcon data-icon="inline-start" />
                    Itinéraire
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </VenueHero>
      }
      footer={
        <Button asChild variant="link" size="sm" className="px-0 text-muted-foreground">
          <a href="/" rel="nofollow">
            Carte propulsée par Joliba
          </a>
        </Button>
      }
    />
  );
}

function MenuNotFound() {
  return (
    <main className="flex min-h-dvh bg-background px-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UtensilsCrossedIcon />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="text-xl font-semibold tracking-tight">Cette carte n'est pas en ligne</h1>
          </EmptyTitle>
          <EmptyDescription>L'adresse est peut-être incomplète, ou l'établissement ne publie pas sa carte ici.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="lg">
            <a href="/">Revenir à l'accueil</a>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
