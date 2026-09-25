import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { brandThemeCss, HEX_PATTERN } from "../../convex/lib/brandTheme";
import { useAuthStatus } from "~/components/app/convex-providers";
import { MenuView } from "~/components/guest/menu-view";
import { VenueHero } from "~/components/guest/venue-hero";
import { PREVIEW_MESSAGE, PREVIEW_READY, type PreviewMessage } from "~/lib/preview";

/**
 * L'aperçu de la carte, montré dans un cadre de 390 px par l'écran Apparence — Joliba (D-157)
 *
 * Hors de la coque de l'application, pour que le cadre ne montre QUE la carte ; sous `_auth`,
 * parce qu'il faut être connecté (la requête exige `venue.manage`). C'est la vraie carte — les
 * mêmes composants que celle du client, sur les cartes en ligne — et non une maquette : ce que
 * l'aperçu montre est ce que le client verra.
 *
 * Il reçoit la couleur par `postMessage`, AVANT l'enregistrement ; le logo, en ligne dès son envoi,
 * arrive par la même requête que la carte. Seule la fenêtre
 * parente, et de la même origine, est écoutée ; la couleur est revalidée avant d'entrer dans le
 * style, comme sur la vraie carte.
 */
export const Route = createFileRoute("/_auth/apercu/$venueId")({
  head: () => ({ meta: [{ title: "Aperçu de la carte — Joliba" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Preview,
});

function Preview() {
  const { venueId } = Route.useParams();
  // Comme la coque de l'application : pas de requête avant que la session soit établie.
  const auth = useAuthStatus();
  const data = useQuery(api.branding.previewMenu, auth.isAuthenticated ? { venueId: venueId as Id<"venues"> } : "skip");
  // La couleur en cours de saisie ; `undefined` tant que l'écran n'en a envoyé aucune.
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const message = event.data as Partial<PreviewMessage> | null;
      if (!message || message.type !== PREVIEW_MESSAGE) return;
      const primary = typeof message.primary === "string" && HEX_PATTERN.test(message.primary) ? message.primary : null;
      setOverride(primary);
    };
    window.addEventListener("message", receive);
    if (window.parent !== window) window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);

  if (!data) return <main className="min-h-dvh bg-background" aria-busy="true" />;
  const brand = { ...data.venue.brand, primary: override === undefined ? data.venue.brand.primary : override };
  const place = [data.venue.address?.district, data.venue.address?.city].filter(Boolean).join(", ");
  return (
    <>
      {/* La même règle que la vraie carte : un hexadécimal revalidé, sinon la couleur de Joliba. */}
      {brand.primary ? <style data-preview-theme>{brandThemeCss(brand.primary)}</style> : null}
      {data.menus.length === 0 ? (
        // Au restaurateur, pas au client : « demandez la carte à votre serveur » n'aurait pas de sens ici.
        <main className="min-h-dvh bg-background">
          <VenueHero eyebrow={place || null} name={data.venue.name} logo={brand.logo} description={data.venue.description} />
          <p className="mx-auto max-w-[960px] px-4 pt-6 text-sm text-muted-foreground">Publiez votre carte : vos plats apparaîtront ici, tels que vos clients les verront.</p>
        </main>
      ) : (
        <MenuView
          venue={data.venue}
          menus={data.menus}
          live={data.live}
          renderedAt={renderedAt}
          selectedProductId={selected}
          onSelectProduct={setSelected}
          header={<VenueHero eyebrow={place || null} name={data.venue.name} logo={brand.logo} description={data.venue.description} />}
        />
      )}
    </>
  );
}
