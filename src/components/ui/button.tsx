import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { useHydrated } from "../../lib/use-hydrated";
import { Spinner } from "./spinner";

/*
 * DESIGN.md §9.1. Une seule action `primary` par vue (R-D1).
 * Les survols passent par `not-disabled:` et non `enabled:` : `:enabled` ne
 * s'applique pas à un lien rendu via `asChild`.
 * Aucun déplacement ni changement d'échelle à la pression (§9.1, état `active`).
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-sm border border-transparent font-semibold",
    "transition-colors duration-(--m-fast) ease-out-soft",
    "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-busy:cursor-progress",
    // Désactivé (§9.1) : fond surface-2, texte ink-disabled. Pas pendant le chargement,
    // où le bouton garde son apparence et affiche « Envoi… ».
    "disabled:not-aria-busy:border-line disabled:not-aria-busy:bg-surface-2 disabled:not-aria-busy:text-ink-disabled",
    "aria-disabled:border-line aria-disabled:bg-surface-2 aria-disabled:text-ink-disabled aria-disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent-600 text-on-fill not-disabled:hover:bg-accent-700 not-disabled:active:bg-accent-800",
        secondary:
          "border-line-control bg-surface text-ink not-disabled:hover:bg-surface-2 not-disabled:active:bg-line",
        quiet:
          "bg-transparent text-ink-2 not-disabled:hover:bg-surface-2 not-disabled:hover:text-ink not-disabled:active:bg-line",
        danger:
          "border-danger-600 bg-surface text-danger-600 not-disabled:hover:bg-danger-50 not-disabled:hover:text-danger-700 not-disabled:active:border-danger-700",
        "danger-solid":
          "bg-danger-600 text-on-fill not-disabled:hover:bg-danger-700 not-disabled:active:bg-danger-700",
        link: "bg-transparent text-accent-600 underline underline-offset-4 not-disabled:hover:text-accent-700",
      },
      size: {
        // Visuellement plus petit, mais la zone active reste à --tap (R-D4) grâce au pseudo-élément.
        sm: [
          "h-9 px-3 text-label in-data-[density=guest]:text-body [&_svg:not([class*='size-'])]:size-4",
          "after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-(--tap) after:min-w-(--tap) after:-translate-1/2",
        ],
        md: "h-(--control-h) px-5 text-(length:--font-base)",
        lg: "h-[max(56px,var(--control-h))] px-6 text-title-md",
        icon: "size-(--tap) p-0",
      },
    },
    compoundVariants: [
      {
        variant: "link",
        className:
          "h-auto min-h-(--tap) px-1 disabled:not-aria-busy:border-transparent disabled:not-aria-busy:bg-transparent aria-disabled:border-transparent aria-disabled:bg-transparent",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Rend l'enfant unique (un lien, par exemple) avec l'apparence d'un bouton. */
    asChild?: boolean;
    /**
     * État d'envoi (R-D5). Fige la largeur, pose `aria-busy`, désactive le bouton et
     * remplace le libellé par `loadingText`. Passer `loading={false}` au repos réserve
     * déjà la largeur, pour qu'aucun saut ne se produise au moment de l'envoi.
     */
    loading?: boolean;
    /** Libellé pendant l'envoi. « Enregistrement… » pour un formulaire (§6.6). */
    loadingText?: string;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  loadingText = "Envoi…",
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const hydrated = useHydrated();

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  const busy = loading === true;
  // Un bouton d'envoi reste inerte tant que la page n'est pas hydratée : sinon le
  // formulaire partirait en HTML, sans validation, et la saisie serait perdue.
  const inert = type === "submit" && !hydrated;

  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || busy || inert}
      aria-busy={busy || undefined}
      data-loading={busy ? "" : undefined}
      {...props}
    >
      {loading === undefined ? (
        children
      ) : (
        // Les deux couches occupent la même cellule : la largeur est celle de la plus
        // large, le bouton ne bouge donc pas quand l'une remplace l'autre (§9.1).
        <span className="grid items-center justify-items-center">
          <span
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center gap-2",
              busy && "invisible",
            )}
          >
            {children}
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center gap-2",
              !busy && "invisible",
            )}
          >
            <Spinner decorative size="sm" />
            {size === "icon" ? null : loadingText}
          </span>
        </span>
      )}
    </button>
  );
}
