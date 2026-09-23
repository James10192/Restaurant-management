import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

/*
 * Squelette — DESIGN.md §10.1 : à la forme réelle du contenu (mêmes hauteurs, mêmes
 * rayons), fond surface-2, sans animation de balayage (du calcul pour rien sur un
 * appareil d'entrée de gamme). L'annonce du chargement revient au conteneur
 * (`LoadingState`), pas à chaque bloc.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("rounded-sm bg-surface-2", className)} {...props} />;
}
