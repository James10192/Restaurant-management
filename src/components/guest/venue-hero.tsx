import { useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";

/** Au-delà, la présentation est coupée à deux lignes : la carte doit rester au premier écran. */
const DESCRIPTION_CLAMP = 110;

/**
 * L'en-tête éditorial de la carte client — Joliba (D-132)
 *
 * Le nom en capitales, son dernier mot dans la couleur de la marque, le lieu au-dessus. Aucune
 * image : l'en-tête s'affiche avec le HTML, sans rien retarder de la première photo de plat
 * (DESIGN §5). Les capitales ne sont qu'un style : un lecteur d'écran lit le vrai nom.
 *
 * Il répond, dans cet ordre, aux questions de quelqu'un qui vient de scanner ou de cliquer un
 * lien : où est-ce, est-ce ouvert — et sinon QUAND —, comment appeler ou y aller. Puis il laisse
 * la place à la carte : au premier écran d'un téléphone, on doit voir au moins un plat.
 */
export function VenueHero(props: {
  eyebrow?: string | null;
  name: string;
  compact?: boolean;
  status?: { open: boolean; text: string } | null;
  description?: string | null;
  street?: string | null;
  children?: ReactNode;
}) {
  const words = props.name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;
  return (
    <header className={cn("bg-background px-4", props.compact ? "pt-5 pb-3" : "pt-6 pb-4")}>
      <div className="mx-auto max-w-[960px]">
        {props.eyebrow ? <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">{props.eyebrow}</p> : null}
        <h1
          className={cn(
            "mt-1.5 font-black tracking-tight uppercase [overflow-wrap:anywhere]",
            props.compact ? "text-3xl leading-[0.95]" : "text-[clamp(2.25rem,11vw,4.5rem)] leading-[0.92]",
          )}
        >
          {words.join(" ")}
          {last ? (
            <>
              {" "}
              <span className="text-primary">{last}</span>
            </>
          ) : null}
        </h1>
        {props.status ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium" data-opening-status>
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", props.status.open ? "bg-primary" : "bg-muted-foreground/50")} />
            <span className={props.status.open ? "text-foreground" : "text-muted-foreground"}>{props.status.text}</span>
          </p>
        ) : null}
        {props.description ? <Description text={props.description} /> : null}
        {props.street ? <p className="mt-1.5 text-sm text-muted-foreground">{props.street}</p> : null}
        {props.children}
      </div>
    </header>
  );
}

/** Deux lignes, puis « Plus » : le texte entier reste dans le document (référencement, lecteurs d'écran). */
function Description({ text }: { text: string }) {
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
          className="mt-0.5 -ml-1 rounded px-1 py-1 text-sm font-semibold text-foreground underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {expanded ? "Moins" : "Plus"}
        </button>
      ) : null}
    </div>
  );
}
