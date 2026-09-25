import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/**
 * L'en-tête éditorial de la carte client — Joliba (D-132)
 *
 * Le nom de l'établissement en très grandes capitales, son dernier mot dans la couleur de la
 * marque, une ligne de lieu au-dessus. Aucune image : l'en-tête s'affiche avec le HTML, sans
 * rien retarder de la première photo de plat (DESIGN §5). Le texte reste en casse d'origine
 * dans le document : les capitales ne sont qu'un style, un lecteur d'écran lit le vrai nom.
 */
export function VenueHero(props: { eyebrow?: string | null; name: string; compact?: boolean; children?: ReactNode }) {
  const words = props.name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;
  return (
    <header className={cn("bg-background px-4", props.compact ? "pt-5 pb-4" : "pt-8 pb-6")}>
      <div className="mx-auto max-w-[960px]">
        {props.eyebrow ? <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">{props.eyebrow}</p> : null}
        <h1
          className={cn(
            "mt-2 font-black tracking-tight uppercase [overflow-wrap:anywhere]",
            props.compact ? "text-3xl leading-[0.95]" : "text-[clamp(2.5rem,13vw,4.75rem)] leading-[0.9]",
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
        {props.children}
      </div>
    </header>
  );
}
