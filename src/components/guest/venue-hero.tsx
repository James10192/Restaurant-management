import { useState, type ReactNode } from "react";
import type { PublicBrand } from "../../../convex/lib/guestMenu";
import { cn } from "~/lib/utils";

/** Au-delà, la présentation est coupée à deux lignes : la carte doit rester au premier écran. */
const DESCRIPTION_CLAMP = 110;

/**
 * L'en-tête de la carte client — Joliba (D-166, qui adoucit D-132)
 *
 * Le nom en casse normale, en gras, précédé du logo sur une plaque claire quand le restaurant en
 * a posé un. Pas de couleur de marque ici : elle est réservée au « + » et à la section lue, pour
 * qu'une couleur vive choisie par le restaurant ne crie pas partout (D-161).
 *
 * Il répond, dans cet ordre, aux questions de quelqu'un qui vient de scanner ou de cliquer un
 * lien : où est-ce, est-ce ouvert — et sinon QUAND —, comment appeler ou y aller. Puis il laisse
 * la place à la carte : au premier écran d'un téléphone, on doit voir au moins un plat.
 */
export function VenueHero(props: {
  eyebrow?: string | null;
  name: string;
  logo?: PublicBrand["logo"];
  compact?: boolean;
  status?: { open: boolean; text: string } | null;
  description?: string | null;
  street?: string | null;
  /** « Plus » / « Moins », dans la langue de la carte. */
  labels?: { more: string; less: string };
  children?: ReactNode;
}) {
  return (
    <header className={cn("bg-background px-4", props.compact ? "pt-5 pb-3" : "pt-6 pb-4")}>
      <div className="mx-auto max-w-[960px]">
        {props.eyebrow ? <p className="text-sm text-muted-foreground">{props.eyebrow}</p> : null}
        <div className="mt-1.5 flex items-center gap-3">
          {props.logo ? (
            // 48 px sur une plaque claire : un logo sombre et transparent reste lisible, et sa
            // place est réservée avant son arrivée (largeur et hauteur connues, rien ne bouge).
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-border">
              <img
                src={props.logo.url}
                width={props.logo.width}
                height={props.logo.height}
                alt=""
                crossOrigin="anonymous"
                decoding="async"
                // Petit, et jamais devant les photos de plats : c'est elles que le client attend.
                fetchPriority="low"
                className="max-h-full max-w-full object-contain"
              />
            </span>
          ) : null}
          <h1 className={cn("min-w-0 leading-tight font-bold tracking-tight [overflow-wrap:anywhere]", props.compact ? "text-2xl" : "text-[28px] sm:text-[32px]")}>
            {props.name}
          </h1>
        </div>
        {props.status ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium" data-opening-status>
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", props.status.open ? "bg-foreground" : "bg-muted-foreground/50")} />
            <span className={props.status.open ? "text-foreground" : "text-muted-foreground"}>{props.status.text}</span>
          </p>
        ) : null}
        {props.description ? <Description text={props.description} labels={props.labels ?? { more: "Plus", less: "Moins" }} /> : null}
        {props.street ? <p className="mt-1.5 text-sm text-muted-foreground">{props.street}</p> : null}
        {props.children}
      </div>
    </header>
  );
}

/** Deux lignes, puis « Plus » : le texte entier reste dans le document (référencement, lecteurs d'écran). */
function Description({ text, labels }: { text: string; labels: { more: string; less: string } }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > DESCRIPTION_CLAMP;
  return (
    <div className="mt-3 max-w-xl text-sm text-muted-foreground">
      <p id="venue-description" className={cn(long && !expanded && "line-clamp-2")}>
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="venue-description"
          onClick={() => setExpanded((v) => !v)}
          // Petit à l'œil, 56 px sous le doigt (DESIGN §11) : la zone active déborde du texte.
          className="relative mt-0.5 -ml-1 rounded px-1 py-1 text-sm font-semibold text-foreground underline underline-offset-4 outline-none after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {expanded ? labels.less : labels.more}
        </button>
      ) : null}
    </div>
  );
}
