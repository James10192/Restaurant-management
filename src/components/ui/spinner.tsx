import type { ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/cn";

const SIZES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const;

type SpinnerProps = Omit<ComponentProps<"span">, "children"> & {
  size?: keyof typeof SIZES;
  /** Texte lu par les lecteurs d'écran. */
  label?: string;
  /**
   * Indicateur purement visuel, quand l'élément parent annonce déjà l'attente
   * (bouton en `aria-busy`, zone en chargement). Retire le `role="status"`.
   */
  decorative?: boolean;
};

/** Indicateur circulaire — toujours dans la zone concernée, jamais en plein écran (§10.1). */
export function Spinner({
  size = "md",
  label = "Chargement",
  decorative = false,
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      role={decorative ? undefined : "status"}
      aria-hidden={decorative ? true : undefined}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      <LoaderCircle
        aria-hidden="true"
        strokeWidth={2}
        className={cn(SIZES[size], "animate-spin")}
      />
      {decorative ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}
